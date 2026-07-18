import { useState } from "react";
import { todayStr } from "../lib/dates";

// "One thing I learned today" — a single line per day, kept deliberately
// small so it never feels like homework.
export default function LearnedCard({ til, onSave }) {
  const tk = todayStr();
  const [text, setText] = useState(til[tk] || "");
  const [showLog, setShowLog] = useState(false);
  const saved = til[tk] === text && !!text;

  const recent = Object.entries(til)
    .filter(([k]) => k !== tk)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 7);

  const save = () => { if (text.trim()) onSave(tk, text.trim()); };

  return (
    <div className="feature-card" style={{ background: "#FBF4EA", border: "0.5px solid #EBD9BE" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: "#8A6430" }}>Today I learned</div>
        <div style={{ fontSize: 11, color: "#B8935E" }}>{Object.keys(til).length} entries</div>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === "Enter" && save()} onBlur={save}
          placeholder="One thing you learned today…"
          style={{ flex: 1, border: "0.5px solid #EBD9BE", borderRadius: 8, padding: "7px 10px", fontSize: 13, background: "white", color: "#1a1a1a", outline: "none", fontFamily: "inherit", minWidth: 0 }} />
        <button onClick={save} disabled={!text.trim() || saved}
          style={{ border: "none", borderRadius: 8, padding: "7px 12px", fontSize: 12, fontWeight: 500, cursor: text.trim() && !saved ? "pointer" : "default", background: saved ? "transparent" : "#D9A85E", color: saved ? "#B8935E" : "white", flexShrink: 0 }}>
          {saved ? "Saved ✓" : "Save"}
        </button>
      </div>
      {recent.length > 0 && (
        <button className="link-btn" style={{ color: "#B8935E", marginTop: 8 }} onClick={() => setShowLog(s => !s)}>
          {showLog ? "hide recent" : "show recent"}
        </button>
      )}
      {showLog && (
        <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
          {recent.map(([k, v]) => (
            <div key={k} style={{ fontSize: 12, color: "#6b5a3e", lineHeight: 1.5 }}>
              <span style={{ color: "#B8935E", fontWeight: 500, marginRight: 6 }}>{k.slice(5)}</span>{v}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
