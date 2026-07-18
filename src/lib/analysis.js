// Builds the coach prompt and calls the analysis endpoint. In production the
// request goes through /api/analyze (key stays server-side); in local dev,
// where Vite doesn't serve the api/ folder, it falls back to calling the
// Anthropic API directly with VITE_ANTHROPIC_API_KEY from .env.

export function buildPrompt(data, coachContext, reflection, learnedEntries) {
  const context = coachContext?.trim()
    ? `Their stated goals and context (use this to judge which habits matter most):\n${coachContext.trim()}`
    : "No personal context provided — judge habits on consistency and trend alone.";

  const learned = learnedEntries?.length
    ? `Things they logged as learned this month (${learnedEntries.length} entries, sample):\n${learnedEntries.slice(-6).map(e => `- ${e}`).join("\n")}`
    : "They logged nothing in their 'one thing I learned' journal this month.";

  return `You are a rigorous, honest habit coach — not a cheerleader. Your job is to tell this person what they NEED to hear, not what feels good. Acknowledge genuine wins briefly and with numbers, then move on.

${context}

Habit data (JSON). Notes on fields: "pct" is completion rate, "lastMonthPct" is the same habit last month, "currentStreak" is consecutive days (or weeks for weekly habits), "longestGapDays" is the longest run of missed days this month, "weekdayPct"/"weekendPct" split completion by part of week, "weekByWeekPct" is the overall trajectory across the weeks of the month.${data.isPartialMonth ? ` IMPORTANT: the month is only ${data.daysElapsed}/${data.daysInMonth} days in — judge rates against days elapsed, not the full month.` : ""}

${JSON.stringify(data, null, 1)}

${learned}

Their written reflection: "${reflection?.trim() || "(no reflection written)"}"

Your analysis must:
- Use the pattern data, not just the totals. Call out weekday/weekend splits, mid-month collapses in the weekly trajectory, and long gaps — these reveal the real story.
- Call out underperformance directly. If a habit is below 70%, say so plainly and name the real-world cost.
- Identify one blind spot — something they are probably rationalising. Look for contradictions between their reflection and the data.
- Point out if they are consistent in "easy" habits but avoiding harder ones.
- Compare against last month per habit: name what improved, what slipped, and ask why about the biggest change.
- End with exactly 3 specific, measurable actions for next month — concrete changes (a trigger, a time, a rule), never "try harder".

Structure (~300 words):
**The month in one sentence** — blunt.
**What actually went well** — only if earned, with numbers.
**Where you're falling short** — specific habits, specific patterns, specific consequences.
**Blind spot** — one thing they're not seeing.
**vs last month** — the trend and what it means.
**3 actions** — numbered, concrete, non-negotiable.

Be direct. Reference actual numbers. Do not be cruel, but do not be soft.`;
}

export async function generateAnalysis(prompt) {
  // Production path: serverless function
  try {
    const res = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.text) return data.text;
      throw new Error(data.error || "Empty response");
    }
    // 404/405 means we're in local dev without the api route — fall through
    if (res.status !== 404 && res.status !== 405) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `Analysis failed (${res.status})`);
    }
  } catch (err) {
    if (!(err instanceof TypeError)) throw err; // network error → try direct
  }

  // Local dev fallback: direct browser call (requires VITE_ANTHROPIC_API_KEY)
  const key = import.meta.env.VITE_ANTHROPIC_API_KEY;
  if (!key) throw new Error("No API route and no VITE_ANTHROPIC_API_KEY set — add one to .env for local dev.");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: "claude-opus-4-8",
      max_tokens: 2000,
      thinking: { type: "adaptive" },
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `Anthropic API error (${res.status})`);
  return data.content?.find(b => b.type === "text")?.text || "Unable to generate analysis.";
}
