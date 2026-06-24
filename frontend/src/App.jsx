import { useState, useRef, useEffect } from "react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from "recharts";

const API = "http://localhost:8000";
const COLORS = ["#185FA5", "#1D9E75", "#E27B4A", "#A32D2D", "#534AB7", "#BA7517"];

// ── Chart renderer ────────────────────────────────────────────
function ChartBlock({ chart, data }) {
  if (!chart || chart.chart_type === "none" || !data || !Array.isArray(data)) return null;

  const { chart_type, x_key, y_key, title } = chart;

  return (
    <div style={s.chartWrap}>
      <p style={s.chartTitle}>{title}</p>
      <ResponsiveContainer width="100%" height={260}>
        {chart_type === "bar" ? (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey={x_key} tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            <Bar dataKey={y_key} fill="#185FA5" radius={[4, 4, 0, 0]} />
          </BarChart>
        ) : chart_type === "line" ? (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey={x_key} tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey={y_key} stroke="#185FA5" strokeWidth={2} dot={{ r: 4 }} />
          </LineChart>
        ) : chart_type === "pie" ? (
          <PieChart>
            <Pie data={data} dataKey={y_key} nameKey={x_key} cx="50%" cy="50%" outerRadius={100} label>
              {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        ) : chart_type === "scatter" ? (
          <ScatterChart>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={x_key} name={x_key} tick={{ fontSize: 11 }} />
            <YAxis dataKey={y_key} name={y_key} tick={{ fontSize: 11 }} />
            <Tooltip cursor={{ strokeDasharray: "3 3" }} />
            <Scatter data={data} fill="#185FA5" />
          </ScatterChart>
        ) : null}
      </ResponsiveContainer>
    </div>
  );
}

// ── Data table ────────────────────────────────────────────────
function DataTable({ data }) {
  if (!data || !Array.isArray(data) || data.length === 0) return null;
  const cols = Object.keys(data[0]);
  return (
    <div style={s.tableWrap}>
      <table style={s.table}>
        <thead>
          <tr>{cols.map(c => <th key={c} style={s.th}>{c}</th>)}</tr>
        </thead>
        <tbody>
          {data.slice(0, 10).map((row, i) => (
            <tr key={i} style={{ background: i % 2 === 0 ? "#fff" : "#f9f9f9" }}>
              {cols.map(c => <td key={c} style={s.td}>{String(row[c] ?? "")}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      {data.length > 10 && (
        <p style={{ fontSize: 11, color: "#aaa", marginTop: 6 }}>
          Showing 10 of {data.length} rows
        </p>
      )}
    </div>
  );
}

// ── Message bubble ────────────────────────────────────────────
function MessageBubble({ msg }) {
  const [showCode, setShowCode] = useState(false);

  if (msg.role === "user") {
    return (
      <div style={{ ...s.msgRow, justifyContent: "flex-end" }}>
        <div style={s.bubbleWrap}>
          <div style={{ ...s.bubble, ...s.userBubble }}>{msg.content}</div>
          <span style={{ ...s.time, textAlign: "right" }}>You · {msg.time}</span>
        </div>
        <div style={{ ...s.avatar, background: "#185FA5", color: "#fff" }}>You</div>
      </div>
    );
  }

  return (
    <div style={{ ...s.msgRow, justifyContent: "flex-start" }}>
      <div style={s.avatar}>AI</div>
      <div style={{ ...s.bubbleWrap, maxWidth: "85%" }}>
        <div style={{
          ...s.bubble,
          ...(msg.success === false ? s.errorBubble : s.aiBubble)
        }}>
          {/* Insight text */}
          <p style={{ margin: 0, lineHeight: 1.6 }}>{msg.content}</p>

          {/* Scalar result */}
          {msg.data_type === "scalar" && msg.data !== undefined && (
            <div style={s.scalarBox}>
              {typeof msg.data === "number" ? msg.data.toLocaleString() : String(msg.data)}
            </div>
          )}

          {/* Chart */}
          {msg.chart && msg.chart.chart_type !== "none" && (
            <ChartBlock chart={msg.chart} data={msg.data} />
          )}

          {/* Table */}
          {msg.data_type === "dataframe" && (
            <DataTable data={msg.data} />
          )}

          {/* Code toggle */}
          {msg.code && (
            <div style={{ marginTop: 10 }}>
              <button onClick={() => setShowCode(v => !v)} style={s.codeToggle}>
                {showCode ? "Hide" : "Show"} generated code
              </button>
              {showCode && (
                <pre style={s.codeBlock}>{msg.code}</pre>
              )}
            </div>
          )}
        </div>
        <span style={{ ...s.time, textAlign: "left" }}>AI · {msg.time}</span>
      </div>
    </div>
  );
}

// ── Schema panel ──────────────────────────────────────────────
function SchemaPanel({ schema }) {
  if (!schema) return null;
  return (
    <div style={s.schemaPanel}>
      <p style={s.sideTitle}>Dataset Info</p>
      <p style={{ fontSize: 11, color: "#555", marginBottom: 6 }}>
        {schema.rows} rows · {schema.columns.length} columns
      </p>
      <div style={s.colList}>
        {schema.columns.map(c => (
          <span key={c} style={s.colPill}>{c}</span>
        ))}
      </div>
      <details style={{ marginTop: 10 }}>
        <summary style={{ fontSize: 11, color: "#888", cursor: "pointer" }}>
          Full schema
        </summary>
        <pre style={s.schemaPre}>{schema.schema_str}</pre>
      </details>
    </div>
  );
}

// ── Suggested questions ───────────────────────────────────────
const SUGGESTIONS = [
  "What are the top 5 values by highest count?",
  "Show me the distribution of the main numeric column",
  "What is the average value grouped by category?",
  "Which rows have the maximum value?",
  "Show me a summary of all columns",
];

// ── Main App ──────────────────────────────────────────────────
export default function App() {
  const [groqKey, setGroqKey] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState(null);
  const [isReady, setIsReady] = useState(false);
  const [schema, setSchema] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const bottomRef = useRef(null);
  const fileRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const getTime = () =>
    new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  // ── Upload ──────────────────────────────────────────────────
  const handleUpload = async () => {
    if (!file) return setUploadMsg({ type: "error", msg: "Select a CSV file first" });
    if (!groqKey.trim()) return setUploadMsg({ type: "error", msg: "Enter your Groq API key" });

    setUploading(true);
    setUploadMsg(null);
    setIsReady(false);
    setMessages([]);

    const form = new FormData();
    form.append("file", file);
    if (sessionId.trim()) form.append("session_id", sessionId.trim());

    try {
      const res = await fetch(`${API}/upload`, { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Upload failed");

      setSessionId(data.session_id);
      setIsReady(true);
      setUploadMsg({ type: "success", msg: `✓ ${data.filename} loaded — ${data.rows} rows, ${data.columns.length} columns` });

      // Fetch full schema
      const sr = await fetch(`${API}/schema/${data.session_id}`);
      const sd = await sr.json();
      setSchema(sd);

      setMessages([{
        role: "assistant",
        content: `I've loaded your dataset "${data.filename}" with ${data.rows} rows and ${data.columns.length} columns. Ask me anything about it!`,
        time: getTime(),
        success: true,
      }]);
    } catch (e) {
      setUploadMsg({ type: "error", msg: e.message });
    }
    setUploading(false);
  };

  // ── Send message ────────────────────────────────────────────
  const sendMessage = async (text) => {
    const question = text || input.trim();
    if (!question || loading || !isReady) return;

    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    setMessages(prev => [...prev, { role: "user", content: question, time: getTime() }]);
    setLoading(true);

    try {
      const res = await fetch(`${API}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          question,
          groq_api_key: groqKey,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Analysis failed");

      setMessages(prev => [...prev, {
        role: "assistant",
        content: data.insight,
        time: getTime(),
        success: data.success,
        chart: data.chart,
        data: data.data,
        data_type: data.data_type,
        code: data.code,
      }]);
    } catch (e) {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: `⚠ ${e.message}`,
        time: getTime(),
        success: false,
      }]);
    }
    setLoading(false);
  };

  // ── Clear ───────────────────────────────────────────────────
  const clearAll = async () => {
    if (sessionId) {
      await fetch(`${API}/session/${sessionId}`, { method: "DELETE" }).catch(() => {});
    }
    setMessages([]);
    setFile(null);
    setIsReady(false);
    setSessionId("");
    setUploadMsg(null);
    setSchema(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const handleTextarea = (e) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
  };

  // ── Render ──────────────────────────────────────────────────
  return (
    <div style={s.root}>
      {/* Sidebar */}
      <aside style={{ ...s.sidebar, width: sidebarOpen ? 280 : 0 }}>
        <div style={s.sideInner}>
          <p style={s.sideTitle}>⚙ Settings</p>

          <div style={s.field}>
            <label style={s.label}>Groq API Key</label>
            <input type="password" value={groqKey}
              onChange={e => setGroqKey(e.target.value)}
              placeholder="gsk_..." style={s.input} />
            <p style={s.hint}>
              Free at <a href="https://console.groq.com" target="_blank" rel="noreferrer" style={{ color: "#185FA5" }}>console.groq.com</a>
            </p>
          </div>

          <div style={s.divider} />
          <p style={s.sideTitle}>📁 Data</p>

          <div style={s.field}>
            <label style={s.label}>Upload CSV / Excel</label>
            <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls"
              onChange={e => { setFile(e.target.files[0]); setIsReady(false); setUploadMsg(null); }}
              style={{ display: "none" }} id="fileInput" />
            <label htmlFor="fileInput" style={s.fileLabel}>
              {file ? `📄 ${file.name}` : "Click to select file"}
            </label>
          </div>

          <button onClick={handleUpload}
            disabled={uploading || !file || !groqKey}
            style={{ ...s.uploadBtn, opacity: uploading || !file || !groqKey ? 0.5 : 1 }}>
            {uploading ? "Processing..." : "Analyse Dataset"}
          </button>

          {uploadMsg && (
            <div style={{
              ...s.statusBox,
              background: uploadMsg.type === "success" ? "#f0fdf4" : "#fff5f5",
              borderColor: uploadMsg.type === "success" ? "#86efac" : "#fca5a5",
              color: uploadMsg.type === "success" ? "#166534" : "#991b1b",
            }}>{uploadMsg.msg}</div>
          )}

          {/* Schema info */}
          {schema && <SchemaPanel schema={schema} />}

          {isReady && (
            <button onClick={clearAll} style={s.clearBtn}>
              🗑 Clear & Start Over
            </button>
          )}
        </div>
      </aside>

      {/* Main */}
      <div style={s.main}>
        {/* Topbar */}
        <div style={s.topbar}>
          <div style={s.topLeft}>
            <button onClick={() => setSidebarOpen(v => !v)} style={s.iconBtn}>☰</button>
            <span style={s.appTitle}>🤖 Autonomous Data Analyst</span>
            {isReady && <span style={s.readyPill}>● Ready</span>}
          </div>
          <div style={s.topRight}>
            {isReady && schema && (
              <span style={s.pill}>{schema.rows} rows · {schema.columns.length} cols</span>
            )}
          </div>
        </div>

        {/* Chat area */}
        <div style={s.chatArea}>
          {/* Empty state */}
          {!isReady && messages.length === 0 && (
            <div style={s.empty}>
              <div style={{ fontSize: 48 }}>📊</div>
              <p style={s.emptyTitle}>Autonomous Data Analyst</p>
              <p style={s.emptySub}>
                Upload a CSV or Excel file, then ask questions in plain English.<br />
                The AI will write code, run it, fix errors, and explain insights automatically.
              </p>
              <div style={s.featureGrid}>
                {["📈 Auto charts", "🔍 Plain English queries", "🔧 Self-healing code",
                  "📋 Data tables", "💡 AI insights", "🐍 See generated code"].map(f => (
                  <div key={f} style={s.featureItem}>{f}</div>
                ))}
              </div>
            </div>
          )}

          {/* Suggested questions */}
          {isReady && messages.length === 1 && (
            <div style={s.suggestions}>
              <p style={{ fontSize: 12, color: "#888", marginBottom: 8 }}>Try asking:</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {SUGGESTIONS.map(q => (
                  <button key={q} onClick={() => sendMessage(q)} style={s.suggBtn}>
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          {messages.map((msg, i) => <MessageBubble key={i} msg={msg} />)}

          {/* Loading */}
          {loading && (
            <div style={{ ...s.msgRow, justifyContent: "flex-start" }}>
              <div style={s.avatar}>AI</div>
              <div style={s.bubbleWrap}>
                <div style={{ ...s.bubble, ...s.aiBubble }}>
                  <div style={s.thinkingWrap}>
                    <div style={s.thinkingDots}>
                      <span style={{ ...s.dot, animationDelay: "0s" }} />
                      <span style={{ ...s.dot, animationDelay: "0.2s" }} />
                      <span style={{ ...s.dot, animationDelay: "0.4s" }} />
                    </div>
                    <span style={{ fontSize: 12, color: "#888" }}>
                      Planning → Generating code → Executing → Narrating...
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input bar */}
        <div style={s.inputBar}>
          {!isReady && (
            <div style={s.warningBanner}>
              ⚠ Upload and process a dataset first
            </div>
          )}
          <div style={s.inputRow}>
            <textarea ref={textareaRef} value={input}
              onChange={handleTextarea} onKeyDown={handleKey}
              placeholder={isReady ? "Ask anything about your data... (Enter to send)" : "Upload data to start"}
              style={{ ...s.textarea, opacity: isReady ? 1 : 0.5 }}
              disabled={!isReady || loading} rows={1} />
            <button onClick={() => sendMessage()}
              disabled={!isReady || loading || !input.trim()}
              style={{ ...s.sendBtn, opacity: !isReady || loading || !input.trim() ? 0.4 : 1 }}>
              ➤
            </button>
          </div>
        </div>
      </div>

      {/* Dot animation style */}
      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-6px); }
        }
      `}</style>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────
const s = {
  root: { display: "flex", height: "100vh", fontFamily: "'Segoe UI', system-ui, sans-serif", background: "#f8f8f8", overflow: "hidden" },
  sidebar: { background: "#fff", borderRight: "1px solid #eee", transition: "width 0.2s", flexShrink: 0, overflowY: "auto" },
  sideInner: { width: 280, padding: "18px 16px", display: "flex", flexDirection: "column", gap: 0, height: "100vh", overflowY: "auto",boxSizing: "border-box", },
  sideTitle: { fontSize: 11, fontWeight: 700, color: "#aaa", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12 },
  field: { marginBottom: 14 },
  label: { display: "block", fontSize: 12, color: "#555", marginBottom: 5, fontWeight: 500 },
  hint: { fontSize: 10, color: "#aaa", marginTop: 3 },
  input: { width: "100%", height: 34, padding: "0 10px", fontSize: 13, border: "1px solid #e5e5e5", borderRadius: 8, background: "#fafafa", color: "#111", outline: "none", boxSizing: "border-box" },
  divider: { height: 1, background: "#f0f0f0", margin: "8px 0 14px" },
  fileLabel: { display: "block", padding: "9px 12px", border: "1.5px dashed #d0d0d0", borderRadius: 8, fontSize: 12, color: "#555", cursor: "pointer", textAlign: "center", background: "#fafafa" },
  uploadBtn: { width: "100%", padding: "10px 0", background: "#185FA5", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: "pointer", marginBottom: 10 },
  statusBox: { padding: "8px 10px", border: "1px solid", borderRadius: 8, fontSize: 11, lineHeight: 1.5, marginBottom: 10 },
  clearBtn: { width: "100%", padding: "8px 0", background: "#fff", color: "#c00", border: "1px solid #fca5a5", borderRadius: 8, fontSize: 12, cursor: "pointer", marginTop: "auto" },
  schemaPanel: { background: "#f9f9f9", borderRadius: 8, padding: "10px 12px", marginTop: 10 },
  colList: { display: "flex", flexWrap: "wrap", gap: 4 },
  colPill: { fontSize: 10, padding: "2px 7px", background: "#EEF4FF", color: "#185FA5", borderRadius: 10, fontFamily: "monospace" },
  schemaPre: { fontSize: 10, color: "#555", marginTop: 6, whiteSpace: "pre-wrap", lineHeight: 1.5 },
  main: { flex: 1, display: "flex", flexDirection: "column", minWidth: 0 },
  topbar: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", background: "#fff", borderBottom: "1px solid #eee" },
  topLeft: { display: "flex", alignItems: "center", gap: 10 },
  topRight: { display: "flex", gap: 6 },
  appTitle: { fontSize: 15, fontWeight: 600, color: "#111" },
  readyPill: { fontSize: 11, color: "#16a34a", fontWeight: 500 },
  pill: { fontSize: 11, padding: "3px 10px", borderRadius: 20, background: "#EEF4FF", color: "#185FA5", fontWeight: 500 },
  iconBtn: { background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#666" },
  chatArea: { flex: 1, overflowY: "auto", padding: "20px 16px", display: "flex", flexDirection: "column", gap: 16 },
  empty: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 12, textAlign: "center" },
  emptyTitle: { fontSize: 20, fontWeight: 600, color: "#222", margin: 0 },
  emptySub: { fontSize: 13, color: "#888", lineHeight: 1.8, margin: 0, maxWidth: 420 },
  featureGrid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 8 },
  featureItem: { padding: "8px 12px", background: "#fff", border: "1px solid #eee", borderRadius: 8, fontSize: 12, color: "#444" },
  suggestions: { background: "#f9f9f9", border: "1px solid #eee", borderRadius: 10, padding: "12px 14px" },
  suggBtn: { fontSize: 12, padding: "5px 12px", border: "1px solid #d0d0d0", borderRadius: 20, background: "#fff", color: "#333", cursor: "pointer" },
  msgRow: { display: "flex", alignItems: "flex-start", gap: 8 },
  avatar: { width: 30, height: 30, borderRadius: "50%", background: "#eee", color: "#666", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 600, flexShrink: 0, marginTop: 2 },
  bubbleWrap: { maxWidth: "80%", display: "flex", flexDirection: "column", gap: 3 },
  bubble: { padding: "12px 16px", borderRadius: 16, fontSize: 14, lineHeight: 1.6, wordBreak: "break-word" },
  userBubble: { background: "#185FA5", color: "#fff", borderBottomRightRadius: 4 },
  aiBubble: { background: "#fff", color: "#111", border: "1px solid #eee", borderBottomLeftRadius: 4 },
  errorBubble: { background: "#fff5f5", color: "#c00", border: "1px solid #fdd", borderBottomLeftRadius: 4 },
  time: { fontSize: 10, color: "#bbb" },
  scalarBox: { marginTop: 10, padding: "12px 16px", background: "#EEF4FF", borderRadius: 10, fontSize: 28, fontWeight: 700, color: "#185FA5", textAlign: "center" },
  chartWrap: { marginTop: 14, padding: "12px 0 4px" },
  chartTitle: { fontSize: 12, fontWeight: 500, color: "#555", marginBottom: 8 },
  tableWrap: { marginTop: 12, overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 12 },
  th: { padding: "6px 10px", background: "#f5f5f5", textAlign: "left", fontWeight: 500, color: "#555", borderBottom: "1px solid #eee", whiteSpace: "nowrap" },
  td: { padding: "5px 10px", borderBottom: "1px solid #f5f5f5", color: "#333" },
  codeToggle: { fontSize: 11, padding: "3px 10px", border: "1px solid #ddd", borderRadius: 6, background: "#f9f9f9", color: "#666", cursor: "pointer", marginTop: 6 },
  codeBlock: { background: "#1e1e1e", color: "#d4d4d4", padding: "12px 14px", borderRadius: 8, fontSize: 11, overflowX: "auto", marginTop: 6, lineHeight: 1.6, whiteSpace: "pre-wrap" },
  thinkingWrap: { display: "flex", alignItems: "center", gap: 10 },
  thinkingDots: { display: "flex", gap: 4 },
  dot: { width: 7, height: 7, borderRadius: "50%", background: "#185FA5", display: "inline-block", animation: "bounce 1.2s infinite ease-in-out" },
  inputBar: { padding: "12px 16px", background: "#fff", borderTop: "1px solid #eee" },
  warningBanner: { fontSize: 12, color: "#92400e", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "6px 12px", marginBottom: 8, textAlign: "center" },
  inputRow: { display: "flex", gap: 8, alignItems: "flex-end" },
  textarea: { flex: 1, padding: "9px 14px", fontSize: 14, border: "1px solid #e5e5e5", borderRadius: 12, background: "#fafafa", color: "#111", resize: "none", outline: "none", fontFamily: "inherit", lineHeight: 1.5, minHeight: 38, maxHeight: 120 },
  sendBtn: { width: 38, height: 38, borderRadius: "50%", background: "#185FA5", color: "#fff", border: "none", cursor: "pointer", fontSize: 16, flexShrink: 0 },
};