# 🤖 Autonomous Data Analyst

Upload any CSV → ask questions in plain English → AI writes code, runs it, fixes errors, charts results, explains insights.

## Tech Stack
- **Frontend**: React + Vite + Recharts
- **Backend**: FastAPI + Uvicorn
- **Agents**: LangChain (6 sequential agents)
- **LLM**: Groq (llama-3.3-70b) — free
- **Embeddings**: HuggingFace all-MiniLM-L6-v2 — free
- **Vector Store**: ChromaDB

## Agent Pipeline
1. **Query Planner** — understands intent, picks relevant columns
2. **Code Generator** — writes Pandas code
3. **Executor** — runs code safely via subprocess
4. **Error Fixer** — auto-retries if code fails (up to 2 times)
5. **Visualizer** — picks chart type, formats for Recharts
6. **Insight Narrator** — explains result in plain English

## Project Structure
```
data-analyst/
├── backend/
│   ├── main.py          ← FastAPI routes
│   ├── agents.py        ← All 6 agent chains
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── App.jsx      ← Complete React UI
│   │   └── main.jsx
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── render.yaml          ← Render deploy config
└── README.md
```

## Local Setup

### Backend
```bash
cd backend
pip install -r requirements.txt
cp .env.example .env
# Fill in your keys in .env
python main.py
# Runs on http://localhost:8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
# Runs on http://localhost:3000
```

## Get Free API Keys
- **Groq**: https://console.groq.com → free, no credit card
- **LangSmith**: https://smith.langchain.com → free tier
- **HuggingFace**: https://huggingface.co/settings/tokens → free

## Deploy

### Backend → Render
1. Push to GitHub
2. Go to render.com → New Web Service
3. Connect your repo
4. Set build command: `pip install -r backend/requirements.txt`
5. Set start command: `cd backend && uvicorn main:app --host 0.0.0.0 --port $PORT`
6. Add environment variables from .env.example

### Frontend → Vercel
1. Go to vercel.com → New Project
2. Connect your repo, set root to `frontend/`
3. Change `API` in App.jsx from `http://localhost:8000` to your Render URL
4. Deploy

## What to Ask
- "Which product had the highest sales?"
- "Show me monthly revenue trend"
- "What is the average order value by region?"
- "Which customers made the most purchases?"
- "Show distribution of prices"
- "Find all rows where quantity is above 100"