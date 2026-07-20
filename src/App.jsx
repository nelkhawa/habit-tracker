import { useState, useEffect, useRef } from "react";
import "./App.css";
import { MONTHS, todayStr, daysInMonth, pad } from "./lib/dates";
import { loadHabits, saveHabits } from "./lib/habits";
import { getKey, computeStreak, getMonthStats, buildAnalysisData } from "./lib/stats";
import { buildPrompt, generateAnalysis } from "./lib/analysis";
import { loadWords, saveWords, loadSrs, saveSrs, loadLog, saveLog, SAMPLE_WORDS } from "./lib/vocab";
import { getSyncConfig, syncNow, markDirty, schedulePush } from "./lib/sync";
import Confetti from "./components/Confetti";
import MonthView from "./components/MonthView";
import WeekView from "./components/WeekView";
import QuarterView from "./components/QuarterView";
import LearnedCard from "./components/LearnedCard";
import VocabCard from "./components/VocabCard";
import Settings from "./components/Settings";

const readJSON = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key) || "null") ?? fallback; } catch { return fallback; } };
const writeJSON = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ } };

// mark local data changed + queue a background push to the sync store
const touch = () => { markDirty(); schedulePush(); };

export default function App() {
  const now = new Date();
  const [habits, setHabits] = useState(loadHabits);
  const [view, setView] = useState("month");
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [checked, setChecked] = useState(() => readJSON("ht_checked", {}));
  const [confetti, setConfetti] = useState(false);
  // Per-month state (reflection edits, analyses, errors) is kept in maps
  // keyed by "year_month" and backed by localStorage, so switching months
  // needs no effect-based sync.
  const [reflEdits, setReflEdits] = useState({});
  const [analysisMap, setAnalysisMap] = useState({});
  const [analysisErrors, setAnalysisErrors] = useState({});
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [til, setTil] = useState(() => readJSON("ht_til", {}));
  const [words, setWords] = useState(loadWords);
  const [srs, setSrs] = useState(loadSrs);
  const [vocabLog, setVocabLog] = useState(loadLog);
  const [coachContext, setCoachContext] = useState(() => localStorage.getItem("ht_coach_context") || "");
  const [showSettings, setShowSettings] = useState(false);
  const prevAllDone = useRef(false);
  const tk = todayStr();

  // On open (and whenever the tab regains focus), pull remote state; if
  // another device wrote more recently, apply it and reload the UI.
  useEffect(() => {
    if (!getSyncConfig()?.code) return;
    const run = () => syncNow().then(r => { if (r.status === "applied") window.location.reload(); }).catch(() => {});
    run();
    const onVisible = () => { if (document.visibilityState === "visible") run(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  const daily = habits.filter(h => !h.weekly);

  const mk = `${year}_${month}`;
  const savedRefl = localStorage.getItem(`ht_refl_${mk}`) || "";
  const reflection = reflEdits[mk] ?? savedRefl;
  const analysis = analysisMap[mk] ?? (localStorage.getItem(`ht_analysis_${mk}`) || "");
  const analysisError = analysisErrors[mk] || "";

  const isDone = (hid, y, m, d) => !!checked[getKey(hid, y, m, d)];

  const toggle = (hid, y, m, d) => {
    const k = getKey(hid, y, m, d);
    const next = { ...checked, [k]: !checked[k] };
    setChecked(next); writeJSON("ht_checked", next); touch();
    const allDone = daily.every(h => next[getKey(h.id, now.getFullYear(), now.getMonth(), now.getDate())]);
    if (allDone && !prevAllDone.current) { setConfetti(true); setTimeout(() => setConfetti(false), 4500); }
    prevAllDone.current = allDone;
  };

  const updateHabits = next => { setHabits(next); saveHabits(next); touch(); };
  const updateWords = next => { setWords(next); saveWords(next); touch(); };
  const updateSrs = next => { setSrs(next); saveSrs(next); touch(); };
  const updateVocabLog = next => { setVocabLog(next); saveLog(next); touch(); };
  const updateCoach = text => { setCoachContext(text); try { localStorage.setItem("ht_coach_context", text); } catch { /* ignore */ } touch(); };
  const saveTil = (key, text) => { const next = { ...til, [key]: text }; setTil(next); writeJSON("ht_til", next); touch(); };
  const saveRefl = () => {
    try { localStorage.setItem(`ht_refl_${mk}`, reflection); } catch { /* ignore */ }
    setReflEdits(edits => { const next = { ...edits }; delete next[mk]; return next; });
    touch();
  };

  const runAnalysis = async () => {
    setAnalysisLoading(true);
    setAnalysisErrors(e => ({ ...e, [mk]: "" }));
    try {
      const monthPrefix = `${year}-${pad(month + 1)}`;
      const learnedEntries = Object.entries(til)
        .filter(([k]) => k.startsWith(monthPrefix))
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([, v]) => v);
      const vocabDays = Object.keys(vocabLog).filter(k => k.startsWith(monthPrefix)).length;
      const data = buildAnalysisData(habits, year, month, checked, {
        learnedJournalEntriesThisMonth: learnedEntries.length,
        vocabPracticeDaysThisMonth: vocabDays,
      });
      const prompt = buildPrompt(data, coachContext, savedRefl, learnedEntries);
      const text = await generateAnalysis(prompt);
      setAnalysisMap(a => ({ ...a, [mk]: text }));
      localStorage.setItem(`ht_analysis_${mk}`, text);
      touch();
    } catch (err) {
      setAnalysisErrors(e => ({ ...e, [mk]: err?.message || "Something went wrong." }));
    }
    setAnalysisLoading(false);
  };

  const navPrev = () => { if (view === "quarter") { setYear(y => y - 1); } else if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const navNext = () => { if (view === "quarter") { setYear(y => y + 1); } else if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); };

  function getWeekLabel() {
    const today = new Date(), mon = new Date(today), day = mon.getDay();
    mon.setDate(today.getDate() + (day === 0 ? -6 : 1 - day));
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    return `${mon.getDate()} ${MONTHS[mon.getMonth()].slice(0, 3)} – ${sun.getDate()} ${MONTHS[sun.getMonth()].slice(0, 3)}`;
  }

  const navLabel = view === "quarter" ? `${year}` : view === "week" ? getWeekLabel() : `${MONTHS[month]} ${year}`;
  const btnStyle = v => ({ padding: "5px 14px", borderRadius: 8, fontSize: 13, fontWeight: view === v ? 500 : 400, cursor: "pointer", border: "none", background: view === v ? "white" : "transparent", color: view === v ? "#1a1a1a" : "#888", boxShadow: view === v ? "0 0 0 0.5px #ddd" : "none" });

  const todayDone = daily.filter(h => isDone(h.id, now.getFullYear(), now.getMonth(), now.getDate())).length;
  const days = daysInMonth(year, month);
  const monthStats = getMonthStats(habits, year, month, checked);
  const dailyStats = monthStats.filter(h => !h.weekly);
  const monthDone = dailyStats.reduce((a, h) => a + h.done, 0);
  const monthPct = daily.length ? Math.round((monthDone / (daily.length * days)) * 100) : 0;
  const topStreak = Math.max(...habits.filter(h => !h.weekly).map(h => computeStreak(h, checked)), 0);

  function formatAnalysis(text) {
    return text.split("\n").map((line, i) => {
      if (!line.trim()) return <div key={i} style={{ height: 8 }} />;
      const html = line.replace(/\*\*(.*?)\*\*/g, "<b>$1</b>");
      return <div key={i} style={{ fontSize: 14, color: "#1a1a1a", lineHeight: 1.7 }} dangerouslySetInnerHTML={{ __html: html }} />;
    });
  }

  return (
    <div className="app">
      <Confetti run={confetti} />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.25rem" }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 500, color: "#1a1a1a" }}>Habit tracker</div>
          <div style={{ fontSize: 13, color: "#888", marginTop: 2 }}>{now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</div>
        </div>
        <button className="ghost-btn" onClick={() => setShowSettings(true)} title="Settings">⚙︎ Settings</button>
      </div>

      <div className="stats-grid">
        <div style={{ background: "#E8EDF5", borderRadius: 12, padding: "12px 14px" }}>
          <div style={{ fontSize: 11, color: "#4A5B7A", marginBottom: 3 }}>today</div>
          <div style={{ fontSize: 22, fontWeight: 500, color: todayDone === daily.length ? "#3B6D8A" : "#2C3E5A" }}>{todayDone}/{daily.length}</div>
          <div style={{ fontSize: 11, color: "#6B7FA3", marginTop: 2 }}>{todayDone === daily.length && daily.length ? "all done!" : "habits done"}</div>
        </div>
        <div style={{ background: "#EEEDFB", borderRadius: 12, padding: "12px 14px" }}>
          <div style={{ fontSize: 11, color: "#5A4A8A", marginBottom: 3 }}>this month</div>
          <div style={{ fontSize: 22, fontWeight: 500, color: monthPct >= 80 ? "#534AB7" : "#3C3489" }}>{monthPct}%</div>
          <div style={{ height: 4, borderRadius: 2, background: "#CCC9F0", marginTop: 6, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${monthPct}%`, background: "#8B7EC8", borderRadius: 2, transition: "width 0.4s" }} />
          </div>
        </div>
        <div style={{ background: "#E0F2EE", borderRadius: 12, padding: "12px 14px" }}>
          <div style={{ fontSize: 11, color: "#3A7A68", marginBottom: 3 }}>best streak</div>
          <div style={{ fontSize: 22, fontWeight: 500, color: "#5BA898" }}>{topStreak}d</div>
          <div style={{ fontSize: 11, color: "#5BA898", marginTop: 2 }}>keep going</div>
        </div>
      </div>

      <div className="learn-grid">
        <LearnedCard til={til} onSave={saveTil} />
        <VocabCard key={words.length} words={words} srs={srs} onSrsChange={updateSrs}
          log={vocabLog} onLogChange={updateVocabLog}
          onOpenSettings={() => setShowSettings(true)}
          onLoadSamples={() => updateWords([...words, ...SAMPLE_WORDS])} />
      </div>

      <div className="nav-row">
        <div style={{ display: "flex", gap: 2, background: "#f0f0f0", padding: 3, borderRadius: 10 }}>
          <button style={btnStyle("month")} onClick={() => setView("month")}>Month</button>
          <button style={btnStyle("week")} onClick={() => setView("week")}>Week</button>
          <button style={btnStyle("quarter")} onClick={() => setView("quarter")}>Quarter</button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button className="nav-btn" onClick={navPrev}>←</button>
          <span style={{ fontSize: 14, fontWeight: 500, minWidth: 120, textAlign: "center" }}>{navLabel}</span>
          <button className="nav-btn" onClick={navNext}>→</button>
        </div>
      </div>

      {view === "month" && <MonthView habits={habits} year={year} month={month} toggle={toggle} isDone={isDone} tk={tk} />}
      {view === "week" && <WeekView habits={habits} checked={checked} toggle={toggle} isDone={isDone} tk={tk} />}
      {view === "quarter" && <QuarterView habits={habits} year={year} isDone={isDone} tk={tk} />}

      {view === "month" && (
        <div style={{ marginTop: "1.5rem" }}>
          <div className="section-label">Month roundup</div>
          <div className="card" style={{ marginBottom: "1rem" }}>
            {monthStats.map((h, i) => (
              <div key={h.id} style={{ marginBottom: i < monthStats.length - 1 ? 12 : 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 13, color: "#1a1a1a" }}>{h.label}{h.weekly && <span style={{ fontSize: 11, color: "#aaa" }}> · weekly</span>}</span>
                  <span style={{ fontSize: 13, fontWeight: 500, color: h.pct >= 80 ? h.color : "#888" }}>{h.done}/{h.possible} — {h.pct}%</span>
                </div>
                <div style={{ height: 5, borderRadius: 3, background: "#f0f0f0", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${Math.min(h.pct, 100)}%`, background: h.color, borderRadius: 3, transition: "width 0.4s" }} />
                </div>
              </div>
            ))}
          </div>

          <div className="section-label">AI analysis</div>
          <div style={{ background: "#FFFBEA", border: "0.5px solid #E8D44D", borderRadius: 12, padding: 16, marginBottom: "1rem" }}>
            {analysis ? (
              <>{formatAnalysis(analysis)}</>
            ) : (
              <>
                <div style={{ fontSize: 14, fontWeight: 500, color: "#7A6000", marginBottom: 6 }}>Get your {MONTHS[month]} breakdown</div>
                <div style={{ fontSize: 13, color: "#A07800", lineHeight: 1.6, marginBottom: 12 }}>
                  An honest coach reads your patterns — weekday vs weekend splits, mid-month collapses, longest gaps — compares against last month, names a blind spot, and gives 3 concrete actions.
                </div>
              </>
            )}
            {analysisError && <div style={{ fontSize: 13, color: "#B0563C", marginTop: 8 }}>⚠ {analysisError}</div>}
            <button onClick={runAnalysis} disabled={analysisLoading} className={analysis ? "ghost-btn" : ""}
              style={analysis
                ? { marginTop: 14, fontSize: 12, color: "#888" }
                : { padding: "8px 18px", borderRadius: 8, background: "#E8C200", border: "none", color: "#3A3000", fontSize: 13, fontWeight: 500, cursor: analysisLoading ? "default" : "pointer", opacity: analysisLoading ? 0.7 : 1 }}>
              {analysisLoading ? "Analysing your month..." : analysis ? "Regenerate" : "Generate analysis"}
            </button>
          </div>

          <div className="section-label">Monthly reflection</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: "1rem" }}>
            {[
              { q: "What did I do well this month?", sub: "Reinforce your identity — 'I am someone who...'", col: "#8B7EC8", bg: "#EEEDFB" },
              { q: "Where did I slip, and what got in the way?", sub: "Look for patterns, not blame.", col: "#5B9FB5", bg: "#E0F0F5" },
              { q: "What was my biggest obstacle?", sub: "External circumstance or internal resistance?", col: "#6BA888", bg: "#E3F2EC" },
              { q: "Which habit do I want to double down on next month?", sub: "Pick one. Specificity beats ambition.", col: "#9B7EC0", bg: "#EDE8F7" },
              { q: "What's one achievement this month I'm proud of?", sub: "Big or small — claim it.", col: "#B87A6B", bg: "#F5E8E5" },
            ].map((p, i) => (
              <div key={i} style={{ background: p.bg, borderRadius: 10, padding: "10px 14px", borderLeft: `3px solid ${p.col}` }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: p.col, marginBottom: 2 }}>{p.q}</div>
                <div style={{ fontSize: 11, color: p.col, opacity: 0.75 }}>{p.sub}</div>
              </div>
            ))}
          </div>
          <div className="card">
            <textarea value={reflection} onChange={e => { const v = e.target.value; setReflEdits(r => ({ ...r, [mk]: v })); }} placeholder={`Reflect on ${MONTHS[month]}...`}
              style={{ width: "100%", minHeight: 120, border: "none", outline: "none", resize: "vertical", fontSize: 14, lineHeight: 1.6, boxSizing: "border-box", fontFamily: "inherit", background: "transparent", color: "#1a1a1a" }} />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, borderTop: "0.5px solid #eee", paddingTop: 10, marginTop: 6, alignItems: "center" }}>
              {savedRefl === reflection && savedRefl && <span style={{ fontSize: 12, color: "#888" }}>Saved</span>}
              <button onClick={saveRefl} className="ghost-btn">Save</button>
            </div>
          </div>
        </div>
      )}

      {showSettings && (
        <Settings habits={habits} onHabitsChange={updateHabits}
          coachContext={coachContext} onCoachChange={updateCoach}
          words={words} onWordsChange={updateWords}
          onClose={() => setShowSettings(false)} />
      )}
    </div>
  );
}
