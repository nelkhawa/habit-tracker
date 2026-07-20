// Cross-device sync client. A sync code (random, generated once) is shared
// between devices; its SHA-256 hash is the server-side storage id, so the
// code itself never leaves the device. The whole ht_* localStorage state is
// pushed as one document, last write wins.

const META_KEY = "ht_sync";
const MODIFIED_KEY = "ht_last_modified";
// keys that describe sync itself and must never be synced
const LOCAL_ONLY = [META_KEY, MODIFIED_KEY];

export function getSyncConfig() {
  try { return JSON.parse(localStorage.getItem(META_KEY) || "null"); } catch { return null; }
}

function setSyncConfig(cfg) {
  try {
    if (cfg) localStorage.setItem(META_KEY, JSON.stringify(cfg));
    else localStorage.removeItem(META_KEY);
  } catch { /* ignore */ }
}

export function generateSyncCode() {
  const alphabet = "ABCDEFGHJKMNPQRSTVWXYZ23456789"; // no lookalikes
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const chars = [...bytes].map(b => alphabet[b % alphabet.length]);
  return `${chars.slice(0, 4).join("")}-${chars.slice(4, 8).join("")}-${chars.slice(8, 12).join("")}-${chars.slice(12).join("")}`;
}

async function syncIdFromCode(code) {
  const bytes = new TextEncoder().encode(`habit-tracker:${code.trim().toUpperCase()}`);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, "0")).join("");
}

export const markDirty = () => {
  try { localStorage.setItem(MODIFIED_KEY, String(Date.now())); } catch { /* ignore */ }
};

const lastModified = () => Number(localStorage.getItem(MODIFIED_KEY)) || 0;

function snapshot() {
  const data = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith("ht_") && !LOCAL_ONLY.includes(k)) data[k] = localStorage.getItem(k);
  }
  return data;
}

function applyRemote(data, updatedAt) {
  const keep = new Set(Object.keys(data));
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const k = localStorage.key(i);
    if (k?.startsWith("ht_") && !LOCAL_ONLY.includes(k) && !keep.has(k)) localStorage.removeItem(k);
  }
  for (const [k, v] of Object.entries(data)) localStorage.setItem(k, v);
  localStorage.setItem(MODIFIED_KEY, String(updatedAt));
}

async function request(method, id, body) {
  const res = await fetch(method === "GET" ? `/api/sync?id=${id}` : "/api/sync", {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Sync request failed (${res.status})`);
  return json;
}

export async function pushNow() {
  const cfg = getSyncConfig();
  if (!cfg?.code) return null;
  const id = await syncIdFromCode(cfg.code);
  const updatedAt = lastModified() || Date.now();
  await request("POST", id, { id, updatedAt, data: snapshot() });
  setSyncConfig({ ...cfg, lastSync: Date.now() });
  return updatedAt;
}

// Pull remote state; if it's newer than local, apply it and report so the
// caller can reload UI state. If local is newer, push instead.
export async function syncNow() {
  const cfg = getSyncConfig();
  if (!cfg?.code) return { status: "disabled" };
  const id = await syncIdFromCode(cfg.code);
  const remote = await request("GET", id);
  const local = lastModified();
  if (remote.data && remote.updatedAt > local) {
    applyRemote(remote.data, remote.updatedAt);
    setSyncConfig({ ...getSyncConfig(), lastSync: Date.now() });
    return { status: "applied" };
  }
  if (local > (remote.updatedAt || 0)) { await pushNow(); return { status: "pushed" }; }
  setSyncConfig({ ...cfg, lastSync: Date.now() });
  return { status: "in-sync" };
}

// Enable sync on this device with a fresh code (first device) …
export async function enableSync() {
  const code = generateSyncCode();
  setSyncConfig({ code, lastSync: null });
  markDirty();
  await pushNow();
  return code;
}

// … or connect using a code from another device (pulls that device's data if newer).
export async function connectSync(code) {
  if (!code?.trim()) throw new Error("Enter a sync code");
  setSyncConfig({ code: code.trim().toUpperCase(), lastSync: null });
  const result = await syncNow();
  return result;
}

export function disableSync() { setSyncConfig(null); }

let pushTimer = null;
export function schedulePush(onError) {
  if (!getSyncConfig()?.code) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => { pushNow().catch(err => onError?.(err)); }, 1500);
}
