import crypto from "node:crypto";

// Two-way bridge to Notion to-do blocks. Each configured section maps to a
// Notion page; the handler locates the page's to-do cluster (top-level
// checkbox blocks, or the first callout containing them), mirrors it, and
// writes toggles/additions back so Notion stays the source of truth.
//
// Env: NOTION_TOKEN            — internal-integration secret (pages must be
//                                shared with the integration)
//      NOTION_TODO_PAGES      — JSON {"section name": "<pageId>", ...}
//      TODO_ACCESS_HASH       — sha256 of the caller's sync id; requests
//                                must present the matching x-sync-id header

const NOTION = "https://api.notion.com/v1";
const HEADERS = token => ({
  Authorization: `Bearer ${token}`,
  "Notion-Version": "2022-06-28",
  "Content-Type": "application/json",
});

async function notion(token, method, path, body) {
  const res = await fetch(`${NOTION}${path}`, {
    method,
    headers: HEADERS(token),
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.message || `Notion ${method} ${path} failed (${res.status})`);
  return json;
}

const plain = rich => (rich || []).map(r => r.plain_text || "").join("");
const toTask = b => ({ id: b.id, text: plain(b.to_do.rich_text), checked: !!b.to_do.checked });

// Find the page's to-do cluster. Returns tasks plus where new ones go:
// {tasks, container} — container is a callout id to append into, or
// {afterId} for a top-level insert.
async function readSection(token, pageId) {
  const { results } = await notion(token, "GET", `/blocks/${pageId}/children?page_size=100`);
  const topTodos = results.filter(b => b.type === "to_do");
  if (topTodos.length) {
    return { tasks: topTodos.map(toTask), target: { afterId: topTodos[topTodos.length - 1].id } };
  }
  // no top-level checkboxes — look inside the first few callouts
  const callouts = results.filter(b => b.type === "callout" && b.has_children).slice(0, 4);
  for (const c of callouts) {
    const kids = await notion(token, "GET", `/blocks/${c.id}/children?page_size=100`);
    const todos = kids.results.filter(b => b.type === "to_do");
    if (todos.length) return { tasks: todos.map(toTask), target: { containerId: c.id } };
  }
  // nothing yet — new tasks go to the top of the page
  return { tasks: [], target: results.length ? { afterId: null, parentTop: true } : {} };
}

export default async function handler(req, res) {
  const token = process.env.NOTION_TOKEN;
  const accessHash = process.env.TODO_ACCESS_HASH;
  let pages;
  try { pages = JSON.parse(process.env.NOTION_TODO_PAGES || "null"); } catch { pages = null; }

  if (!token || !pages) return res.status(501).json({ error: "not_configured" });
  if (!accessHash) return res.status(501).json({ error: "not_configured" });

  const syncId = req.headers["x-sync-id"];
  const presented = typeof syncId === "string" ? crypto.createHash("sha256").update(syncId).digest("hex") : "";
  if (presented !== accessHash) return res.status(403).json({ error: "Not authorized" });

  try {
    if (req.method === "GET") {
      const names = Object.keys(pages);
      const sections = await Promise.all(names.map(async name => {
        const pageId = pages[name];
        try {
          const { tasks } = await readSection(token, pageId);
          return { name, pageId, tasks };
        } catch (err) {
          return { name, pageId, tasks: [], error: err.message };
        }
      }));
      return res.status(200).json({ sections });
    }

    if (req.method === "POST") {
      const { action } = req.body || {};

      if (action === "toggle") {
        const { blockId, checked } = req.body;
        if (typeof blockId !== "string" || typeof checked !== "boolean") return res.status(400).json({ error: "Invalid payload" });
        await notion(token, "PATCH", `/blocks/${blockId}`, { to_do: { checked } });
        return res.status(200).json({ ok: true });
      }

      if (action === "add") {
        const { section, text } = req.body;
        const pageId = pages[section];
        if (!pageId || typeof text !== "string" || !text.trim() || text.length > 500) return res.status(400).json({ error: "Invalid payload" });
        const { target } = await readSection(token, pageId);
        const child = { type: "to_do", to_do: { rich_text: [{ type: "text", text: { content: text.trim() } }], checked: false } };
        const parent = target.containerId || pageId;
        const body = { children: [child] };
        if (target.afterId) body.after = target.afterId;
        const out = await notion(token, "PATCH", `/blocks/${parent}/children`, body);
        const created = out.results?.find(b => b.type === "to_do");
        return res.status(200).json({ ok: true, id: created?.id });
      }

      if (action === "delete") {
        const { blockId } = req.body;
        if (typeof blockId !== "string") return res.status(400).json({ error: "Invalid payload" });
        await notion(token, "DELETE", `/blocks/${blockId}`);
        return res.status(200).json({ ok: true });
      }

      return res.status(400).json({ error: "Unknown action" });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    return res.status(502).json({ error: err?.message || "Notion request failed" });
  }
}
