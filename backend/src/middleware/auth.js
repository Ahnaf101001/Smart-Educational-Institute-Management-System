const jwt = require("jsonwebtoken");
const env = require("../config/env");
const { query } = require("../db/pool");
const httpError = require("../utils/httpError");
const { resolveAccess } = require("../services/access");
const { can } = require("../services/permissions");

// Verifies the JWT, reloads the user from the database on every request so that
// deactivation / role / permission changes take effect immediately (RP-08, NFR-02).
async function authenticate(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return next(httpError(401, "Authentication token is required."));

  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret);
  } catch {
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

    const access = await resolveAccess(user);
    req.user = {
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
      linkedType: user.linked_type,
      linkedId: user.linked_id,
    };
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

module.exports = { authenticate, authorize, requirePermission, requireAny, hasPermission };
