"""
All 5 agent chains:
  1. Query Planner    — understands intent + picks relevant columns
  2. Code Generator   — writes Pandas code
  3. Executor         — runs code safely via subprocess
  4. Error Fixer      — rewrites broken code
  5. Visualizer       — picks chart type + formats data
  6. Insight Narrator — explains result in plain English
"""

import subprocess
import sys
import json
import tempfile
import os
import pandas as pd

from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

os.environ["PYTHONUTF8"] = "1"
# ── LLM factory ──────────────────────────────────────────────
def get_llm(api_key: str):
    return ChatGroq(
        groq_api_key=api_key,
        model_name="llama-3.3-70b-versatile",
        temperature=0.1,          # low temp = deterministic code
        max_tokens=2048,
    )


# ── Agent 1: Query Planner ────────────────────────────────────
PLANNER_PROMPT = ChatPromptTemplate.from_template("""
You are a data analyst query planner.

Dataset Schema:
{schema}

Sample Data (first 3 rows):
{sample}

User Question: {question}

Your job:
1. Understand what the user wants
2. Identify which columns are relevant
3. Decide what kind of analysis is needed

Respond in this EXACT JSON format (no markdown, no backticks):
{{
  "intent": "one sentence describing what to compute",
  "relevant_columns": ["col1", "col2"],
  "analysis_type": "aggregation|filtering|comparison|trend|distribution|correlation",
  "chart_hint": "bar|line|pie|scatter|none"
}}
""")

def run_planner(question: str, schema: str, sample: str, api_key: str) -> dict:
    llm = get_llm(api_key)
    chain = PLANNER_PROMPT | llm | StrOutputParser()
    raw = chain.invoke({"question": question, "schema": schema, "sample": sample})
    # clean and parse JSON
    raw = raw.strip().replace("```json", "").replace("```", "").strip()
    try:
        return json.loads(raw)
    except Exception:
        return {
            "intent": question,
            "relevant_columns": [],
            "analysis_type": "aggregation",
            "chart_hint": "bar"
        }


# ── Agent 2: Code Generator ───────────────────────────────────
CODE_GEN_PROMPT = ChatPromptTemplate.from_template("""
You are an expert Python/Pandas code writer.

Dataset Schema:
{schema}

Sample Data (first 3 rows):
{sample}

Analysis Intent: {intent}
Relevant Columns: {relevant_columns}
User Question: {question}

Write Python/Pandas code to answer the question.
Rules:
- The dataframe is already loaded as variable `df`
- Store your final result in a variable called `result`
- `result` must be one of: a number, a string, or a pandas DataFrame
- Do NOT import pandas or read any files — df is already available
- Do NOT use print statements
- Keep code simple and correct
- Handle potential errors (e.g. column not found) gracefully

Return ONLY the Python code, no explanation, no markdown, no backticks.
""")

def run_code_generator(question: str, schema: str, sample: str,
                        intent: str, relevant_columns: list, api_key: str) -> str:
    llm = get_llm(api_key)
    chain = CODE_GEN_PROMPT | llm | StrOutputParser()
    code = chain.invoke({
        "question": question,
        "schema": schema,
        "sample": sample,
        "intent": intent,
        "relevant_columns": str(relevant_columns),
    })
    return code.strip().replace("```python", "").replace("```", "").strip()


# ── Agent 3: Executor ─────────────────────────────────────────
def run_executor(code: str, df: pd.DataFrame, timeout: int = 15) -> dict:
    """
    Safely execute pandas code in a subprocess.
    Returns: {success, result, error, result_type}
    """
    # Write df to a temp CSV so subprocess can read it
    with tempfile.NamedTemporaryFile(suffix=".csv", delete=False, mode="w") as f:
        df.to_csv(f.name, index=False)
        csv_path = f.name

    # Wrap user code in a safe runner
    runner_code = f"""
import pandas as pd
import json
import numpy as np

df = pd.read_csv(r"{csv_path}")

# ── User code ──
{code}
# ── End user code ──

# Serialize result
if isinstance(result, pd.DataFrame):
    # Convert to JSON-serializable format
    print("__TYPE__:dataframe")
    print(result.to_json(orient="records"))
elif isinstance(result, (pd.Series,)):
    print("__TYPE__:dataframe")
    df_result = result.reset_index()
    df_result.columns = [str(c) for c in df_result.columns]
    print(df_result.to_json(orient="records"))
elif isinstance(result, (int, float, np.integer, np.floating)):
    print("__TYPE__:scalar")
    print(float(result))
else:
    print("__TYPE__:string")
    print(str(result))
"""

    with tempfile.NamedTemporaryFile(suffix=".py", delete=False, mode="w",encoding="utf-8") as f:
        f.write(runner_code)
        script_path = f.name

    try:
        proc = subprocess.run(
            [sys.executable, script_path],
            capture_output=True,
            text=True,
            encoding="utf-8",
            timeout=timeout,
        )       

        os.unlink(csv_path)
        os.unlink(script_path)

        if proc.returncode != 0:
            return {"success": False, "error": proc.stderr, "result": None, "result_type": None}

        output = proc.stdout.strip()
        lines = output.split("\n")

        result_type_line = lines[0] if lines else ""
        result_data = "\n".join(lines[1:]) if len(lines) > 1 else ""

        if "__TYPE__:dataframe" in result_type_line:
            data = json.loads(result_data)
            return {"success": True, "result": data, "result_type": "dataframe", "error": None}
        elif "__TYPE__:scalar" in result_type_line:
            return {"success": True, "result": float(result_data), "result_type": "scalar", "error": None}
        else:
            return {"success": True, "result": result_data, "result_type": "string", "error": None}

    except subprocess.TimeoutExpired:
        os.unlink(csv_path)
        os.unlink(script_path)
        return {"success": False, "error": "Code execution timed out (15s limit)", "result": None, "result_type": None}
    except Exception as e:
        return {"success": False, "error": str(e), "result": None, "result_type": None}


# ── Agent 4: Error Fixer ──────────────────────────────────────
ERROR_FIX_PROMPT = ChatPromptTemplate.from_template("""
You are an expert Python debugger.

Dataset Schema:
{schema}

Original Code:
{code}

Error Message:
{error}

User Question: {question}

Fix the code so it runs correctly.
Rules:
- The dataframe is already loaded as variable `df`
- Store final result in variable called `result`
- Do NOT import pandas or read files
- Return ONLY the fixed Python code, no explanation, no markdown
""")

def run_error_fixer(code: str, error: str, question: str,
                    schema: str, api_key: str) -> str:
    llm = get_llm(api_key)
    chain = ERROR_FIX_PROMPT | llm | StrOutputParser()
    fixed = chain.invoke({
        "code": code,
        "error": error,
        "question": question,
        "schema": schema,
    })
    return fixed.strip().replace("```python", "").replace("```", "").strip()


# ── Agent 5: Visualizer ───────────────────────────────────────
VIZ_PROMPT = ChatPromptTemplate.from_template("""
You are a data visualization expert.

User Question: {question}
Analysis Result Type: {result_type}
Chart Hint from Planner: {chart_hint}
Result Data (sample): {result_sample}

Decide the best chart type and format the data for Recharts.

Rules:
- Choose from: bar, line, pie, scatter, none
- For "none" when result is a single number or text
- dataKey is the field name for the Y axis value
- nameKey is the field name for the X axis / label

Respond in this EXACT JSON format (no markdown, no backticks):
{{
  "chart_type": "bar|line|pie|scatter|none",
  "x_key": "column name for x axis",
  "y_key": "column name for y axis / value",
  "title": "short chart title"
}}
""")

def run_visualizer(question: str, result_type: str, result,
                   chart_hint: str, api_key: str) -> dict:
    if result_type == "scalar" or result_type == "string":
        return {"chart_type": "none", "x_key": None, "y_key": None, "title": ""}

    llm = get_llm(api_key)
    chain = VIZ_PROMPT | llm | StrOutputParser()

    # give LLM a sample of the result
    result_sample = str(result[:3]) if isinstance(result, list) else str(result)[:300]

    raw = chain.invoke({
        "question": question,
        "result_type": result_type,
        "chart_hint": chart_hint,
        "result_sample": result_sample,
    })
    raw = raw.strip().replace("```json", "").replace("```", "").strip()
    try:
        return json.loads(raw)
    except Exception:
        return {"chart_type": "bar", "x_key": None, "y_key": None, "title": "Result"}


# ── Agent 6: Insight Narrator ─────────────────────────────────
NARRATOR_PROMPT = ChatPromptTemplate.from_template("""
You are a friendly data analyst explaining results to a non-technical user.

User Question: {question}
Analysis Result: {result}
Result Type: {result_type}

Write a clear, concise explanation (2-4 sentences) of what the data shows.
- Mention specific numbers/values from the result
- Point out the most important insight
- Use plain English, no technical jargon
- Do not say "based on the data" or "as you can see"
""")

def run_narrator(question: str, result, result_type: str, api_key: str) -> str:
    llm = get_llm(api_key)
    chain = NARRATOR_PROMPT | llm | StrOutputParser()
    result_str = str(result)[:1000]  # limit size
    return chain.invoke({
        "question": question,
        "result": result_str,
        "result_type": result_type,
    })


# ── Master Orchestrator ───────────────────────────────────────
def run_analysis(question: str, df: pd.DataFrame,
                 schema: str, sample: str, api_key: str) -> dict:
    """
    Runs all agents in sequence.
    Returns full result dict for the API to send to frontend.
    """
    # Agent 1: Plan
    plan = run_planner(question, schema, sample, api_key)

    # Agent 2: Generate code
    code = run_code_generator(
        question, schema, sample,
        plan.get("intent", question),
        plan.get("relevant_columns", []),
        api_key
    )

    # Agent 3: Execute
    exec_result = run_executor(code, df)

    # Agent 4: Fix if failed (max 2 retries)
    retries = 0
    while not exec_result["success"] and retries < 2:
        fixed_code = run_error_fixer(
            code, exec_result["error"], question, schema, api_key
        )
        exec_result = run_executor(fixed_code, df)
        code = fixed_code
        retries += 1

    if not exec_result["success"]:
        return {
            "success": False,
            "error": exec_result["error"],
            "insight": "I couldn't compute the answer due to an error in the code. Please try rephrasing your question.",
            "chart": None,
            "data": None,
            "code": code,
        }

    # Agent 5: Visualize
    viz = run_visualizer(
        question,
        exec_result["result_type"],
        exec_result["result"],
        plan.get("chart_hint", "bar"),
        api_key
    )

    # Agent 6: Narrate
    insight = run_narrator(
        question,
        exec_result["result"],
        exec_result["result_type"],
        api_key
    )

    return {
        "success": True,
        "error": None,
        "insight": insight,
        "chart": viz,
        "data": exec_result["result"],
        "data_type": exec_result["result_type"],
        "code": code,
        "plan": plan,
    }