// Outgoing webhooks for external system integration (NF-22 / §34 "Open REST API/Webhook").
// Every audited action is published as an event named "<entity>.<action>" (for example
// "fee_payments.create", "approval_requests.approved", "results.publish"). Subscribers
// choose events or "*" and receive a JSON POST signed with
//   X-Signature: sha256=HMAC_SHA256(secret, body)
const crypto = require("node:crypto");
const { query } = require("../db/pool");

const SKIP_ENTITIES = new Set(["webhooks", "webhook_deliveries", "user_sessions", "support_access"]);
let cache = { at: 0, hooks: [] };

async function activeHooks() {
  if (Date.now() - cache.at < 30_000) return cache.hooks;
  try {
    cache = { at: Date.now(), hooks: (await query("SELECT * FROM webhooks WHERE status = 'Active'")).rows };
  } catch {
    cache = { at: Date.now(), hooks: [] };
  }
  return cache.hooks;
}

function invalidate() {
  cache.at = 0;
}

async function deliver(hook, event, data) {
  const body = JSON.stringify({ event, occurredAt: new Date().toISOString(), data });
  const signature = crypto.createHmac("sha256", hook.secret).update(body).digest("hex");
  let status = null;
  let error = null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(hook.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Signature": `sha256=${signature}`, "X-Event": event },
      body,
      signal: controller.signal,
    });
    clearTimeout(timer);
    status = response.status;
    if (!response.ok) error = `HTTP ${response.status}`;
  } catch (e) {
    error = e.name === "AbortError" ? "Timed out" : e.message;
  }
  await query("INSERT INTO webhook_deliveries (webhook_id, event, payload, status_code, error) VALUES ($1,$2,$3,$4,$5)",
    [hook.id, event, body, status, error]).catch(() => {});
  await query("UPDATE webhooks SET last_status = $1, last_error = $2, last_delivery_at = NOW() WHERE id = $3", [status, error, hook.id]).catch(() => {});
  return { status, error };
}

// Fire-and-forget: never blocks or fails the business transaction. The audit row is
// re-checked after a short delay so events from rolled-back transactions are never sent.
function emit(entity, action, auditId, data) {
  if (SKIP_ENTITIES.has(entity)) return;
  const event = `${entity}.${String(action || "").toLowerCase()}`;
  const delays = [1500, 5000, 20000];
  const attempt = async (i) => {
    const hooks = await activeHooks();
    if (!hooks.length) return;
    if (auditId) {
      const committed = await query("SELECT 1 FROM audit_logs WHERE id = $1", [auditId]).catch(() => ({ rowCount: 0 }));
      // Not visible yet: the transaction is still open or was rolled back. Retry, then give up.
      if (!committed.rowCount) {
        if (i + 1 < delays.length) setTimeout(() => attempt(i + 1).catch(() => {}), delays[i + 1] - delays[i]);
        return;
      }
    }
    for (const hook of hooks) {
      const events = hook.events || [];
      if (events.includes("*") || events.includes(event) || events.includes(`${entity}.*`)) {
        deliver(hook, event, data).catch(() => {});
      }
    }
  };
  // A database hiccup while checking hooks must not surface as an unhandled rejection.
  setTimeout(() => attempt(0).catch(() => {}), delays[0]);
}

module.exports = { emit, deliver, invalidate };
