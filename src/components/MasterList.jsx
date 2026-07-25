import { useState, useEffect, useCallback, useRef } from "react";
import { getSyncId } from "../lib/sync";

// Master to-do list mirrored two-way with Notion pages (one page per area).
// Notion is the source of truth: ticking or adding here writes to Notion,
// and edits made in Notion appear on the next refresh (open, focus, or the
// polling interval while expanded).

const SECTION_COLORS = [
  { color: "#5BA898", bg: "#E0F2EE" },
  { color: "#B87A6B", bg: "#F5E8E5" },
  { color: "#6BA888", bg: "#E3F2EC" },
  { color: "#5A7FB8", bg: "#E3EBF7" },
  { color: "#8B7EC8", bg: "#EEEDFB" },
];

const CACHE_KEY = "ht_todos_cache";
const OPEN_KEY = "ht_todos_open";
const readCache = () => { try { return JSON.parse(localStorage.getItem(CACHE_KEY) || "null"); } catch { return null; } };

export default function MasterList() {
  const [open, setOpen] = useState(() => localStorage.getItem(OPEN_KEY) === "1");
  const [sections, setSections] = useState(() => readCache()?.sections || null);
  const [state, setState] = useState("idle"); // idle | loading | ready | unconfigured | unauthorized | error
  const [error, setError] = useState("");
  const [drafts, setDrafts] = useState({});
  const [busy, setBusy] = useState({});
  const [showDone, setShowDone] = useState({});
  const syncIdRef = useRef(null);

  const refresh = useCallback(async (silent = true) => {
    if (!silent) setState("loading");
    try {
      syncIdRef.current = syncIdRef.current || await getSyncId();
      if (!syncIdRef.current) { setState("unauthorized"); return; }
      const res = await fetch("/api/todos", { headers: { "x-sync-id": syncIdRef.current } });
      const data = await res.json().catch(() => ({}));
      if (res.status === 501) { setState("unconfigured"); return; }
      if (res.status === 403) { setState("unauthorized"); return; }
      if (!res.ok) throw new Error(data.error || `Failed (${res.status})`);
      setSections(data.sections);
      setState("ready"); setError("");
      try { localStorage.setItem(CACHE_KEY, JSON.stringify({ fetchedAt: Date.now(), sections: data.sections })); } catch { /* ignore */ }
    } catch (err) {
      setState(s => (s === "ready" ? "ready" : "error"));
      setError(err.message || "Couldn't reach Notion");
    }
  }, []);

  useEffect(() => { refresh(sections !== null); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    const iv = setInterval(refresh, 90_000);
    const onVisible = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(iv); document.removeEventListener("visibilitychange", onVisible); };
  }, [open, refresh]);

  const toggleOpen = () => setOpen(o => { const next = !o; try { localStorage.setItem(OPEN_KEY, next ? "1" : "0"); } catch { /* ignore */ } return next; });

  const post = async body => {
    const res = await fetch("/api/todos", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-sync-id": syncIdRef.current },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Failed (${res.status})`);
    return data;
  };

  const patchTask = (sectionName, taskId, patch) => {
    setSections(secs => secs.map(s => s.name !== sectionName ? s : {
      ...s,
      tasks: patch === null ? s.tasks.filter(t => t.id !== taskId) : s.tasks.map(t => t.id === taskId ? { ...t, ...patch } : t),
    }));
  };

  const toggleTask = async (section, task) => {
    patchTask(section.name, task.id, { checked: !task.checked });
    try { await post({ action: "toggle", blockId: task.id, checked: !task.checked }); }
    catch (err) { patchTask(section.name, task.id, { checked: task.checked }); setError(err.message); }
  };

  const addTask = async section => {
    const text = (drafts[section.name] || "").trim();
    if (!text || busy[section.name]) return;
    setBusy(b => ({ ...b, [section.name]: true }));
    try {
      const { id } = await post({ action: "add", section: section.name, text });
      setSections(secs => secs.map(s => s.name !== section.name ? s : { ...s, tasks: [...s.tasks, { id: id || `tmp_${Date.now()}`, text, checked: false }] }));
      setDrafts(d => ({ ...d, [section.name]: "" }));
      setError("");
    } catch (err) { setError(err.message); }
    setBusy(b => ({ ...b, [section.name]: false }));
  };

  const deleteTask = async (section, task) => {
    if (!confirm(`Delete "${task.text}" here and in Notion?`)) return;
    patchTask(section.name, task.id, null);
    try { await post({ action: "delete", blockId: task.id }); }
    catch (err) { setError(err.message); refresh(); }
  };

  const totalOpen = (sections || []).reduce((a, s) => a + s.tasks.filter(t => !t.checked).length, 0);

  return (
    <div style={{ marginBottom: "1.25rem" }}>
      <button onClick={toggleOpen}
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, background: "#F4F2FA", border: "0.5px solid #E3DFF0", borderRadius: 12, padding: "10px 14px", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: "#4A4370" }}>Master list</span>
        {sections && (
          <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {sections.map((s, i) => {
              const openCount = s.tasks.filter(t => !t.checked).length;
              const pal = SECTION_COLORS[i % SECTION_COLORS.length];
              return openCount > 0 && (
                <span key={s.name} style={{ fontSize: 11, fontWeight: 500, color: pal.color, background: "white", border: `0.5px solid ${pal.color}`, borderRadius: 999, padding: "1px 8px" }}>
                  {s.name} {openCount}
                </span>
              );
            })}
          </span>
        )}
        <span style={{ marginLeft: "auto", fontSize: 12, color: "#8a82ad", flexShrink: 0 }}>
          {sections ? `${totalOpen} open` : ""} {open ? "▾" : "▸"}
        </span>
      </button>

      {open && (
        <div style={{ marginTop: 10 }}>
          {state === "unconfigured" && (
            <div className="card" style={{ fontSize: 13, color: "#555", lineHeight: 1.7 }}>
              <b>Connect Notion to power the master list.</b> One-time setup: create an internal integration at notion.so/profile/integrations, share your to-do pages with it, then set <code>NOTION_TOKEN</code>, <code>NOTION_TODO_PAGES</code>, and <code>TODO_ACCESS_HASH</code> in Vercel and redeploy. See the README for details.
            </div>
          )}
          {state === "unauthorized" && (
            <div className="card" style={{ fontSize: 13, color: "#555" }}>
              Enable sync in Settings first — the master list uses your sync identity to keep your tasks private.
            </div>
          )}
          {state === "error" && !sections && (
            <div className="card" style={{ fontSize: 13, color: "#B0563C" }}>⚠ {error}</div>
          )}

          {sections && (
            <>
              {error && <div style={{ fontSize: 12, color: "#B0563C", marginBottom: 8 }}>⚠ {error}</div>}
              <div className="todo-grid">
                {sections.map((s, i) => {
                  const pal = SECTION_COLORS[i % SECTION_COLORS.length];
                  const openTasks = s.tasks.filter(t => !t.checked);
                  const doneTasks = s.tasks.filter(t => t.checked);
                  return (
                    <div key={s.name} className="feature-card" style={{ background: pal.bg, border: `0.5px solid ${pal.color}40` }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: pal.color }}>{s.name}</span>
                        <span style={{ fontSize: 11, color: pal.color, opacity: 0.7 }}>{openTasks.length} open</span>
                        <a href={`https://www.notion.so/${s.pageId.replace(/-/g, "")}`} target="_blank" rel="noreferrer"
                          style={{ marginLeft: "auto", fontSize: 11, color: pal.color, textDecoration: "none", opacity: 0.8 }}>Notion ↗</a>
                      </div>
                      {s.error && <div style={{ fontSize: 11, color: "#B0563C", marginBottom: 6 }}>⚠ {s.error}</div>}
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        {openTasks.length === 0 && !s.error && <div style={{ fontSize: 12, color: pal.color, opacity: 0.6 }}>Nothing open — nice.</div>}
                        {openTasks.map(t => (
                          <div key={t.id} className="todo-row">
                            <button onClick={() => toggleTask(s, t)} title="Done"
                              style={{ width: 15, height: 15, borderRadius: 4, border: `1.5px solid ${pal.color}`, background: "transparent", cursor: "pointer", flexShrink: 0, marginTop: 2 }} />
                            <span style={{ fontSize: 13, color: "#2c2838", lineHeight: 1.45, flex: 1 }}>{t.text}</span>
                            <button className="todo-delete" title="Delete" onClick={() => deleteTask(s, t)}>✕</button>
                          </div>
                        ))}
                      </div>
                      {doneTasks.length > 0 && (
                        <>
                          <button className="link-btn" style={{ color: pal.color, marginTop: 8, opacity: 0.8 }}
                            onClick={() => setShowDone(d => ({ ...d, [s.name]: !d[s.name] }))}>
                            {showDone[s.name] ? "hide" : "show"} {doneTasks.length} done
                          </button>
                          {showDone[s.name] && doneTasks.map(t => (
                            <div key={t.id} className="todo-row" style={{ opacity: 0.55, marginTop: 4 }}>
                              <button onClick={() => toggleTask(s, t)} title="Un-tick"
                                style={{ width: 15, height: 15, borderRadius: 4, border: `1.5px solid ${pal.color}`, background: pal.color, cursor: "pointer", flexShrink: 0, marginTop: 2, color: "white", fontSize: 9, lineHeight: "12px", padding: 0 }}>✓</button>
                              <span style={{ fontSize: 13, color: "#2c2838", lineHeight: 1.45, textDecoration: "line-through", flex: 1 }}>{t.text}</span>
                            </div>
                          ))}
                        </>
                      )}
                      <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                        <input value={drafts[s.name] || ""} onChange={e => setDrafts(d => ({ ...d, [s.name]: e.target.value }))}
                          onKeyDown={e => e.key === "Enter" && addTask(s)} placeholder="Add a task…"
                          style={{ flex: 1, minWidth: 0, border: `0.5px solid ${pal.color}40`, borderRadius: 8, padding: "6px 10px", fontSize: 12, fontFamily: "inherit", outline: "none", background: "white", color: "#1a1a1a" }} />
                        <button className="mini-btn" disabled={busy[s.name] || !(drafts[s.name] || "").trim()}
                          style={{ background: pal.color, color: "white", border: "none", opacity: busy[s.name] ? 0.6 : 1 }}
                          onClick={() => addTask(s)}>{busy[s.name] ? "…" : "Add"}</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
