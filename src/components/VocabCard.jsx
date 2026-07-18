import { useState } from "react";
import { buildSession, gradeWord, logPractice, MAX_BOX } from "../lib/vocab";
import { todayStr, addDays } from "../lib/dates";

const ACCENT = "#8B7EC8", DIM = "#9C93C4", BG = "#EEEDFB", BORDER = "#D8D4F0";

// Daily vocabulary trainer: spaced-repetition flashcards over the user's own
// word list. A short session (due reviews + a few new words) each day.
export default function VocabCard({ words, srs, onSrsChange, log, onLogChange, onOpenSettings, onLoadSamples }) {
  const [queue, setQueue] = useState(() => buildSession(words, srs));
  const [revealed, setRevealed] = useState(false);
  const [reviewedCount, setReviewedCount] = useState(0);

  const practiceStreak = (() => {
    let s = 0, d = todayStr();
    if (!log[d]) d = addDays(d, -1); // today not practiced yet doesn't break the streak
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
  const reverse = entry && entry.box >= 3 && entry.seen % 2 === 1; // stronger words: recall the word from its meaning
  const isNew = !entry;

  const grade = g => {
    onSrsChange(gradeWord(srs, word.id, g));
    onLogChange(logPractice(log));
    setReviewedCount(c => c + 1);
    setQueue(q => q.slice(1));
    setRevealed(false);
  };

  const gradeBtn = (g, label, color) => (
    <button key={g} onClick={() => grade(g)} className="mini-btn"
      style={{ background: color, color: "white", border: "none", flex: 1 }}>{label}</button>
  );

  return (
    <div className="feature-card" style={{ background: BG, border: `0.5px solid ${BORDER}` }}>
      {header}
      <div style={{ fontSize: 11, color: DIM, marginBottom: 6 }}>
        {isNew ? "new word" : `review · box ${entry.box}/${MAX_BOX}`} · {queue.length} left today
      </div>
      <div style={{ background: "white", borderRadius: 10, padding: "12px 14px", border: `0.5px solid ${BORDER}` }}>
        {reverse ? (
          <>
            <div style={{ fontSize: 13, color: "#4a4460", lineHeight: 1.5 }}>{word.def}</div>
            {revealed && <div style={{ fontSize: 17, fontWeight: 600, color: "#3C3489", marginTop: 8 }}>{word.word}</div>}
          </>
        ) : (
          <>
            <div style={{ fontSize: 17, fontWeight: 600, color: "#3C3489" }}>{word.word}</div>
            {revealed && <div style={{ fontSize: 13, color: "#4a4460", lineHeight: 1.5, marginTop: 8 }}>{word.def}</div>}
          </>
        )}
        {revealed && word.example && (
          <div style={{ fontSize: 12, color: "#8a819e", fontStyle: "italic", marginTop: 6, lineHeight: 1.5 }}>"{word.example}"</div>
        )}
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
        {revealed ? (
          <>
            {gradeBtn("no", "Didn't know", "#C4837A")}
            {gradeBtn("fuzzy", "Fuzzy", "#C9A45C")}
            {gradeBtn("yes", "Knew it", "#6FA893")}
          </>
        ) : (
          <button className="mini-btn" style={{ background: ACCENT, color: "white", border: "none", flex: 1 }} onClick={() => setRevealed(true)}>
            {reverse ? "Reveal word" : "Reveal meaning"}
          </button>
        )}
      </div>
    </div>
  );
}
