import { Fragment } from "react";
import { dateKey, DAYS_SHORT } from "../lib/dates";
import { computeStreak } from "../lib/stats";

export default function WeekView({ habits, checked, toggle, isDone, tk }) {
  const daily = habits.filter(h => !h.weekly);
  const today = new Date(), mon = new Date(today), day = mon.getDay();
  mon.setDate(today.getDate() + (day === 0 ? -6 : 1 - day));
  const weekDates = Array.from({ length: 7 }, (_, i) => { const d = new Date(mon); d.setDate(mon.getDate() + i); return d; });
  const dayCounts = weekDates.map(d => daily.filter(h => isDone(h.id, d.getFullYear(), d.getMonth(), d.getDate())).length);
  const bestDayIdx = dayCounts.indexOf(Math.max(...dayCounts));
  return (
    <div>
      <div className="week-grid">
        <div style={{ borderRight: "0.5px solid #eee", borderBottom: "0.5px solid #eee", padding: "8px 12px", fontSize: 11, color: "#888", fontWeight: 500 }}>habit</div>
        {weekDates.map((d, i) => {
          const isToday = dateKey(d.getFullYear(), d.getMonth(), d.getDate()) === tk, isBest = i === bestDayIdx && dayCounts[i] > 0;
          return (
            <div key={i} style={{ borderRight: i < 6 ? "0.5px solid #eee" : "none", borderBottom: "0.5px solid #eee", padding: "8px 4px", textAlign: "center", background: isToday ? "#EEF2FA" : "transparent" }}>
              <div style={{ fontSize: 11, fontWeight: isToday ? 500 : 400, color: isToday ? "#3A5080" : "#888" }}>{DAYS_SHORT[i]}</div>
              <div style={{ fontSize: 12, fontWeight: 500, color: isToday ? "#3A5080" : "#1a1a1a" }}>{d.getDate()}</div>
              {isBest && <div style={{ fontSize: 9, color: "#8B7EC8", fontWeight: 500, marginTop: 1 }}>best</div>}
            </div>
          );
        })}
        {habits.map((h, hi) => {
          const streak = computeStreak(h, checked);
          return (
            <Fragment key={h.id}>
              <div style={{ borderRight: "0.5px solid #eee", borderBottom: hi < habits.length - 1 ? "0.5px solid #eee" : "none", padding: "9px 12px", display: "flex", alignItems: "center", gap: 7 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, border: `1.5px solid ${h.color}`, flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: "#1a1a1a" }}>{h.label}</span>
                {streak > 0 && <span style={{ fontSize: 10, fontWeight: 500, color: h.color, marginLeft: "auto" }}>{streak}{h.weekly ? "w" : "d"}</span>}
              </div>
              {weekDates.map((d, di) => {
                const dk = dateKey(d.getFullYear(), d.getMonth(), d.getDate()), done = isDone(h.id, d.getFullYear(), d.getMonth(), d.getDate()), isFuture = dk > tk, isToday = dk === tk;
                return (
                  <div key={`${h.id}_${di}`} style={{ borderRight: di < 6 ? "0.5px solid #eee" : "none", borderBottom: hi < habits.length - 1 ? "0.5px solid #eee" : "none", background: done ? h.bg : isToday ? "#EEF2FA" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.12s" }}>
                    <button onClick={() => !isFuture && toggle(h.id, d.getFullYear(), d.getMonth(), d.getDate())}
                      style={{ width: 18, height: 18, borderRadius: 4, border: `1.5px solid ${h.color}`, background: done ? h.color : "transparent", cursor: isFuture ? "default" : "pointer", opacity: isFuture ? 0.3 : 1, transition: "all 0.12s", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {done && <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                    </button>
                  </div>
                );
              })}
            </Fragment>
          );
        })}
      </div>
      <div className="week-completion">
        <div style={{ fontSize: 11, color: "#888", padding: "4px 12px", alignSelf: "center" }}>completion</div>
        {weekDates.map((d, i) => {
          const cnt = dayCounts[i], pct = daily.length ? Math.round((cnt / daily.length) * 100) : 0;
          return (
            <div key={i} style={{ padding: "4px 6px", textAlign: "center" }}>
              <div style={{ fontSize: 11, fontWeight: 500, color: pct === 100 ? "#5BA898" : "#888", marginBottom: 3 }}>{pct}%</div>
              <div style={{ height: 3, borderRadius: 2, background: "#f0f0f0" }}>
                <div style={{ height: "100%", width: `${pct}%`, background: i === bestDayIdx && cnt > 0 ? "#8B7EC8" : "#7BA8C8", borderRadius: 2 }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
