import { put, list } from "@vercel/blob";

// Cross-device sync backed by Vercel Blob. Each device holding the same sync
// code derives the same 64-hex id (SHA-256 of the code, computed client-side);
// the whole app state is stored as one JSON blob per id, last write wins.
// Requires a Blob store connected to the project (BLOB_READ_WRITE_TOKEN).
export default async function handler(req, res) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(500).json({ error: "No Blob store connected in Vercel." });
  }

  const id = req.method === "GET" ? req.query.id : req.body?.id;
  if (typeof id !== "string" || !/^[a-f0-9]{64}$/.test(id)) {
    return res.status(400).json({ error: "Invalid sync id" });
  }
  const path = `habit-sync/${id}.json`;

  try {
    if (req.method === "GET") {
      const { blobs } = await list({ prefix: path, limit: 1 });
      if (!blobs.length) return res.status(200).json({ updatedAt: 0, data: null });
      // cache-busting query so the CDN can't serve a stale copy
      const r = await fetch(`${blobs[0].url}?t=${Date.now()}`, { cache: "no-store" });
      if (!r.ok) throw new Error(`Blob fetch failed (${r.status})`);
      return res.status(200).json(await r.json());
    }

    if (req.method === "POST") {
      const { data, updatedAt } = req.body || {};
      if (typeof data !== "object" || !data || typeof updatedAt !== "number") {
        return res.status(400).json({ error: "Invalid payload" });
      }
      const body = JSON.stringify({ updatedAt, data });
      if (body.length > 2_000_000) return res.status(413).json({ error: "Sync payload too large" });
      await put(path, body, {
        access: "public",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "application/json",
        cacheControlMaxAge: 60,
      });
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    return res.status(500).json({ error: err?.message || "Sync failed" });
  }
}
