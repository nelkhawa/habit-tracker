import { todayStr, addDays } from "./dates";

// Leitner-style spaced repetition: each word sits in a box; correct answers
// move it up and push the next review further out, misses send it back to
// box 1. Intervals are in days, indexed by box.
const INTERVALS = { 1: 1, 2: 2, 3: 4, 4: 9, 5: 21 };
export const MAX_BOX = 5;
const NEW_PER_DAY = 3;
const SESSION_CAP = 8;

export const WORDS_KEY = "ht_vocab_words";
export const SRS_KEY = "ht_vocab_srs";
export const LOG_KEY = "ht_vocab_log";

const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key) || "null") ?? fallback; } catch { return fallback; } };
const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ } };

export const loadWords = () => read(WORDS_KEY, []);
export const saveWords = words => write(WORDS_KEY, words);
export const loadSrs = () => read(SRS_KEY, {});
export const saveSrs = srs => write(SRS_KEY, srs);
export const loadLog = () => read(LOG_KEY, {});
export const saveLog = log => write(LOG_KEY, log);

// Words due today: overdue reviews first (most overdue at the front), then a
// few never-seen words, capped so a session stays short.
export function buildSession(words, srs) {
  const today = todayStr();
  const due = words
    .filter(w => srs[w.id] && srs[w.id].due <= today)
    .sort((a, b) => srs[a.id].due.localeCompare(srs[b.id].due));
  const fresh = words.filter(w => !srs[w.id]).slice(0, NEW_PER_DAY);
  return [...due, ...fresh].slice(0, SESSION_CAP);
}

export function gradeWord(srs, wordId, grade) {
  const today = todayStr();
  const entry = srs[wordId] || { box: 1, due: today, seen: 0, correct: 0 };
  const next = { ...entry, seen: entry.seen + 1 };
  if (grade === "yes") {
    next.correct = entry.correct + 1;
    next.box = Math.min(entry.box + 1, MAX_BOX);
    next.due = addDays(today, INTERVALS[next.box]);
  } else if (grade === "fuzzy") {
    next.due = addDays(today, 1);
  } else {
    next.box = 1;
    next.due = addDays(today, 1);
  }
  return { ...srs, [wordId]: next };
}

export function logPractice(log) {
  const today = todayStr();
  return { ...log, [today]: (log[today] || 0) + 1 };
}

// Parse pasted lines into words. Accepts "word | definition | example",
// tab-separated, or "word: definition".
export function parseImport(text, existing) {
  const words = [];
  const taken = new Set(existing.map(w => w.word.toLowerCase()));
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    let parts;
    if (line.includes("|")) parts = line.split("|");
    else if (line.includes("\t")) parts = line.split("\t");
    else if (line.includes(":")) { const i = line.indexOf(":"); parts = [line.slice(0, i), line.slice(i + 1)]; }
    else continue;
    const [word, def, example] = parts.map(p => p.trim());
    if (!word || !def || taken.has(word.toLowerCase())) continue;
    taken.add(word.toLowerCase());
    words.push({ id: `w_${Date.now()}_${words.length}`, word, def, example: example || "" });
  }
  return words;
}

export const SAMPLE_WORDS = [
  ["ephemeral", "lasting for a very short time", "the ephemeral nature of fashion trends"],
  ["pragmatic", "dealing with things sensibly and realistically", "a pragmatic approach to politics"],
  ["ubiquitous", "present or found everywhere", "smartphones are now ubiquitous"],
  ["candor", "the quality of being open and honest", "she spoke with unusual candor"],
  ["tenacity", "persistent determination", "her tenacity saw the project through"],
  ["eloquent", "fluent and persuasive in speaking or writing", "an eloquent defense of free speech"],
].map(([word, def, example], i) => ({ id: `sample_${i}`, word, def, example }));
