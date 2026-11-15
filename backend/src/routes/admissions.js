const express = require("express");
const { query, transaction } = require("../db/pool");
const asyncHandler = require("../utils/asyncHandler");
const httpError = require("../utils/httpError");
const { keysToCamel } = require("../utils/case");
const { requirePermission } = require("../middleware/auth");
const { writeAudit } = require("../services/audit");
const { createApproval } = require("../services/approvals");
const { findDuplicates, confirmAdmission } = require("../services/admissions");
const { queueMessage } = require("../services/notifications");

const router = express.Router();
const STATUSES = ["Draft", "Submitted", "Under Review", "Shortlisted", "Selected", "Waiting", "Rejected", "Admitted"];

router.get("/statuses", (req, res) => res.json({ success: true, data: STATUSES }));

// Duplicate check by birth certificate, name+DOB, guardian mobile (AD-06).
router.post("/check-duplicate", requirePermission("admission", "view"), asyncHandler(async (req, res) => {
  const rows = await findDuplicates({ query }, req.body || {});
  res.json({ success: true, data: keysToCamel(rows) });
}));

router.post("/:id/status", requirePermission("admission", "edit"), asyncHandler(async (req, res) => {
  const { status, note, testMarks, testAttendance } = req.body || {};
  if (!STATUSES.includes(status) || status === "Admitted") throw httpError(422, "Invalid status (use the confirm action to admit).");
  if (status === "Rejected" && !String(note || "").trim()) throw httpError(422, "A rejection reason is required.");
  const row = await transaction(async (client) => {
    const app = (await client.query("SELECT * FROM admissions WHERE id = $1 FOR UPDATE", [req.params.id])).rows[0];
    if (!app) throw httpError(404, "Application not found.");
    if (app.status === "Admitted") throw httpError(409, "Already admitted.");
    const history = [...(app.status_history || []), { at: new Date().toISOString(), from: app.status, status, by: req.user.name, note: note || null }];
    const updated = (await client.query(
      `UPDATE admissions SET status = $1, status_history = $2, test_marks = COALESCE($3, test_marks),
         test_attendance = COALESCE($4, test_attendance) WHERE id = $5 RETURNING *`,
      [status, JSON.stringify(history), testMarks ?? null, testAttendance || null, app.id],
    )).rows[0];
    await writeAudit(req, { entity: "admissions", entityId: app.id, action: "STATUS", oldValue: { status: app.status }, newValue: { status }, reason: note }, client);
    return updated;
  });
  res.json({ success: true, data: keysToCamel(row) });
}));

// Admission test marks entry in bulk (AD-07).
router.put("/test-marks", requirePermission("admission", "edit"), asyncHandler(async (req, res) => {
  const { records = [] } = req.body || {};
  await transaction(async (client) => {
    for (const r of records) {
      await client.query("UPDATE admissions SET test_marks = $1, test_attendance = $2 WHERE id = $3",
        [r.testMarks === "" || r.testMarks === null ? null : Number(r.testMarks), r.testAttendance || (r.testMarks !== null && r.testMarks !== "" ? "Present" : null), r.id]);
    }
    await writeAudit(req, { entity: "admissions", action: "TEST_MARKS", newValue: { count: records.length } }, client);
  });
  res.json({ success: true });
}));

// Merit & waiting list (AD-08). Lottery selection supported (v1 AD-07).
router.post("/circulars/:id/merit-list", requirePermission("admission", "edit"), asyncHandler(async (req, res) => {
  const result = await transaction(async (client) => {
    const circular = (await client.query("SELECT * FROM admission_circulars WHERE id = $1", [req.params.id])).rows[0];
    if (!circular) throw httpError(404, "Circular not found.");
    const apps = (await client.query(
      `SELECT * FROM admissions WHERE (circular_id = $1 OR (circular_id IS NULL AND class_name = $2))
         AND status IN ('Submitted','Under Review','Shortlisted','Selected','Waiting') FOR UPDATE`,
      [circular.id, circular.class_name],
    )).rows;
    let ordered;
    if (circular.selection_method === "Lottery") {
      ordered = [...apps].sort(() => Math.random() - 0.5);
    } else if (circular.selection_method === "First Come") {
      ordered = [...apps].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    } else {
      ordered = [...apps].filter((a) => a.test_marks !== null || !circular.test_required)
        .sort((a, b) => Number(b.test_marks || 0) - Number(a.test_marks || 0) || new Date(a.created_at) - new Date(b.created_at));
    }
    const seats = Number(circular.seats || 0);
    let selected = 0;
    let waiting = 0;
    for (const [i, app] of ordered.entries()) {
      const status = i < seats ? "Selected" : "Waiting";
      if (status === "Selected") selected += 1; else waiting += 1;
      const history = [...(app.status_history || []), { at: new Date().toISOString(), from: app.status, status, by: req.user.name, note: `Merit position ${i + 1}` }];
      await client.query("UPDATE admissions SET merit_position = $1, status = $2, status_history = $3 WHERE id = $4",
        [i + 1, status, JSON.stringify(history), app.id]);
    }
    await writeAudit(req, { entity: "admission_circulars", entityId: circular.id, action: "MERIT_LIST", newValue: { selected, waiting, method: circular.selection_method } }, client);
    return { selected, waiting, seats };
  });
  res.json({ success: true, data: result });
}));

router.get("/circulars/:id/stats", requirePermission("admission", "view"), asyncHandler(async (req, res) => {
  const circular = (await query("SELECT * FROM admission_circulars WHERE id = $1", [req.params.id])).rows[0];
  if (!circular) throw httpError(404, "Circular not found.");
  const stats = (await query(
    `SELECT status, COUNT(*)::int AS n FROM admissions WHERE circular_id = $1 OR (circular_id IS NULL AND class_name = $2) GROUP BY status`,
    [circular.id, circular.class_name],
  )).rows;
  const admitted = stats.find((s) => s.status === "Admitted")?.n || 0;
  res.json({ success: true, data: keysToCamel({ circular, stats, seatsAvailable: Math.max(0, Number(circular.seats) - admitted) }) });
}));

// Admit card data for admission test (AD-07).
router.post("/admit-cards", requirePermission("admission", "print"), asyncHandler(async (req, res) => {
  const { ids = [] } = req.body || {};
  const rows = await transaction(async (client) => {
    const apps = (await client.query("SELECT * FROM admissions WHERE id = ANY($1) ORDER BY id", [ids])).rows;
    for (const app of apps) {
      if (!app.admit_card_no) {
        await client.query("UPDATE admissions SET admit_card_no = $1 WHERE id = $2", [`ADM-${app.id.replace(/\D/g, "")}`, app.id]);
        app.admit_card_no = `ADM-${app.id.replace(/\D/g, "")}`;
      }
    }
    return apps;
  });
  res.json({ success: true, data: keysToCamel(rows) });
}));

// Admission payment verification (AD-09).
router.post("/:id/payment", requirePermission("admission", "edit"), asyncHandler(async (req, res) => {
  const { amount, reference, verified = true } = req.body || {};
  const row = (await query(
    "UPDATE admissions SET payment_status = $1, payment_ref = COALESCE($2, payment_ref), payment_amount = COALESCE($3, payment_amount) WHERE id = $4 RETURNING *",
    [verified ? "Verified" : "Unpaid", reference || null, amount || null, req.params.id],
  )).rows[0];
  if (!row) throw httpError(404, "Application not found.");
  await writeAudit(req, { entity: "admissions", entityId: row.id, action: "PAYMENT_VERIFY", newValue: { amount, reference, verified } });
  res.json({ success: true, data: keysToCamel(row) });
}));

// Duplicate override requires approval with a reason.
router.post("/:id/override-duplicate", requirePermission("admission", "edit"), asyncHandler(async (req, res) => {
  const reason = String(req.body?.reason || "").trim();
  if (!reason) throw httpError(422, "Override reason is required.");
  const approval = await createApproval(req, {
    type: "duplicate_override", title: `Duplicate override – ${req.params.id}`, referenceTable: "admissions",
    referenceId: req.params.id, payload: { admissionId: req.params.id, reason },
  });
  res.status(201).json({ success: true, data: keysToCamel(approval) });
}));

// Confirm admission. Users with admission:approve confirm directly; others create an approval request.
router.post("/:id/approve", requirePermission("admission", "edit"), asyncHandler(async (req, res) => {
  const { section, roll } = req.body || {};
  const canApprove = req.user.isAdmin || req.user.matrix?.admission?.includes("approve");
  if (!canApprove) {
    const approval = await createApproval(req, {
      type: "admission_confirm", title: `Admission confirmation – ${req.params.id}`, referenceTable: "admissions",
      referenceId: req.params.id, payload: { admissionId: req.params.id, section, roll },
    });
    return res.status(202).json({ success: true, pendingApproval: true, data: keysToCamel(approval), message: "Sent to Principal for approval." });
  }
  const result = await transaction((client) => confirmAdmission(client, req, req.params.id, { section, roll }));
  res.json({ success: true, data: keysToCamel(result.student), portalCreated: result.portalCreated });
}));

// Flag duplicates when an application is created from the office (AD-03 + AD-06).
router.post("/:id/flag-duplicates", requirePermission("admission", "edit"), asyncHandler(async (req, res) => {
  const app = (await query("SELECT * FROM admissions WHERE id = $1", [req.params.id])).rows[0];
  if (!app) throw httpError(404, "Application not found.");
  const d = app.details || {};
  const dups = await findDuplicates({ query }, {
    birthCertNo: app.birth_cert_no || d.birthCertificateNo, name: app.name, dateOfBirth: app.date_of_birth || d.dateOfBirth,
    guardianMobile: app.guardian_mobile || d.fatherPhone, excludeId: app.id,
  });
  await query("UPDATE admissions SET duplicate_flag = $1, duplicate_of = $2 WHERE id = $3", [dups.length > 0, dups[0]?.id || null, app.id]);
  res.json({ success: true, data: keysToCamel(dups) });
}));

router.post("/:id/notify", requirePermission("admission", "send"), asyncHandler(async (req, res) => {
  const app = (await query("SELECT * FROM admissions WHERE id = $1", [req.params.id])).rows[0];
  if (!app?.guardian_mobile) throw httpError(422, "No guardian mobile on this application.");
  await queueMessage({ channel: "SMS", eventType: "Admission", recipient: app.guardian_mobile, recipientType: "Applicant", recipientId: app.id, body: String(req.body?.message || `Application ${app.id}: status ${app.status}.`) });
  res.json({ success: true });
}));

module.exports = router;
