const { query } = require("../db/pool");

// Never persist secrets or one-time codes in logs (NFR-14).
const SECRET_KEYS = new Set([
  "password", "password_hash", "passwordHash", "plain_password", "otp", "otp_hash",
  "otpHash", "token", "api_key", "apiKey", "api_key_hash", "secret",
]);

function scrub(value) {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(scrub);
  if (typeof value === "object" && !(value instanceof Date)) {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = SECRET_KEYS.has(k) ? "[redacted]" : scrub(v);
    }
    return out;
  }
  return value;
}

function requestMeta(req) {
  if (!req) return { ip: null, userAgent: null };
  const forwarded = req.headers?.["x-forwarded-for"];
  return {
    ip: (forwarded ? String(forwarded).split(",")[0] : req.ip) || null,
    userAgent: req.headers?.["user-agent"] || null,
  };
}

// Writes one immutable audit row. `executor` may be a transaction client.
async function writeAudit(req, { entity, entityId, action, oldValue, newValue, reason }, executor) {
  const run = executor ? executor.query.bind(executor) : query;
  const meta = requestMeta(req);
  try {
    const inserted = await run(
      `INSERT INTO audit_logs (user_id, user_name, entity, entity_id, action, old_value, new_value, reason, ip, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
      [
        req?.user?.id || null,
        req?.user?.name || null,
        entity,
        entityId ? String(entityId) : null,
        action,
        oldValue === undefined ? null : JSON.stringify(scrub(oldValue)),
        newValue === undefined ? null : JSON.stringify(scrub(newValue)),
        reason || null,
        meta.ip,
        meta.userAgent,
      ],
    );
    // Publish to webhook subscribers (NF-22). Login/auth events are not published.
    if (!["LOGIN", "LOGIN_FAILED", "PIN_SET", "PASSWORD_CHANGE", "LOGOUT_ALL", "DEVICE_LOGOUT"].includes(action)) {
      require("./webhooks").emit(entity, action, inserted.rows[0]?.id, {
        entityId: entityId ? String(entityId) : null, by: req?.user?.name || null, reason: reason || null,
        newValue: newValue === undefined ? null : scrub(newValue),
      });
    }
  } catch (error) {
    // Auditing must not silently hide failures inside transactions.
    if (executor) throw error;
    console.error("Audit log write failed:", error.message);
  }
}

module.exports = { writeAudit, scrub };
