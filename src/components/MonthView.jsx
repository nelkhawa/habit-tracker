import { dateKey, daysInMonth, firstDayOffset, DAYS_SHORT } from "../lib/dates";

export default function MonthView({ habits, year, month, toggle, isDone, tk }) {
  const days = daysInMonth(year, month), offset = firstDayOffset(year, month);
  const cells = Array.from({ length: offset + days }, (_, i) => i < offset ? null : i - offset + 1);
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks = Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));
  return (
    <div className="cal-grid">
      <div className="cal-header">
        {DAYS_SHORT.map((d, i) => <div key={i} className="cal-day-head" style={{ borderRight: i < 6 ? "0.5px solid #eee" : "none" }}>{d}</div>)}
      </div>
      {weeks.map((week, wi) => (
        <div key={wi} className="cal-week" style={{ borderBottom: wi < weeks.length - 1 ? "0.5px solid #eee" : "none" }}>
          {week.map((day, di) => {
            const dk = day ? dateKey(year, month, day) : null, isToday = dk === tk, isFuture = dk && dk > tk;
            return (
              <div key={di} className="cal-cell" style={{ borderRight: di < 6 ? "0.5px solid #eee" : "none", background: isToday ? "#EEF2FA" : "transparent" }}>
                {day && (<>
                  <div className="cal-date" style={{ fontWeight: isToday ? 500 : 400, color: isToday ? "#3A5080" : "#aaa" }}>{day}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    {habits.map(h => {
                      const done = isDone(h.id, year, month, day);
                      return (
                        <button key={h.id} onClick={() => !isFuture && toggle(h.id, year, month, day)}
                          style={{ display: "flex", alignItems: "center", gap: 4, background: done ? h.bg : "transparent", border: `0.5px solid ${done ? h.color : "transparent"}`, borderRadius: 4, cursor: isFuture ? "default" : "pointer", padding: "1px 3px", opacity: isFuture ? 0.3 : 1, textAlign: "left", width: "100%", transition: "all 0.12s", boxSizing: "border-box" }}>
                          <div style={{ width: 10, height: 10, borderRadius: 2, border: `1.5px solid ${h.color}`, background: done ? h.color : "transparent", flexShrink: 0, transition: "all 0.12s" }} />
                          <span style={{ fontSize: 14, color: done ? h.color : "#999", textDecoration: done ? "line-through" : "none", lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontWeight: done ? 500 : 400 }}>{h.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </>)}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
