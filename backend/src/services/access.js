const { query } = require("../db/pool");
const {
  allModules,
  isAdminRoleName,
  mergeMatrices,
  legacyPermissionsToMatrix,
  LEGACY_ROLE_MATRIX,
} = require("./permissions");

function roleNamesOf(user) {
  const names = new Set();
  if (user.role) names.add(String(user.role));
  const extra = Array.isArray(user.roles) ? user.roles : [];
  extra.forEach((r) => r && names.add(String(r)));
  return [...names];
}

// Computes the effective permission matrix for a user row (union of roles).
async function resolveAccess(user) {
  const names = roleNamesOf(user);
  const isAdmin = names.some(isAdminRoleName);
  if (isAdmin) {
    return { isAdmin: true, roleNames: names, matrix: allModules(), canViewSensitive: true };
  }

  const result = names.length
    ? await query(
      "SELECT name, matrix, permissions, can_view_sensitive, status, allowed_ips FROM roles WHERE LOWER(name) = ANY($1::text[])",
      [names.map((n) => n.toLowerCase())],
    )
    : { rows: [] };

  const matrices = [];
  let canViewSensitive = false;
  // IP restriction (RP-11): applies only when every active role of the user is restricted.
  let allowedIps = [];
  let unrestricted = false;
  for (const role of result.rows) {
    if (role.status === "Inactive") continue;
    const matrix = role.matrix && Object.keys(role.matrix).length
      ? role.matrix
      : LEGACY_ROLE_MATRIX[String(role.name).toLowerCase()]
        || legacyPermissionsToMatrix(role.permissions || []);
    matrices.push(matrix);
    if (role.can_view_sensitive) canViewSensitive = true;
    if (Array.isArray(role.allowed_ips) && role.allowed_ips.length) allowedIps.push(...role.allowed_ips);
    else unrestricted = true;
  }
  // Per-user extra permissions (legacy list) are merged in as well.
  if (Array.isArray(user.permissions) && user.permissions.length) {
    matrices.push(legacyPermissionsToMatrix(user.permissions));
  }

  return {
    isAdmin: false, roleNames: names, matrix: mergeMatrices(matrices), canViewSensitive,
    allowedIps: unrestricted || !result.rows.length ? null : allowedIps,
  };
}

module.exports = { resolveAccess, roleNamesOf };
