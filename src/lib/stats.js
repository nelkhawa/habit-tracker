import { dateKey, getMondayKey, daysInMonth, MONTHS } from "./dates";

// Every habit is checked per-day; "weekly" only changes how stats and streaks
// are counted (per week instead of per day).
export const getKey = (hid, y, m, d) => `d_${hid}_${dateKey(y, m, d)}`;

export function computeStreak(habit, checked) {
  const d = new Date();
  if (habit.weekly) {
    // consecutive weeks (ending this week) with at least one checked day
    let s = 0;
    const mon = new Date(d), day = mon.getDay();
    mon.setDate(mon.getDate() + (day === 0 ? -6 : 1 - day));
    while (true) {
      let any = false;
      for (let i = 0; i < 7; i++) {
        const dd = new Date(mon); dd.setDate(mon.getDate() + i);
        if (checked[getKey(habit.id, dd.getFullYear(), dd.getMonth(), dd.getDate())]) { any = true; break; }
      }
      if (any) { s++; mon.setDate(mon.getDate() - 7); } else break;
    }
    return s;
  }
  let s = 0;
  while (true) {
    if (checked[getKey(habit.id, d.getFullYear(), d.getMonth(), d.getDate())]) { s++; d.setDate(d.getDate() - 1); }
    else break;
  }
  return s;
}

export function weeksInMonth(y, m) {
  const wks = [], d = new Date(y, m, 1);
  while (d.getMonth() === m) {
    const wk = getMondayKey(d.getFullYear(), d.getMonth(), d.getDate());
    if (!wks.includes(wk)) wks.push(wk);
    d.setDate(d.getDate() + 7);
  }
  return wks.length;
}

export function getMonthStats(habits, y, m, checked) {
  const days = daysInMonth(y, m);
  return habits.map(h => {
    let done = 0;
    for (let dd = 1; dd <= days; dd++) if (checked[getKey(h.id, y, m, dd)]) done++;
    const possible = h.weekly ? weeksInMonth(y, m) : days;
    return { ...h, done, possible, pct: possible ? Math.round((done / possible) * 100) : 0 };
  });
}

// Rich, structured data for the AI coach — patterns the model can actually
// reason about instead of a single percentage per habit.
export function buildAnalysisData(habits, year, month, checked, extras) {
  const days = daysInMonth(year, month);
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
  const elapsed = isCurrentMonth ? Math.min(today.getDate(), days) : days;
  const prevM = month === 0 ? 11 : month - 1, prevY = month === 0 ? year - 1 : year;

  const stats = getMonthStats(habits, year, month, checked);
  const prevStats = getMonthStats(habits, prevY, prevM, checked);

  const perHabit = stats.map(h => {
    const prev = prevStats.find(p => p.id === h.id);
    // weekday distribution + longest gap
    const byWeekday = [0, 0, 0, 0, 0, 0, 0]; // Mon..Sun
    const weekdayPossible = [0, 0, 0, 0, 0, 0, 0];
    let gap = 0, maxGap = 0;
    for (let d = 1; d <= elapsed; d++) {
      const dow = (new Date(year, month, d).getDay() + 6) % 7;
      weekdayPossible[dow]++;
      if (checked[getKey(h.id, year, month, d)]) { byWeekday[dow]++; gap = 0; }
      else { gap++; if (gap > maxGap) maxGap = gap; }
    }
    const weekendDone = byWeekday[5] + byWeekday[6], weekendPossible = weekdayPossible[5] + weekdayPossible[6];
    const weekdayDone = byWeekday.slice(0, 5).reduce((a, b) => a + b, 0);
    const weekdayTotal = weekdayPossible.slice(0, 5).reduce((a, b) => a + b, 0);
    return {
      habit: h.label,
      cadence: h.weekly ? "weekly" : "daily",
      done: h.done, possible: h.possible, pct: h.pct,
      lastMonthPct: prev ? prev.pct : null,
      currentStreak: computeStreak(h, checked),
      longestGapDays: h.weekly ? undefined : maxGap,
      weekdayPct: weekdayTotal ? Math.round((weekdayDone / weekdayTotal) * 100) : 0,
      weekendPct: weekendPossible ? Math.round((weekendDone / weekendPossible) * 100) : 0,
    };
  });

  // week-by-week trajectory across all daily habits
  const dailyHabits = habits.filter(h => !h.weekly);
  const weekly = [];
  for (let start = 1; start <= elapsed; start += 7) {
    const end = Math.min(start + 6, elapsed);
    let done = 0, possible = 0;
    for (let d = start; d <= end; d++) for (const h of dailyHabits) {
      possible++;
      if (checked[getKey(h.id, year, month, d)]) done++;
    }
    weekly.push(possible ? Math.round((done / possible) * 100) : 0);
  }

  return {
    month: `${MONTHS[month]} ${year}`,
    lastMonth: `${MONTHS[prevM]} ${prevY}`,
    daysElapsed: elapsed,
    daysInMonth: days,
    isPartialMonth: isCurrentMonth,
    habits: perHabit,
    weekByWeekPct: weekly,
    ...extras,
  };
}
