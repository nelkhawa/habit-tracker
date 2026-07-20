import { useState } from "react";
import { PALETTE, makeHabitId } from "../lib/habits";
import { parseImport } from "../lib/vocab";
import { getSyncConfig, enableSync, connectSync, disableSync } from "../lib/sync";

// Settings panel: edit habits, coach context for the AI analysis, vocabulary
// list, and data export/import. Everything persists to localStorage.
export default function Settings({ habits, onHabitsChange, coachContext, onCoachChange, words, onWordsChange, onClose }) {
  const [newLabel, setNewLabel] = useState("");
  const [importText, setImportText] = useState("");
  const [importMsg, setImportMsg] = useState("");
  const [showWords, setShowWords] = useState(false);
  const [syncCfg, setSyncCfg] = useState(getSyncConfig);
  const [connectCode, setConnectCode] = useState("");
  const [syncMsg, setSyncMsg] = useState("");
  const [syncBusy, setSyncBusy] = useState(false);

  const startSync = async () => {
    setSyncBusy(true); setSyncMsg("");
    try { await enableSync(); setSyncCfg(getSyncConfig()); setSyncMsg("Sync enabled — enter this code on your other devices."); }
    catch (err) { disableSync(); setSyncMsg(`Couldn't enable sync: ${err.message}`); }
    setSyncBusy(false);
  };

  const joinSync = async () => {
    setSyncBusy(true); setSyncMsg("");
    try {
      const r = await connectSync(connectCode);
      if (r.status === "applied") { window.location.reload(); return; }
      setSyncCfg(getSyncConfig()); setSyncMsg("Connected. This device's data is now the shared copy.");
    } catch (err) { disableSync(); setSyncMsg(`Couldn't connect: ${err.message}`); }
    setSyncBusy(false);
  };

  const update = (id, patch) => onHabitsChange(habits.map(h => h.id === id ? { ...h, ...patch } : h));
  const move = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= habits.length) return;
    const next = [...habits];
    [next[i], next[j]] = [next[j], next[i]];
    onHabitsChange(next);
  };
  const cycleColor = h => {
    const i = PALETTE.findIndex(p => p.color === h.color);
    const next = PALETTE[(i + 1) % PALETTE.length];
    update(h.id, { color: next.color, bg: next.bg });
  };
  const addHabit = () => {
    const label = newLabel.trim();
    if (!label) return;
    const pal = PALETTE[habits.length % PALETTE.length];
    onHabitsChange([...habits, { id: makeHabitId(label, habits), label, weekly: false, ...pal }]);
    setNewLabel("");
  };

  const importWords = () => {
    const added = parseImport(importText, words);
    if (!added.length) { setImportMsg("No new words found — use one line per word: word | definition | example"); return; }
    onWordsChange([...words, ...added]);
    setImportText("");
    setImportMsg(`Added ${added.length} word${added.length > 1 ? "s" : ""}.`);
  };

  const exportData = () => {
    const data = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith("ht_")) data[k] = localStorage.getItem(k);
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `habit-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importData = e => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!confirm("Restore this backup? It will overwrite your current data.")) return;
        for (const [k, v] of Object.entries(data)) if (k.startsWith("ht_")) localStorage.setItem(k, v);
        location.reload();
      } catch { alert("That file doesn't look like a valid backup."); }
    };
    reader.readAsText(file);
  };

  const section = { fontSize: 11, fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase", color: "#888", margin: "18px 0 8px" };
  const input = { border: "0.5px solid #ddd", borderRadius: 8, padding: "6px 10px", fontSize: 13, fontFamily: "inherit", outline: "none", background: "white", color: "#1a1a1a" };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 16, fontWeight: 500, color: "#1a1a1a" }}>Settings</div>
          <button className="ghost-btn" onClick={onClose}>Done</button>
        </div>

        <div style={section}>Habits</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {habits.map((h, i) => (
            <div key={h.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ display: "flex", flexDirection: "column", flexShrink: 0 }}>
                <button onClick={() => move(i, -1)} disabled={i === 0} title="Move up"
                  style={{ border: "none", background: "none", cursor: i === 0 ? "default" : "pointer", color: i === 0 ? "#ddd" : "#888", fontSize: 9, padding: "0 2px", lineHeight: 1.2 }}>▲</button>
                <button onClick={() => move(i, 1)} disabled={i === habits.length - 1} title="Move down"
                  style={{ border: "none", background: "none", cursor: i === habits.length - 1 ? "default" : "pointer", color: i === habits.length - 1 ? "#ddd" : "#888", fontSize: 9, padding: "0 2px", lineHeight: 1.2 }}>▼</button>
              </div>
              <button onClick={() => cycleColor(h)} title="Change color"
                style={{ width: 18, height: 18, borderRadius: 5, background: h.color, border: "none", cursor: "pointer", flexShrink: 0 }} />
              <input style={{ ...input, flex: 1, minWidth: 0 }} value={h.label} onChange={e => update(h.id, { label: e.target.value })} />
              <button onClick={() => update(h.id, { weekly: !h.weekly })} className="mini-btn"
                style={{ background: h.weekly ? h.bg : "transparent", color: h.weekly ? h.color : "#aaa", border: `0.5px solid ${h.weekly ? h.color : "#ddd"}`, width: 62 }}>
                {h.weekly ? "weekly" : "daily"}
              </button>
              <button onClick={() => confirm(`Remove "${h.label}"? Its history stays saved and comes back if you re-add it.`) && onHabitsChange(habits.filter(x => x.id !== h.id))}
                className="mini-btn" style={{ background: "transparent", color: "#c77", border: "none" }}>✕</button>
            </div>
          ))}
          <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
            <input style={{ ...input, flex: 1 }} placeholder="New habit…" value={newLabel}
              onChange={e => setNewLabel(e.target.value)} onKeyDown={e => e.key === "Enter" && addHabit()} />
            <button className="ghost-btn" onClick={addHabit}>Add</button>
          </div>
        </div>
        <div style={{ fontSize: 11, color: "#aaa", marginTop: 6, lineHeight: 1.5 }}>
          Weekly habits show daily checkboxes but stats count weeks. Data is keyed by habit, so renaming is safe.
        </div>

        <div style={section}>Coach context (for AI analysis)</div>
        <textarea value={coachContext} onChange={e => onCoachChange(e.target.value)}
          placeholder="Tell the coach who you are and what these habits are for — goals, projects, what's at stake. The analysis uses this to judge what matters."
          style={{ ...input, width: "100%", minHeight: 70, resize: "vertical", boxSizing: "border-box", lineHeight: 1.5 }} />

        <div style={section}>Vocabulary ({words.length} words)</div>
        <textarea value={importText} onChange={e => { setImportText(e.target.value); setImportMsg(""); }}
          placeholder={"Paste words, one per line:\nword | definition | example sentence"}
          style={{ ...input, width: "100%", minHeight: 70, resize: "vertical", boxSizing: "border-box", lineHeight: 1.5 }} />
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6 }}>
          <button className="ghost-btn" onClick={importWords}>Import words</button>
          {words.length > 0 && (
            <button className="link-btn" style={{ color: "#888" }} onClick={() => setShowWords(s => !s)}>
              {showWords ? "hide list" : "show list"}
            </button>
          )}
          <span style={{ fontSize: 12, color: "#5BA898" }}>{importMsg}</span>
        </div>
        {showWords && (
          <div style={{ maxHeight: 180, overflowY: "auto", marginTop: 8, display: "flex", flexDirection: "column", gap: 3 }}>
            {words.map(w => (
              <div key={w.id} style={{ display: "flex", alignItems: "baseline", gap: 8, fontSize: 12 }}>
                <button onClick={() => onWordsChange(words.filter(x => x.id !== w.id))}
                  className="mini-btn" style={{ background: "transparent", color: "#c77", border: "none", padding: 0 }}>✕</button>
                <span style={{ fontWeight: 500, color: "#1a1a1a", flexShrink: 0 }}>{w.word}</span>
                <span style={{ color: "#888", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{w.def}</span>
              </div>
            ))}
          </div>
        )}

        <div style={section}>Sync across devices</div>
        {syncCfg?.code ? (
          <>
            <div style={{ fontSize: 12, color: "#555", lineHeight: 1.6 }}>
              Enter this code in Settings on your other device to share one set of data:
            </div>
            <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 16, fontWeight: 600, letterSpacing: "0.05em", color: "#1a1a1a", background: "#f0f0f0", borderRadius: 8, padding: "8px 12px", margin: "6px 0", userSelect: "all" }}>
              {syncCfg.code}
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              {syncCfg.lastSync && <span style={{ fontSize: 11, color: "#5BA898" }}>Last synced {new Date(syncCfg.lastSync).toLocaleTimeString()}</span>}
              <button className="link-btn" style={{ color: "#c77" }} onClick={() => { disableSync(); setSyncCfg(null); setSyncMsg(""); }}>disable sync on this device</button>
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 12, color: "#555", lineHeight: 1.6, marginBottom: 8 }}>
              Keep your data identical on laptop and phone. Changes sync automatically whenever the app is open.
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <button className="ghost-btn" disabled={syncBusy} onClick={startSync}>Enable sync (new code)</button>
              <span style={{ fontSize: 11, color: "#aaa" }}>or</span>
              <input style={{ ...input, width: 190, fontFamily: "ui-monospace, monospace" }} placeholder="XXXX-XXXX-XXXX-XXXX"
                value={connectCode} onChange={e => setConnectCode(e.target.value)} onKeyDown={e => e.key === "Enter" && joinSync()} />
              <button className="ghost-btn" disabled={syncBusy || !connectCode.trim()} onClick={joinSync}>Connect</button>
            </div>
          </>
        )}
        {syncMsg && <div style={{ fontSize: 12, color: syncMsg.startsWith("Couldn't") ? "#B0563C" : "#5BA898", marginTop: 6 }}>{syncMsg}</div>}

        <div style={section}>Data</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button className="ghost-btn" onClick={exportData}>Export backup</button>
          <label className="ghost-btn" style={{ cursor: "pointer" }}>
            Restore backup<input type="file" accept=".json" style={{ display: "none" }} onChange={importData} />
          </label>
        </div>
        <div style={{ fontSize: 11, color: "#aaa", marginTop: 6 }}>
          Everything is stored in this browser's localStorage — export a backup before switching devices.
        </div>
      </div>
    </div>
  );
}
