const express = require("express");
const { query } = require("../db/pool");
const asyncHandler = require("../utils/asyncHandler");
const { keysToCamel } = require("../utils/case");
const { requirePermission } = require("../middleware/auth");

const router = express.Router();

// Audit log review (SYS-07, NFR-06, NFX-06). Read-only by design.
router.get("/", requirePermission("audit", "view"), asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page || 1));
  const limit = Math.min(500, Math.max(1, Number(req.query.limit || 50)));
  const values = [];
  const conds = [];
  for (const [col, key] of [["entity", "entity"], ["entity_id", "entityId"], ["action", "action"], ["user_id", "userId"]]) {
    if (req.query[key]) { values.push(req.query[key]); conds.push(`${col} = $${values.length}`); }
  }
  if (req.query.search) {
    values.push(`%${req.query.search}%`);
    conds.push(`(user_name ILIKE $${values.length} OR entity ILIKE $${values.length} OR entity_id ILIKE $${values.length} OR reason ILIKE $${values.length})`);
  }
  if (req.query.from) { values.push(req.query.from); conds.push(`created_at >= $${values.length}::date`); }
  if (req.query.to) { values.push(req.query.to); conds.push(`created_at < ($${values.length}::date + 1)`); }
  const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
  const total = (await query(`SELECT COUNT(*)::int AS n FROM audit_logs ${where}`, values)).rows[0].n;
  values.push(limit, (page - 1) * limit);
  const rows = (await query(
    `SELECT * FROM audit_logs ${where} ORDER BY created_at DESC LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values,
  )).rows;
  res.json({ success: true, data: keysToCamel(rows), pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
}));

router.get("/entities", requirePermission("audit", "view"), asyncHandler(async (req, res) => {
  const rows = (await query("SELECT entity, COUNT(*)::int AS n FROM audit_logs GROUP BY entity ORDER BY entity")).rows;
  res.json({ success: true, data: rows });
}));

module.exports = router;
