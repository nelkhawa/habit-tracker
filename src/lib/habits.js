// Habit configuration lives in localStorage so anyone can track their own
// habits without touching code. Colors come from a fixed pastel palette.

export const PALETTE = [
  { color: "#6B7FA3", bg: "#E8EDF5" },
  { color: "#8B7EC8", bg: "#EEEDFB" },
  { color: "#5B9FB5", bg: "#E0F0F5" },
  { color: "#9B7EC0", bg: "#EDE8F7" },
  { color: "#5BA898", bg: "#E0F2EE" },
  { color: "#5A7FB8", bg: "#E3EBF7" },
  { color: "#B87A6B", bg: "#F5E8E5" },
  { color: "#6BA888", bg: "#E3F2EC" },
  { color: "#C08A5B", bg: "#F5EDE0" },
  { color: "#7BA8C8", bg: "#E5EFF7" },
];

export const DEFAULT_HABITS = [
  { id: "exercise",  label: "exercise",       weekly: false, ...PALETTE[0] },
  { id: "read",      label: "read 20 min",    weekly: false, ...PALETTE[2] },
  { id: "journal",   label: "journal",        weekly: false, ...PALETTE[1] },
  { id: "meditate",  label: "meditate",       weekly: false, ...PALETTE[4] },
  { id: "review",    label: "weekly review",  weekly: true,  ...PALETTE[6] },
];

// Habit ids retired by the original user — never resurrected by migration.
const RETIRED_IDS = ["linkedin"];

const CONFIG_KEY = "ht_habits";

export function saveHabits(habits) {
  try { localStorage.setItem(CONFIG_KEY, JSON.stringify(habits)); } catch { /* ignore */ }
}

// Load habit config. If none is saved but check data exists (an instance that
// predates configurable habits), rebuild the habit list from the ids found in
// the data so nothing is lost.
export function loadHabits() {
  try {
    const saved = JSON.parse(localStorage.getItem(CONFIG_KEY) || "null");
    if (Array.isArray(saved) && saved.length) return saved;
  } catch { /* fall through */ }

  const migrated = migrateFromCheckData();
  if (migrated) { saveHabits(migrated); return migrated; }
  return DEFAULT_HABITS;
}

function migrateFromCheckData() {
  let checked;
  try { checked = JSON.parse(localStorage.getItem("ht_checked") || "{}"); } catch { return null; }
  const ids = [], weeklyIds = new Set();
  for (const key of Object.keys(checked)) {
    const m = key.match(/^([dw])_(.+)_\d{4}-\d{2}-\d{2}$/);
    if (!m || RETIRED_IDS.includes(m[2])) continue;
    if (!ids.includes(m[2])) ids.push(m[2]);
    if (m[1] === "w") weeklyIds.add(m[2]);
  }
  if (!ids.length) return null;
  return ids.map((id, i) => ({
    id, label: id, weekly: weeklyIds.has(id), ...PALETTE[i % PALETTE.length],
  }));
}

export function makeHabitId(label, existing) {
  const base = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 24) || "habit";
  let id = base, n = 2;
  while (existing.some(h => h.id === id)) id = `${base}-${n++}`;
  return id;
}
