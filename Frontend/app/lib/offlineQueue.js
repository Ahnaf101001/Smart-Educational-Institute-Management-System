// Offline attendance drafts (SRS v3 ATT-06, v1 AT-09 / TA-03 / NF-38).
// When the network is unavailable the marked register is kept on this device and
// synced when the connection returns. The server still validates every sync
// (edit window, duplicates, permissions) and writes the audit log.
const KEY = "edumanage-offline-attendance";

function read() {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
}
function write(items) {
  try { localStorage.setItem(KEY, JSON.stringify(items)); } catch { /* storage full or blocked */ }
  try { window.dispatchEvent(new CustomEvent("edumanage:offline-queue", { detail: items.length })); } catch { /* ignore */ }
}

export function isNetworkError(error) {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  return error instanceof TypeError || [502, 503, 504].includes(error?.status) || /fetch failed|network|Cannot reach the API/i.test(error?.message || "");
}

export function pendingAttendance() {
  return typeof window === "undefined" ? [] : read();
}

export function queueAttendance(payload) {
  const items = read().filter((i) => !(i.payload.className === payload.className && i.payload.date === payload.date));
  items.push({ id: `${payload.className}|${payload.date}`, payload, savedAt: new Date().toISOString(), error: null });
  write(items);
  return items.length;
}

// Sends queued registers; keeps failures (with the server's reason) for review.
export async function flushAttendance(send) {
  const items = read();
  if (!items.length) return { synced: 0, failed: 0 };
  let synced = 0;
  const remaining = [];
  for (const item of items) {
    try {
      await send(item.payload);
      synced += 1;
    } catch (error) {
      if (isNetworkError(error)) { remaining.push(item); break; }
      remaining.push({ ...item, error: error.message || "Rejected by server" });
    }
  }
  const untouched = items.slice(synced + remaining.length);
  write([...remaining, ...untouched]);
  return { synced, failed: remaining.filter((r) => r.error).length };
}

export function discardAttendance(id) {
  write(read().filter((i) => i.id !== id));
}

// Generic offline queue for other teacher entries (e.g. hifz daily log, v1 QM-13).
const keyFor = (kind) => `edumanage-offline-${kind}`;
export function pendingItems(kind) {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(keyFor(kind)) || "[]"); } catch { return []; }
}
export function queueItem(kind, payload) {
  const items = [...pendingItems(kind), { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, payload, savedAt: new Date().toISOString(), error: null }];
  try { localStorage.setItem(keyFor(kind), JSON.stringify(items)); } catch { /* ignore */ }
  return items.length;
}
export async function flushItems(kind, send) {
  const items = pendingItems(kind);
  const keep = [];
  let synced = 0;
  for (let i = 0; i < items.length; i += 1) {
    try { await send(items[i].payload); synced += 1; } catch (error) {
      if (isNetworkError(error)) { keep.push(...items.slice(i)); break; }
      keep.push({ ...items[i], error: error.message || "Rejected by server" });
    }
  }
  try { localStorage.setItem(keyFor(kind), JSON.stringify(keep)); } catch { /* ignore */ }
  return { synced, remaining: keep.length };
}
