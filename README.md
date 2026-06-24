# 🤖 Autonomous Data Analyst

Upload any CSV → ask questions in plain English → AI writes code, runs it, fixes errors, charts results, explains insights.

## 🎥 Demo

[![Watch Demo](https://img.shields.io/badge/Watch%20Demo-Loom-purple?style=for-the-badge&logo=loom)](https://www.loom.com/share/ecbe8e56b56e452aa838ad49ea630b59)

> Click the badge above to watch a full walkthrough of the app in action.

---

## Tech Stack

- **Frontend**: React + Vite + Recharts
- **Backend**: FastAPI + Uvicorn
- **Agents**: LangChain (6 sequential agents)
- **LLM**: Groq (llama-3.3-70b) — free
- **Embeddings**: HuggingFace all-MiniLM-L6-v2 — free
- **Vector Store**: ChromaDB

---

## Agent Pipeline

1. **Query Planner** — understands intent, picks relevant columns
2. **Code Generator** — writes Pandas code
3. **Executor** — runs code safely via subprocess
4. **Error Fixer** — auto-retries if code fails (up to 2 times)
5. **Visualizer** — picks chart type, formats for Recharts
6. **Insight Narrator** — explains result in plain English

---

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

---

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

---

## Get Free API Keys

- **Groq**: https://console.groq.com → free, no credit card
- **LangSmith**: https://smith.langchain.com → free tier
- **HuggingFace**: https://huggingface.co/settings/tokens → free

---

## Deploy

### Backend → Render

1. Push to GitHub
2. Go to render.com → New Web Service
3. Connect your repo
4. Set build command: `pip install -r backend/requirements.txt`
5. Set start command: `cd backend && uvicorn main:app --host 0.0.0.0 --port $PORT`
6. Add environment variables from `.env.example`

> ⚠️ **Known Issue — Render Free Tier OOM Crash**: The HuggingFace embedding model (`all-MiniLM-L6-v2`) loads ~400MB+ into RAM, which exceeds Render's free tier limit of 512MB. The app crashes with `Out of memory (used over 512Mi)` shortly after startup. **Fix**: Switch embeddings to use the HuggingFace Inference API instead of loading the model locally, or upgrade to Render's Starter plan ($7/month) for 2GB RAM. The app works perfectly in local setup.

### Frontend → Vercel

1. Go to vercel.com → New Project
2. Connect your repo, set root to `frontend/`
3. Change `API` in `App.jsx` from `http://localhost:8000` to your Render URL
4. Deploy

---

## Known Limitations

| Issue | Cause | Workaround |
|-------|-------|------------|
| Render free tier OOM crash | HuggingFace model (~400MB) exceeds 512MB RAM limit | Run locally or upgrade Render plan |
| Render cold starts (~30s delay) | Free tier spins down after 15 mins of inactivity | Expected on free tier; first request is slow |
| ChromaDB not persistent on Render | Free tier has no persistent disk | Vector store resets on each deploy |

> The app runs fully and correctly in local development. All limitations are specific to free-tier cloud hosting constraints.

---

## What to Ask

- "Which product had the highest sales?"
- "Show me monthly revenue trend"
- "What is the average order value by region?"
- "Which customers made the most purchases?"
- "Show distribution of prices"
- "Find all rows where quantity is above 100"
