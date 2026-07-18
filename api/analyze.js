import Anthropic from "@anthropic-ai/sdk";

// Vercel serverless function — keeps the Anthropic API key out of the client
// bundle. Set ANTHROPIC_API_KEY in your Vercel project environment variables.
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "No API key configured. Set ANTHROPIC_API_KEY in Vercel." });

  const { prompt } = req.body || {};
  if (typeof prompt !== "string" || !prompt.trim() || prompt.length > 50000) {
    return res.status(400).json({ error: "Invalid prompt" });
  }

  const client = new Anthropic({ apiKey });
  try {
    const message = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 2000,
      thinking: { type: "adaptive" },
      messages: [{ role: "user", content: prompt }],
    });
    const text = message.content.find(b => b.type === "text")?.text || "";
    return res.status(200).json({ text });
  } catch (err) {
    const status = err?.status && err.status >= 400 && err.status < 600 ? err.status : 500;
    return res.status(status).json({ error: err?.message || "Analysis request failed" });
  }
}
