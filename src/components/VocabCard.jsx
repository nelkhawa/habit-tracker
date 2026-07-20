import { useState } from "react";
import { buildSession, gradeWord, logPractice, MAX_BOX } from "../lib/vocab";
import { todayStr, addDays } from "../lib/dates";

const ACCENT = "#8B7EC8", DIM = "#9C93C4", BG = "#EEEDFB", BORDER = "#D8D4F0";
const VERDICTS = {
  pass: { grade: "yes", label: "Knew it", color: "#6FA893" },
  fuzzy: { grade: "fuzzy", label: "Fuzzy", color: "#C9A45C" },
  miss: { grade: "no", label: "Didn't know", color: "#C4837A" },
};

const normalize = s => s.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();

function editDistance(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

// Reverse cards (definition → word) are graded locally: it's a single-token
// answer, so string distance is enough. Forward cards go to /api/grade.
function gradeReverse(word, answer) {
  const target = normalize(word), given = normalize(answer);
  if (!given) return { verdict: "miss", feedback: "No answer given." };
  if (given === target || editDistance(given, target) <= 2) return { verdict: "pass", feedback: "That's the word." };
  if (target.includes(given) || given.includes(target)) return { verdict: "fuzzy", feedback: "Close — check the exact form." };
  return { verdict: "miss", feedback: `It was "${word}".` };
}

// Daily vocabulary trainer: type the answer, get assessed, and the verdict
// drives the spaced-repetition schedule — no self-grading.
export default function VocabCard({ words, srs, onSrsChange, log, onLogChange, onOpenSettings, onLoadSamples }) {
  const [queue, setQueue] = useState(() => buildSession(words, srs));
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState(null); // {verdict, feedback} once graded
  const [grading, setGrading] = useState(false);
  const [gradeError, setGradeError] = useState("");
  const [reviewedCount, setReviewedCount] = useState(0);

  const practiceStreak = (() => {
    let s = 0, d = todayStr();
    if (!log[d]) d = addDays(d, -1);
    while (log[d]) { s++; d = addDays(d, -1); }
    return s;
  })();

  const mastered = words.filter(w => srs[w.id]?.box === MAX_BOX).length;

  const header = (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
      <div style={{ fontSize: 13, fontWeight: 500, color: "#5A4A8A" }}>Word practice</div>
      <div style={{ fontSize: 11, color: DIM }}>
        {practiceStreak > 0 && <span style={{ marginRight: 8 }}>{practiceStreak}d streak</span>}
        {mastered}/{words.length} mastered
      </div>
    </div>
  );

  if (!words.length) {
    return (
      <div className="feature-card" style={{ background: BG, border: `0.5px solid ${BORDER}` }}>
        {header}
        <div style={{ fontSize: 13, color: "#5A4A8A", lineHeight: 1.6, marginBottom: 10 }}>
          Add vocabulary from your reading and get quizzed on a few words a day until they stick.
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="mini-btn" style={{ background: ACCENT, color: "white", border: "none" }} onClick={onOpenSettings}>Add words</button>
          <button className="mini-btn" style={{ background: "transparent", color: ACCENT, border: `0.5px solid ${ACCENT}` }} onClick={onLoadSamples}>Try sample words</button>
        </div>
      </div>
    );
  }

  const word = queue[0];

  if (!word) {
    return (
      <div className="feature-card" style={{ background: BG, border: `0.5px solid ${BORDER}` }}>
        {header}
        <div style={{ fontSize: 13, color: "#5A4A8A", lineHeight: 1.6 }}>
          {reviewedCount > 0
            ? `Done — ${reviewedCount} word${reviewedCount > 1 ? "s" : ""} reviewed today. Come back tomorrow.`
            : "All caught up — nothing due today. Come back tomorrow."}
        </div>
      </div>
    );
  }

  const entry = srs[word.id];
  const reverse = entry && entry.box >= 3 && entry.seen % 2 === 1;
  const isNew = !entry;

  const applyVerdict = verdict => {
    onSrsChange(gradeWord(srs, word.id, VERDICTS[verdict].grade));
    onLogChange(logPractice(log));
    setReviewedCount(c => c + 1);
  };

  const check = async (giveUp = false) => {
    if (grading || result) return;
    setGradeError("");
    const typed = giveUp ? "" : answer;
    if (reverse) {
      const r = gradeReverse(word.word, typed);
      setResult(r); applyVerdict(r.verdict);
      return;
    }
    if (!typed.trim()) {
      const r = { verdict: "miss", feedback: "" };
      setResult(r); applyVerdict(r.verdict);
      return;
    }
    setGrading(true);
    try {
      const res = await fetch("/api/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word: word.word, definition: word.def, example: word.example, answer: typed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.verdict) throw new Error(data.error || `Grading failed (${res.status})`);
      setResult(data); applyVerdict(data.verdict);
    } catch (err) {
      setGradeError(err.message || "Couldn't grade — pick one yourself:");
    }
    setGrading(false);
  };

  const selfGrade = verdict => { setResult({ verdict, feedback: "" }); applyVerdict(verdict); setGradeError(""); };

  const next = () => { setQueue(q => q.slice(1)); setAnswer(""); setResult(null); setGradeError(""); };

  const v = result && VERDICTS[result.verdict];

  return (
    <div className="feature-card" style={{ background: BG, border: `0.5px solid ${BORDER}` }}>
      {header}
      <div style={{ fontSize: 11, color: DIM, marginBottom: 6 }}>
        {isNew ? "new word" : `review · box ${entry.box}/${MAX_BOX}`} · {queue.length} left today
      </div>
      <div style={{ background: "white", borderRadius: 10, padding: "12px 14px", border: `0.5px solid ${BORDER}` }}>
        {reverse ? (
          <div style={{ fontSize: 13, color: "#4a4460", lineHeight: 1.5 }}>{word.def}</div>
        ) : (
          <div style={{ fontSize: 17, fontWeight: 600, color: "#3C3489" }}>{word.word}</div>
        )}

        {!result ? (
          <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
            <input value={answer} onChange={e => setAnswer(e.target.value)} onKeyDown={e => e.key === "Enter" && check()}
              placeholder={reverse ? "Type the word…" : "Type the meaning…"} disabled={grading}
              style={{ flex: 1, minWidth: 0, border: `0.5px solid ${BORDER}`, borderRadius: 8, padding: "7px 10px", fontSize: 13, fontFamily: "inherit", outline: "none", color: "#1a1a1a" }} />
            <button className="mini-btn" style={{ background: ACCENT, color: "white", border: "none", opacity: grading ? 0.7 : 1 }} disabled={grading} onClick={() => check()}>
              {grading ? "Checking…" : "Check"}
            </button>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "white", background: v.color, borderRadius: 6, padding: "2px 8px" }}>{v.label}</span>
              {result.feedback && <span style={{ fontSize: 12, color: "#6b6480" }}>{result.feedback}</span>}
            </div>
            {!reverse && <div style={{ fontSize: 13, color: "#4a4460", lineHeight: 1.5, marginTop: 8 }}>{word.def}</div>}
            {reverse && <div style={{ fontSize: 17, fontWeight: 600, color: "#3C3489", marginTop: 8 }}>{word.word}</div>}
            {word.example && <div style={{ fontSize: 12, color: "#8a819e", fontStyle: "italic", marginTop: 6, lineHeight: 1.5 }}>"{word.example}"</div>}
          </>
        )}
      </div>

      {gradeError && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 12, color: "#B0563C", marginBottom: 6 }}>⚠ {gradeError}</div>
          <div style={{ display: "flex", gap: 6 }}>
            {Object.entries(VERDICTS).map(([verdict, cfg]) => (
              <button key={verdict} className="mini-btn" style={{ background: cfg.color, color: "white", border: "none", flex: 1 }} onClick={() => selfGrade(verdict)}>{cfg.label}</button>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
        {result ? (
          <button className="mini-btn" style={{ background: ACCENT, color: "white", border: "none", flex: 1 }} onClick={next}>
            {queue.length > 1 ? "Next word" : "Finish"}
          </button>
        ) : (
          <button className="link-btn" style={{ color: DIM }} onClick={() => check(true)} disabled={grading}>I don't know this one</button>
        )}
      </div>
    </div>
  );
}
