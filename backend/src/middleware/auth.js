const crypto = require("node:crypto");
const jwt = require("jsonwebtoken");
const env = require("../config/env");
const { query } = require("../db/pool");
const httpError = require("../utils/httpError");
const { resolveAccess } = require("../services/access");
const { can } = require("../services/permissions");

// req.ip honours X-Forwarded-For only from trusted proxies (see "trust proxy" in app.js).
function clientIp(req) {
  return String(req.ip || req.socket?.remoteAddress || "").trim().replace(/^::ffff:/, "");
}

// Supports exact IPs, trailing wildcards (192.168.1.*) and IPv4 CIDR (10.0.0.0/24).
function ipAllowed(ip, patterns) {
  const toInt = (v) => v.split(".").reduce((acc, part) => (acc << 8) + Number(part), 0) >>> 0;
  return patterns.some((raw) => {
    const p = String(raw).trim();
    if (!p) return false;
    if (p === ip) return true;
    if (p.endsWith("*")) return ip.startsWith(p.slice(0, -1));
    if (p.includes("/") && /^\d+\.\d+\.\d+\.\d+$/.test(ip)) {
      const [base, bits] = p.split("/");
      const mask = Number(bits) === 0 ? 0 : (~0 << (32 - Number(bits))) >>> 0;
      return (toInt(ip) & mask) === (toInt(base) & mask);
    }
    return false;
  });
}

function buildUser(user, access, extra = {}) {
  return {
    sub: user.id,
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    roles: access.roleNames,
    isAdmin: access.isAdmin,
    matrix: access.matrix,
    canViewSensitive: access.canViewSensitive,
    scope: user.scope || {},
    genderScope: user.gender_scope || "All",
    isSupport: Boolean(user.is_support),
    linkedType: user.linked_type,
    linkedId: user.linked_id,
    ...extra,
  };
}

// Open REST API access with an API key (NF-22 / §34). Keys carry a role; read-only unless can_write.
async function authenticateApiKey(req, key) {
  const prefix = key.slice(0, 12);
  const row = (await query("SELECT * FROM api_keys WHERE key_prefix = $1 AND status = 'Active'", [prefix])).rows[0];
  const hash = crypto.createHash("sha256").update(key).digest("hex");
  if (!row || row.api_key_hash.length !== hash.length || !crypto.timingSafeEqual(Buffer.from(row.api_key_hash), Buffer.from(hash))) {
    throw httpError(401, "API key is invalid.");
  }
  if (row.expires_at && new Date(row.expires_at) < new Date()) throw httpError(401, "API key has expired.");
  if (!row.can_write && !["GET", "HEAD"].includes(req.method)) throw httpError(403, "This API key is read-only.");
  const pseudo = { id: `API:${row.id}`, name: `API key: ${row.name}`, email: null, role: row.role, roles: [row.role], scope: {} };
  const access = await resolveAccess(pseudo);
  query("UPDATE api_keys SET last_used_at = NOW() WHERE id = $1", [row.id]).catch(() => {});
  return buildUser(pseudo, { ...access, isAdmin: false }, { isApiKey: true });
}

// Verifies the JWT, reloads the user from the database on every request so that
// deactivation / role / permission changes take effect immediately (RP-08, NFR-02).
async function authenticate(req, res, next) {
  const apiKey = req.headers["x-api-key"];
  if (apiKey) {
    try {
      req.user = await authenticateApiKey(req, String(apiKey));
      return next();
    } catch (error) {
      return next(error);
    }
  }

  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return next(httpError(401, "Authentication token is required."));

  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret);
  } catch {
    return next(httpError(401, "Authentication token is invalid or expired."));
  }
  // 2FA / OTP-login challenge tokens are signed with the same secret but carry a `purpose`
  // claim; they only unlock the OTP verification step and must never work as a session.
  if (payload.purpose) {
    return next(httpError(401, "Authentication token is invalid or expired."));
  }

  try {
    const result = await query("SELECT * FROM users WHERE id = $1", [payload.sub]);
    const user = result.rows[0];
    if (!user || user.status !== "Active") {
      return next(httpError(401, "Your account is inactive. Please contact the administrator."));
    }
    if (Number(payload.tv || 0) !== Number(user.token_version || 0)) {
      return next(httpError(401, "Your session has ended. Please sign in again."));
    }
    // Time-limited support / temporary accounts (RP-13).
    if (user.access_expires_at && new Date(user.access_expires_at) < new Date()) {
      return next(httpError(401, "Your access period has ended."));
    }
    // Device sessions (GA-05): a revoked device session stops working immediately.
    if (payload.sid) {
      const session = (await query("SELECT revoked_at, last_seen_at FROM user_sessions WHERE id = $1", [payload.sid])).rows[0];
      if (!session || session.revoked_at) return next(httpError(401, "This device was signed out. Please sign in again."));
      if (Date.now() - new Date(session.last_seen_at).getTime() > 60_000) {
        query("UPDATE user_sessions SET last_seen_at = NOW(), ip = $2 WHERE id = $1", [payload.sid, clientIp(req)]).catch(() => {});
      }
    }

    const access = await resolveAccess(user);
    if (!access.isAdmin && Array.isArray(access.allowedIps) && !ipAllowed(clientIp(req), access.allowedIps)) {
      return next(httpError(403, "Access from this network/device is not allowed for your role."));
    }
    req.user = buildUser(user, access, { sessionId: payload.sid || null });

    // Support staff access is always logged (RP-13, NF-47).
    if (user.is_support) {
      const { writeAudit } = require("../services/audit");
      writeAudit(req, { entity: "support_access", entityId: user.id, action: `${req.method} ${req.originalUrl}`.slice(0, 200) }).catch(() => {});
    }
    next();
  } catch (error) {
    next(error);
  }
}

function hasPermission(user, module, action) {
  if (!user) return false;
  if (user.isAdmin) return true;
  return can(user.matrix, module, action);
}

// Server-side permission enforcement (NFR-02 / NFX-07).
function requirePermission(module, action = "view") {
  return function permissionGuard(req, res, next) {
    if (!hasPermission(req.user, module, action)) {
      return next(httpError(403, `You do not have '${action}' permission for ${module}.`));
    }
    next();
  };
}

// Accepts any of several (module, action) pairs.
function requireAny(...pairs) {
  return function anyGuard(req, res, next) {
    if (pairs.some(([m, a]) => hasPermission(req.user, m, a))) return next();
    next(httpError(403, "You do not have permission to perform this action."));
  };
}

function authorize(...roles) {
  return function authorizeRole(req, res, next) {
    if (!req.user) return next(httpError(401, "Authentication required."));
    if (req.user.isAdmin) return next();
    const userRoles = (req.user.roles || []).map((r) => r.toLowerCase());
    if (!roles.some((r) => userRoles.includes(r.toLowerCase()))) {
      return next(httpError(403, "You do not have permission to perform this action."));
    }
    next();
  };
}

module.exports = { authenticate, authorize, requirePermission, requireAny, hasPermission, clientIp, ipAllowed };
