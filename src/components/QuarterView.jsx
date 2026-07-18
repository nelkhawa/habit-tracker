import { dateKey, daysInMonth, MONTHS } from "../lib/dates";

export default function QuarterView({ habits, year, isDone, tk }) {
  const daily = habits.filter(h => !h.weekly);
  return (
    <div>
      <div style={{ fontSize: 12, color: "#888", marginBottom: "1rem" }}>Daily habit completion heatmap — {year}</div>
      {[0, 1, 2, 3].map(q => (
        <div key={q} style={{ marginBottom: "1.5rem" }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: "#1a1a1a", marginBottom: 8 }}>Q{q + 1} — {MONTHS[q * 3]}–{MONTHS[q * 3 + 2]}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {daily.map(h => {
              const months = [q * 3, q * 3 + 1, q * 3 + 2];
              const total = months.reduce((a, m) => a + Array.from({ length: daysInMonth(year, m) }, (_, di) => isDone(h.id, year, m, di + 1) ? 1 : 0).reduce((x, y) => x + y, 0), 0);
              const possible = months.reduce((a, m) => a + daysInMonth(year, m), 0);
              const pct = Math.round((total / possible) * 100);
              return (
                <div key={h.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ fontSize: 11, color: "#888", width: 72, flexShrink: 0, textAlign: "right" }}>{h.label}</div>
                  <div style={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
                    {months.map(m => Array.from({ length: daysInMonth(year, m) }, (_, di) => {
                      const dk = dateKey(year, m, di + 1), done = isDone(h.id, year, m, di + 1), isFuture = dk > tk;
                      return <div key={`${m}_${di}`} title={`${MONTHS[m]} ${di + 1}`} style={{ width: 9, height: 9, borderRadius: 2, background: done ? h.color : isFuture ? "transparent" : "#f0f0f0", border: `0.5px solid ${done ? h.color : "#eee"}`, flexShrink: 0 }} />;
                    }))}
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 500, color: h.color, flexShrink: 0 }}>{pct}%</span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
