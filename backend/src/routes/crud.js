const express = require("express");
const bcrypt = require("bcryptjs");
const { query } = require("../db/pool");
const resources = require("../resources");
const asyncHandler = require("../utils/asyncHandler");
const httpError = require("../utils/httpError");
const { keysToCamel, objectToSnake } = require("../utils/case");
const { hasPermission } = require("../middleware/auth");
const { writeAudit } = require("../services/audit");
const { encryptField, decryptField } = require("../utils/crypto");

const METHOD_ACTION = { GET: "view", POST: "create", PATCH: "edit", PUT: "edit", DELETE: "delete" };
const HIDDEN_FIELDS = ["password_hash", "otp_hash", "api_key_hash", "pin_hash"];

/** A signed-in school employee (not a guardian / student portal login, not an API key). */
function isStaffAccount(user) {
  return Boolean(user && !user.isApiKey && !["Guardian", "Student"].includes(user.linkedType));
}

function sanitizePayload(body, config, partial = false) {
  const snakeBody = objectToSnake(body || {});
  const payload = {};
  for (const field of config.writable) {
    if (Object.prototype.hasOwnProperty.call(snakeBody, field)) {
      payload[field] = snakeBody[field] === "" && !config.keepEmpty?.includes(field) ? null : snakeBody[field];
    }
  }
  if (!partial) {
    if (["teachers", "staff"].includes(config.table) && !payload.name) {
      payload.name = `${payload.first_name || ""} ${payload.last_name || ""}`.trim();
    }
    for (const [field, value] of Object.entries(config.defaults || {})) {
      if (payload[field] === undefined || payload[field] === null) payload[field] = value;
    }
    const missing = config.required.filter((field) => payload[field] === undefined || payload[field] === null || payload[field] === "");
    if (missing.length) throw httpError(422, "Required fields are missing.", { missing });
  }
  return payload;
}

// JSON/JSONB columns get serialised; native Postgres array columns (config.arrayColumns) do not.
function databaseValue(value, field, config) {
  if (config?.arrayColumns?.includes(field)) {
    if (value === null || value === undefined) return value;
    return (Array.isArray(value) ? value : String(value).split(",")).map((v) => String(v).trim()).filter(Boolean);
  }
  if (value && typeof value === "object" && !(value instanceof Date)) return JSON.stringify(value);
  return value;
}

function maskValue(value) {
  const text = String(value ?? "");
  if (text.length <= 4) return text ? "****" : text;
  return `${text.slice(0, 3)}${"*".repeat(Math.max(3, text.length - 5))}${text.slice(-2)}`;
}

// Strips secrets and masks sensitive fields for users without permission (RP-06).
function present(rows, config, user) {
  const canSee = user?.isAdmin || user?.canViewSensitive;
  return rows.map((row) => {
    const out = { ...row };
    for (const f of HIDDEN_FIELDS) delete out[f];
    for (const f of config.encrypted || []) if (out[f]) out[f] = decryptField(out[f]);
    if (!canSee) for (const f of config.sensitive || []) if (out[f]) out[f] = maskValue(out[f]);
    return out;
  });
}

// Restricts teachers etc. to their class / section scope (RP-04, GDX-08).
function scopeCondition(config, user, values) {
  if (!user || user.isAdmin) return null;
  const genderPart = genderCondition(config, user, values);
  if (!config.scopeColumn) return genderPart;
  const classes = Array.isArray(user.scope?.classIds) ? user.scope.classIds : [];
  const classNames = Array.isArray(user.scope?.classNames) ? user.scope.classNames : [];
  if (!classes.length && !classNames.length) return genderPart;
  const parts = [];
  if (classes.length && config.scopeColumn.id) {
    values.push(classes);
    parts.push(`${config.scopeColumn.id} = ANY($${values.length})`);
  }
  if (classNames.length && config.scopeColumn.name) {
    values.push(classNames.map((c) => `${c}%`));
    parts.push(`${config.scopeColumn.name} ILIKE ANY($${values.length})`);
  }
  const classPart = parts.length ? `(${parts.join(" OR ")})` : null;
  return [classPart, genderPart].filter(Boolean).join(" AND ") || null;
}

// Female / male campus data restriction (RP-10, QM-12).
function genderCondition(config, user, values) {
  const g = user?.genderScope;
  if (!config.genderColumn || !g || g === "All") return null;
  values.push(g);
  return `${config.genderColumn} = $${values.length}`;
}

function outOfScope(config, user, row) {
  if (!user || user.isAdmin) return false;
  const g = user.genderScope;
  if (config.genderColumn && g && g !== "All" && row[config.genderColumn] && row[config.genderColumn] !== g) return true;
  const ids = Array.isArray(user.scope?.classIds) ? user.scope.classIds : [];
  const names = Array.isArray(user.scope?.classNames) ? user.scope.classNames : [];
  if (config.scopeColumn && (ids.length || names.length)) {
    const okId = config.scopeColumn.id && ids.includes(row[config.scopeColumn.id]);
    const okName = config.scopeColumn.name && names.some((n) => String(row[config.scopeColumn.name] || "").startsWith(n));
    if (!okId && !okName) return true;
  }
  return false;
}

function createCrudRouter(resourceName) {
  const config = resources[resourceName];
  if (!config) throw new Error(`Unknown API resource: ${resourceName}`);
  const router = express.Router();
  const moduleKey = config.module;

  router.use((req, res, next) => {
    const action = METHOD_ACTION[req.method] || "view";
    if (config.selfService && req.method !== "DELETE" && req.user?.linkedType) return next();
    // Read-only access for roles whose work depends on this list (e.g. marks entry needs the
    // exam list). Writes still require the resource's own module permission.
    if (req.method === "GET" && (config.alsoReadableBy || []).some((m) => hasPermission(req.user, m, "view"))) return next();
    // Dropdown lookup: staff whose pages pick a teacher / user (routine, homework, attendance…)
    // may list only the harmless lookup columns – never phone, salary, NID or email.
    if (req.method === "GET" && req.path === "/" && config.lookupFields && isStaffAccount(req.user)
        && moduleKey && !hasPermission(req.user, moduleKey, "view")) {
      req.lookupOnly = true;
      return next();
    }
    if (moduleKey && !hasPermission(req.user, moduleKey, action)) {
      return next(httpError(403, `You do not have '${action}' permission for ${config.label || resourceName}.`));
    }
    next();
  });

  router.get("/", asyncHandler(async (req, res) => {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(1000, Math.max(1, Number(req.query.limit || 20)));
    const offset = (page - 1) * limit;
    const conditions = [];
    const values = [];

    if (config.softDelete && req.query.includeArchived !== "true") {
      conditions.push(`${config.softDelete.column} IS DISTINCT FROM '${config.softDelete.value}'`);
    }
    // Lookup mode searches the visible columns only, so hidden ones (phone, email) cannot be probed.
    const searchFields = req.lookupOnly ? config.search.filter((f) => config.lookupFields.includes(f)) : config.search;
    if (req.query.search && searchFields.length) {
      values.push(`%${req.query.search}%`);
      conditions.push(`(${searchFields.map((field) => `${field}::text ILIKE $${values.length}`).join(" OR ")})`);
    }
    for (const filter of config.filters) {
      const camelFilter = filter.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      const value = req.query[camelFilter] ?? req.query[filter];
      if (value !== undefined && value !== "") {
        values.push(value);
        conditions.push(`${filter}::text = $${values.length}`);
      }
    }
    if (config.dateColumn) {
      if (req.query.from) { values.push(req.query.from); conditions.push(`${config.dateColumn} >= $${values.length}`); }
      if (req.query.to) { values.push(req.query.to); conditions.push(`${config.dateColumn} <= $${values.length}`); }
    }
    const scope = scopeCondition(config, req.user, values);
    if (scope) conditions.push(scope);

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const countResult = await query(`SELECT COUNT(*)::int AS total FROM ${config.table} ${where}`, values);
    values.push(limit, offset);
    const columns = req.lookupOnly ? config.lookupFields.join(", ") : "*";
    const result = await query(
      `SELECT ${columns} FROM ${config.table} ${where}
       ORDER BY ${config.orderBy || "created_at DESC"}
       LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values,
    );
    res.json({
      success: true,
      data: keysToCamel(req.lookupOnly ? result.rows : present(result.rows, config, req.user)),
      pagination: {
        page, limit, total: countResult.rows[0].total, pages: Math.ceil(countResult.rows[0].total / limit),
      },
    });
  }));

  router.get("/:id", asyncHandler(async (req, res) => {
    const result = await query(`SELECT * FROM ${config.table} WHERE id::text = $1`, [req.params.id]);
    if (!result.rowCount || outOfScope(config, req.user, result.rows[0])) throw httpError(404, `${config.label || resourceName} record not found.`);
    res.json({ success: true, data: keysToCamel(present(result.rows, config, req.user)[0]) });
  }));

  router.post("/", asyncHandler(async (req, res) => {
    const payload = sanitizePayload(req.body, config);
    if (resourceName === "users") {
      if (!payload.password_hash) throw httpError(422, "A password is required for new users.");
      if (String(payload.password_hash).length < 8) throw httpError(422, "Password must be at least 8 characters.");
      payload.password_hash = await bcrypt.hash(String(payload.password_hash), 12);
    }
    if (config.beforeCreate) await config.beforeCreate(payload, req);
    for (const f of config.encrypted || []) if (payload[f] !== undefined) payload[f] = encryptField(payload[f]);
    const fields = Object.keys(payload);
    // Records such as book issues are created by their own workflow route; an empty INSERT would be a 500.
    if (!fields.length) throw httpError(422, `No valid fields to save for ${config.label || resourceName}.`);
    const result = await query(
      `INSERT INTO ${config.table} (${fields.join(", ")})
       VALUES (${fields.map((_, i) => `$${i + 1}`).join(", ")}) RETURNING *`,
      Object.entries(payload).map(([f, v]) => databaseValue(v, f, config)),
    );
    const row = result.rows[0];
    await writeAudit(req, { entity: config.table, entityId: row.id, action: "CREATE", newValue: row });
    if (config.afterCreate) await config.afterCreate(row, req);
    res.status(201).json({ success: true, data: keysToCamel(present([row], config, req.user)[0]) });
  }));

  router.patch("/:id", asyncHandler(async (req, res) => {
    const payload = sanitizePayload(req.body, config, true);
    if (!Object.keys(payload).length) throw httpError(422, "No valid fields were provided.");
    const before = await query(`SELECT * FROM ${config.table} WHERE id::text = $1`, [req.params.id]);
    if (!before.rowCount) throw httpError(404, `${config.label || resourceName} record not found.`);
    const old = before.rows[0];
    if (config.immutable && config.immutable(old)) {
      throw httpError(409, "This record is locked. Use the correction/approval workflow to change it.");
    }

    if (resourceName === "users") {
      if (payload.password_hash) {
        if (String(payload.password_hash).length < 8) throw httpError(422, "Password must be at least 8 characters.");
        payload.password_hash = await bcrypt.hash(String(payload.password_hash), 12);
        payload.token_version = Number(old.token_version || 0) + 1;
      }
      if (payload.status === "Inactive") payload.token_version = Number(old.token_version || 0) + 1;
      if (old.id === "USR-1" && payload.status === "Inactive") throw httpError(403, "The primary admin cannot be deactivated.");
    }
    if (outOfScope(config, req.user, old)) throw httpError(404, `${config.label || resourceName} record not found.`);
    if (config.beforeUpdate) await config.beforeUpdate(payload, old, req);
    for (const f of config.encrypted || []) if (payload[f] !== undefined) payload[f] = encryptField(payload[f]);

    const fields = Object.keys(payload);
    const values = Object.entries(payload).map(([f, v]) => databaseValue(v, f, config));
    values.push(req.params.id);
    const result = await query(
      `UPDATE ${config.table} SET ${fields.map((f, i) => `${f} = $${i + 1}`).join(", ")}
       WHERE id::text = $${values.length} RETURNING *`,
      values,
    );
    const row = result.rows[0];
    const changedOld = {};
    const changedNew = {};
    for (const f of fields) {
      if (JSON.stringify(old[f]) !== JSON.stringify(row[f])) { changedOld[f] = old[f]; changedNew[f] = row[f]; }
    }
    await writeAudit(req, {
      entity: config.table, entityId: row.id, action: resourceName === "roles" ? "PERMISSION_CHANGE" : "UPDATE",
      oldValue: changedOld, newValue: changedNew, reason: req.body?.reason,
    });
    if (config.afterUpdate) await config.afterUpdate(row, old, req);
    res.json({ success: true, data: keysToCamel(present([row], config, req.user)[0]) });
  }));

  router.delete("/:id", asyncHandler(async (req, res) => {
    const before = await query(`SELECT * FROM ${config.table} WHERE id::text = $1`, [req.params.id]);
    if (!before.rowCount) throw httpError(404, `${config.label || resourceName} record not found.`);
    const old = before.rows[0];

    if (config.noDelete) {
      throw httpError(409, config.noDelete === true
        ? "Financial and academic history cannot be deleted. Use cancellation / reversal instead."
        : config.noDelete);
    }
    if (resourceName === "users" && (old.id === "USR-1" || ["admin", "super admin", "school admin"].includes(String(old.role).toLowerCase()))) {
      throw httpError(403, "Admin user cannot be deleted. Deactivate the account instead.");
    }
    if (config.softDelete) {
      // NFR-07: archive instead of hard delete, keeping results / fee history.
      await query(
        `UPDATE ${config.table} SET ${config.softDelete.column} = $1 ${config.softDelete.stamp ? `, ${config.softDelete.stamp} = NOW()` : ""} WHERE id::text = $2`,
        [config.softDelete.value, req.params.id],
      );
      await writeAudit(req, { entity: config.table, entityId: old.id, action: "ARCHIVE", oldValue: old, reason: req.query.reason });
      return res.status(204).send();
    }
    await query(`DELETE FROM ${config.table} WHERE id::text = $1`, [req.params.id]);
    await writeAudit(req, { entity: config.table, entityId: old.id, action: "DELETE", oldValue: old, reason: req.query.reason });
    res.status(204).send();
  }));

  return router;
}

module.exports = createCrudRouter;
