import Anthropic from "@anthropic-ai/sdk";

// Grades a typed vocabulary answer against the stored definition.
// Returns {verdict: "pass"|"fuzzy"|"miss", feedback} — the client maps the
// verdict onto the spaced-repetition schedule.
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "No API key configured." });

  const { word, definition, example, answer } = req.body || {};
  if (![word, definition, answer].every(v => typeof v === "string") || word.length > 200 || definition.length > 1000 || answer.length > 1000) {
    return res.status(400).json({ error: "Invalid payload" });
  }
  if (!answer.trim()) return res.status(200).json({ verdict: "miss", feedback: "No answer given." });

  const prompt = `You are grading a vocabulary flashcard answer.

Word: "${word}"
Correct definition: "${definition}"${example ? `\nExample usage: "${example}"` : ""}
Learner's typed answer: "${answer}"

Grade how well the learner's answer captures the meaning of the word:
- "pass" — the core meaning is captured. Synonyms, paraphrases, informal wording, or capturing one legitimate sense of the word all count. Spelling and grammar are irrelevant.
- "fuzzy" — related or partially right (right neighborhood, wrong emphasis; too vague; only a secondary connotation).
- "miss" — wrong meaning, opposite, or unrelated.

Be fair but not lenient: "pass" must mean they actually know the word.

Respond with ONLY this JSON, nothing else:
{"verdict": "pass" | "fuzzy" | "miss", "feedback": "<one short sentence, max 15 words, explaining the grade>"}`;

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 1000,
      thinking: { type: "adaptive" },
      messages: [{ role: "user", content: prompt }],
    });
    const text = message.content.find(b => b.type === "text")?.text || "";
    const match = text.match(/\{[\s\S]*\}/);
    const parsed = match ? JSON.parse(match[0]) : null;
    if (!parsed || !["pass", "fuzzy", "miss"].includes(parsed.verdict)) throw new Error("Bad grading response");
    return res.status(200).json({ verdict: parsed.verdict, feedback: String(parsed.feedback || "").slice(0, 200) });
  } catch (err) {
    const status = err?.status && err.status >= 400 && err.status < 600 ? err.status : 500;
    return res.status(status).json({ error: err?.message || "Grading failed" });
  }
}
