"""
FastAPI backend for Autonomous Data Analyst
Routes:
  POST /upload       — upload CSV, extract schema, build vector context
  POST /chat         — ask a question, run all agents, return result
  GET  /history/{id} — get chat history for a session
  GET  /schema/{id}  — get schema info for a session
  DELETE /session/{id} — clear session
"""

import os
import traceback
import uuid
import json
import shutil
from typing import Optional, List

import pandas as pd
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

from langchain_huggingface import HuggingFaceEmbeddings
from langchain_chroma import Chroma
from langchain_core.documents import Document

from agents import run_analysis

load_dotenv()

# ── App setup ─────────────────────────────────────────────────
app = FastAPI(title="Autonomous Data Analyst API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173", "*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Global state ──────────────────────────────────────────────
# Load embeddings once at startup
print("Loading embeddings model...")
embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
print("Embeddings ready.")

UPLOAD_DIR = "uploaded_csvs"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# session_id → {df, schema_str, sample_str, vectorstore, history}
session_store: dict = {}


# ── Helpers ───────────────────────────────────────────────────
def extract_schema(df: pd.DataFrame) -> str:
    lines = ["Columns and their data types:"]
    for col in df.columns:
        dtype = str(df[col].dtype)
        n_unique = df[col].nunique()
        lines.append(f"  - {col}: {dtype} ({n_unique} unique values)")
    lines.append(f"\nTotal rows: {len(df)}")
    lines.append(f"Total columns: {len(df.columns)}")
    return "\n".join(lines)


def extract_sample(df: pd.DataFrame) -> str:
    return df.head(3).to_string(index=False)


def build_vector_context(df: pd.DataFrame, session_id: str):
    """Store schema + column info in Chroma for RAG context."""
    docs = []

    # Full schema doc
    docs.append(Document(
        page_content=extract_schema(df),
        metadata={"type": "schema", "session": session_id}
    ))

    # Per-column statistics
    for col in df.columns:
        col_info = f"Column: {col}\nType: {df[col].dtype}"
        if df[col].dtype in ["object", "string"]:
            top_vals = df[col].value_counts().head(5).to_dict()
            col_info += f"\nTop values: {top_vals}"
        else:
            col_info += f"\nMin: {df[col].min()}, Max: {df[col].max()}, Mean: {df[col].mean():.2f}"
        docs.append(Document(
            page_content=col_info,
            metadata={"type": "column", "column": col, "session": session_id}
        ))

    # Sample rows
    docs.append(Document(
        page_content=f"Sample rows:\n{df.head(5).to_string(index=False)}",
        metadata={"type": "sample", "session": session_id}
    ))

    vectorstore = Chroma.from_documents(documents=docs, embedding=embeddings)
    return vectorstore


# ── Pydantic models ───────────────────────────────────────────
class ChatRequest(BaseModel):
    session_id: str
    question: str
    groq_api_key: str


class ChatMessage(BaseModel):
    role: str       # "user" | "assistant"
    content: str
    chart: Optional[dict] = None
    data: Optional[list] = None
    data_type: Optional[str] = None
    code: Optional[str] = None
    success: bool = True


class UploadResponse(BaseModel):
    session_id: str
    message: str
    filename: str
    rows: int
    columns: List[str]
    schema_preview: str


class SchemaResponse(BaseModel):
    columns: List[str]
    schema_str: str
    sample: str
    rows: int


# ── Routes ────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"status": "running", "message": "Autonomous Data Analyst API"}


@app.post("/upload", response_model=UploadResponse)
async def upload_csv(
    file: UploadFile = File(...),
    session_id: Optional[str] = Form(None),
):
    """Upload a CSV file and prepare it for analysis."""
    allowed = [".csv", ".xlsx", ".xls"]
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in allowed:
        raise HTTPException(status_code=400, detail="Only CSV and Excel files are supported")

    sid = session_id or str(uuid.uuid4())

    # Save file
    session_dir = os.path.join(UPLOAD_DIR, sid)
    os.makedirs(session_dir, exist_ok=True)
    file_path = os.path.join(session_dir, file.filename)

    with open(file_path, "wb") as f:
        content = await file.read()
        f.write(content)

    # Load into pandas
    try:
        if ext == ".csv":
            df = pd.read_csv(file_path)
        else:
            df = pd.read_excel(file_path)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not read file: {str(e)}")

    # Clean column names
    df.columns = [str(c).strip().replace(" ", "_").lower() for c in df.columns]

    # Extract schema and sample
    schema_str = extract_schema(df)
    sample_str = extract_sample(df)

    # Build vector context
    vectorstore = build_vector_context(df, sid)

    # Store in session
    session_store[sid] = {
        "df": df,
        "schema_str": schema_str,
        "sample_str": sample_str,
        "vectorstore": vectorstore,
        "history": [],
        "filename": file.filename,
    }

    return UploadResponse(
        session_id=sid,
        message=f"File uploaded and processed successfully.",
        filename=file.filename,
        rows=len(df),
        columns=list(df.columns),
        schema_preview=schema_str,
    )


@app.post("/chat")
def chat(req: ChatRequest):
    """Run all agents and return analysis result."""
    if req.session_id not in session_store:
        raise HTTPException(
            status_code=404,
            detail="Session not found. Please upload a CSV first."
        )

    if not req.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty")

    session = session_store[req.session_id]
    df = session["df"]
    schema_str = session["schema_str"]
    sample_str = session["sample_str"]

    # Save user message to history
    session["history"].append({"role": "user", "content": req.question})

    # Run all agents
    try:
        result = run_analysis(
            question=req.question,
            df=df,
            schema=schema_str,
            sample=sample_str,
            api_key=req.groq_api_key,
        )
    except Exception as e:
        print(traceback.format_exc())
        raise HTTPException(
            status_code=500,
            detail=f"Analysis failed: {str(e)}"
        )

    # Save assistant response to history
    session["history"].append({
        "role": "assistant",
        "content": result["insight"],
        "success": result["success"],
        "chart": result.get("chart"),
        "data": result.get("data"),
        "data_type": result.get("data_type"),
        "code": result.get("code"),
    })

    return {
        "success": result["success"],
        "insight": result["insight"],
        "chart": result.get("chart"),
        "data": result.get("data"),
        "data_type": result.get("data_type"),
        "code": result.get("code"),
        "plan": result.get("plan"),
        "error": result.get("error"),
    }


@app.get("/history/{session_id}")
def get_history(session_id: str):
    """Get full conversation history for a session."""
    if session_id not in session_store:
        return []
    return session_store[session_id]["history"]


@app.get("/schema/{session_id}", response_model=SchemaResponse)
def get_schema(session_id: str):
    """Get schema details for a session."""
    if session_id not in session_store:
        raise HTTPException(status_code=404, detail="Session not found")
    session = session_store[session_id]
    df = session["df"]
    return SchemaResponse(
        columns=list(df.columns),
        schema_str=session["schema_str"],
        sample=session["sample_str"],
        rows=len(df),
    )


@app.delete("/session/{session_id}")
def clear_session(session_id: str):
    """Delete session data and uploaded files."""
    session_store.pop(session_id, None)
    session_dir = os.path.join(UPLOAD_DIR, session_id)
    if os.path.exists(session_dir):
        shutil.rmtree(session_dir)
    return {"message": f"Session {session_id} cleared successfully"}


if __name__ == "__main__":
    import uvicorn
    