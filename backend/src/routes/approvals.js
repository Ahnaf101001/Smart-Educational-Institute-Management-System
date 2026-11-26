const express = require("express");
const { query } = require("../db/pool");
const asyncHandler = require("../utils/asyncHandler");
const { keysToCamel } = require("../utils/case");
const { hasPermission } = require("../middleware/auth");
const { REQUEST_TYPES, decide, createApproval, cancelApproval, resubmitApproval, canSelfDecide } = require("../services/approvals");

const router = express.Router();

// Lists requests the user may act on (or made) – APR-05 pending dashboard.
router.get("/", asyncHandler(async (req, res) => {
  const status = req.query.status || "Pending";
  const settings = (await query("SELECT allow_self_approval FROM system_settings WHERE id = 1")).rows[0] || {};
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
  }).map((r) => {
    const open = ["Pending", "Clarification"].includes(r.status);
    const own = r.maker_id === req.user.id;
    const permitted = hasPermission(req.user, REQUEST_TYPES[r.request_type]?.module, "approve") || hasPermission(req.user, "approvals", "approve");
    return {
      ...r,
      type_label: REQUEST_TYPES[r.request_type]?.label || r.request_type,
      // Super Admin decides every request, own ones included; others follow maker–checker.
      can_decide: open && permitted && (!own || canSelfDecide(req, settings)),
      can_withdraw: open && (own || Boolean(req.user.isAdmin)),
      can_respond: r.status === "Clarification" && own,
    };
  });
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
  const updated = await resubmitApproval(req, req.params.id, req.body?.note, req.body?.payload);
  res.json({ success: true, data: keysToCamel(updated) });
}));

// Withdraw: the maker, or a Super Admin for any open request.
router.post("/:id/cancel", asyncHandler(async (req, res) => {
  const updated = await cancelApproval(req, req.params.id, req.body?.note);
  res.json({ success: true, data: keysToCamel(updated) });
}));

router.post("/", asyncHandler(async (req, res) => {
  const { type, title, referenceTable, referenceId, payload, amount, urgency } = req.body || {};
  const approval = await createApproval(req, { type, title, referenceTable, referenceId, payload, amount, urgency });
  res.status(201).json({ success: true, data: keysToCamel(approval) });
}));

module.exports = router;
