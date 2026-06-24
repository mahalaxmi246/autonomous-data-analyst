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

## Known Limitations

| Issue | Cause | Workaround |
|-------|-------|------------|
| Render free tier OOM crash | HuggingFace model (~400MB) exceeds 512MB RAM limit | Run locally or upgrade Render plan |
| Render cold starts (~30s delay) | Free tier spins down after 15 mins of inactivity | Expected on free tier; first request is slow |
| ChromaDB not persistent on Render | Free tier has no persistent disk | Vector store resets on each deploy |

> The app runs fully and correctly in local development. All limitations are specific to free-tier cloud hosting constraints.

---

