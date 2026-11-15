const express = require("express");
const { query } = require("../db/pool");
const asyncHandler = require("../utils/asyncHandler");
const { keysToCamel } = require("../utils/case");
const { hasPermission } = require("../middleware/auth");
const { REQUEST_TYPES, decide, createApproval } = require("../services/approvals");
const httpError = require("../utils/httpError");

const router = express.Router();

// Lists requests the user may act on (or made) – APR-05 pending dashboard.
router.get("/", asyncHandler(async (req, res) => {
  const status = req.query.status || "Pending";
  const rows = (await query(
    `SELECT *, EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600 AS age_hours
     FROM approval_requests
     WHERE ($1 = 'All' OR status = $1 OR ($1 = 'Pending' AND status = 'Clarification'))
       AND ($2::text IS NULL OR request_type = $2)
     ORDER BY CASE urgency WHEN 'High' THEN 0 WHEN 'Normal' THEN 1 ELSE 2 END, created_at
     LIMIT 500`,
    [status, req.query.type || null],
  )).rows;
  const visible = rows.filter((r) => {
    const mod = REQUEST_TYPES[r.request_type]?.module;
    return r.maker_id === req.user.id || hasPermission(req.user, mod, "approve") || hasPermission(req.user, "approvals", "view");
  }).map((r) => ({
    ...r,
    type_label: REQUEST_TYPES[r.request_type]?.label || r.request_type,
    can_decide: r.maker_id !== req.user.id && (hasPermission(req.user, REQUEST_TYPES[r.request_type]?.module, "approve") || hasPermission(req.user, "approvals", "approve")),
  }));
  res.json({ success: true, data: keysToCamel(visible) });
}));

router.get("/summary", asyncHandler(async (req, res) => {
  const rows = (await query(
    "SELECT request_type, status, COUNT(*)::int AS n FROM approval_requests GROUP BY request_type, status",
  )).rows;
  const pending = rows.filter((r) => ["Pending", "Clarification"].includes(r.status)
    && hasPermission(req.user, REQUEST_TYPES[r.request_type]?.module, "approve"));
  res.json({
    success: true,
    data: { pendingForMe: pending.reduce((s, r) => s + r.n, 0), byType: keysToCamel(rows), types: REQUEST_TYPES },
  });
}));

router.get("/types", (req, res) => res.json({ success: true, data: REQUEST_TYPES }));

router.post("/:id/decide", asyncHandler(async (req, res) => {
  const { decision, note } = req.body || {};
  const result = await decide(req, req.params.id, decision, note);
  res.json({ success: true, data: keysToCamel(result) });
}));

// Maker resubmits after clarification.
router.post("/:id/resubmit", asyncHandler(async (req, res) => {
  const row = (await query("SELECT * FROM approval_requests WHERE id = $1", [req.params.id])).rows[0];
  if (!row) throw httpError(404, "Request not found.");
  if (row.maker_id !== req.user.id) throw httpError(403, "Only the maker can resubmit.");
  if (row.status !== "Clarification") throw httpError(409, "Only requests awaiting clarification can be resubmitted.");
  const history = [...(row.history || []), { at: new Date().toISOString(), by: req.user.name, action: "Resubmitted", note: req.body?.note }];
  const updated = (await query(
    "UPDATE approval_requests SET status = 'Pending', payload = payload || $1::jsonb, history = $2 WHERE id = $3 RETURNING *",
    [JSON.stringify(req.body?.payload || {}), JSON.stringify(history), req.params.id],
  )).rows[0];
  res.json({ success: true, data: keysToCamel(updated) });
}));

router.post("/:id/cancel", asyncHandler(async (req, res) => {
  const row = (await query("SELECT * FROM approval_requests WHERE id = $1", [req.params.id])).rows[0];
  if (!row) throw httpError(404, "Request not found.");
  if (row.maker_id !== req.user.id && !req.user.isAdmin) throw httpError(403, "Only the maker can cancel.");
  if (!["Pending", "Clarification"].includes(row.status)) throw httpError(409, "Request is already decided.");
  await query("UPDATE approval_requests SET status = 'Cancelled', decided_at = NOW() WHERE id = $1", [req.params.id]);
  res.json({ success: true });
}));

router.post("/", asyncHandler(async (req, res) => {
  const { type, title, referenceTable, referenceId, payload, amount, urgency } = req.body || {};
  const approval = await createApproval(req, { type, title, referenceTable, referenceId, payload, amount, urgency });
  res.status(201).json({ success: true, data: keysToCamel(approval) });
}));

module.exports = router;
