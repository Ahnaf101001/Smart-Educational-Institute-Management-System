const express = require("express");
const { query, transaction } = require("../db/pool");
const asyncHandler = require("../utils/asyncHandler");
const httpError = require("../utils/httpError");
const { keysToCamel } = require("../utils/case");
const { hasPermission } = require("../middleware/auth");
const { createApproval } = require("../services/approvals");

const router = express.Router();

function dayCount(from, to) {
  return Math.max(1, Math.round((new Date(to) - new Date(from)) / 86400000) + 1);
}

// Leave application (AT-06 student, HR-04 staff). Guardians/teachers may apply
// for themselves/their linked students; the decision runs through approvals.
router.post("/apply", asyncHandler(async (req, res) => {
  const { applicantType, applicantId, leaveTypeId, fromDate, toDate, reason, attachmentUrl } = req.body || {};
  if (!applicantType || !applicantId || !fromDate || !toDate) throw httpError(422, "Applicant, from and to dates are required.");
  if (new Date(toDate) < new Date(fromDate)) throw httpError(422, "To date must be on or after from date.");

  // Self-service scope checks.
  if (!hasPermission(req.user, "leave", "create")) {
    if (req.user.linkedType === "Guardian") {
      const link = await query("SELECT 1 FROM guardian_students WHERE guardian_id = $1 AND student_id = $2 AND access_status = 'Enabled'", [req.user.linkedId, applicantId]);
      if (applicantType !== "Student" || !link.rowCount) throw httpError(403, "You can only apply leave for your linked students.");
    } else if (["Teacher", "Staff"].includes(req.user.linkedType)) {
      if (applicantType !== req.user.linkedType || applicantId !== req.user.linkedId) throw httpError(403, "You can only apply leave for yourself.");
    } else {
      throw httpError(403, "You do not have permission to apply for leave.");
    }
  }

  const table = applicantType === "Student" ? "students" : applicantType === "Teacher" ? "teachers" : "staff";
  const person = (await query(`SELECT id, name FROM ${table} WHERE id = $1`, [applicantId])).rows[0];
  if (!person) throw httpError(404, `${applicantType} not found.`);
  const type = leaveTypeId ? (await query("SELECT * FROM leave_types WHERE id = $1", [leaveTypeId])).rows[0] : null;
  const days = dayCount(fromDate, toDate);

  if (type && type.days_per_year > 0) {
    const used = (await query(
      `SELECT COALESCE(SUM(days), 0)::int AS used FROM leave_requests WHERE applicant_type = $1 AND applicant_id = $2
         AND leave_type_id = $3 AND status = 'Approved' AND EXTRACT(YEAR FROM from_date) = EXTRACT(YEAR FROM $4::date)`,
      [applicantType, applicantId, type.id, fromDate],
    )).rows[0].used;
    if (used + days > type.days_per_year) throw httpError(422, `Insufficient ${type.name} balance (${type.days_per_year - used} day(s) left).`);
  }

  const result = await transaction(async (client) => {
    const leave = (await client.query(
      `INSERT INTO leave_requests (applicant_type, applicant_id, applicant_name, leave_type_id, leave_type, from_date, to_date, days, reason, attachment_url, requested_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [applicantType, applicantId, person.name, type?.id || null, type?.name || "General", fromDate, toDate, days, reason || null, attachmentUrl || null, req.user.name],
    )).rows[0];
    const approval = await createApproval(req, {
      type: "leave", title: `${applicantType} leave – ${person.name} (${fromDate} → ${toDate}, ${days}d)`,
      referenceTable: "leave_requests", referenceId: leave.id, payload: { leaveId: leave.id },
    }, client);
    return { leave, approval };
  });
  res.status(201).json({ success: true, data: keysToCamel(result) });
}));

router.get("/balances/:type/:id", asyncHandler(async (req, res) => {
  const { type, id } = req.params;
  const applies = type === "Student" ? "Student" : "Staff";
  const rows = (await query(
    `SELECT lt.id, lt.name, lt.days_per_year, lt.is_paid,
            COALESCE(SUM(lr.days) FILTER (WHERE lr.status = 'Approved' AND EXTRACT(YEAR FROM lr.from_date) = EXTRACT(YEAR FROM CURRENT_DATE)), 0)::int AS used,
            COALESCE(SUM(lr.days) FILTER (WHERE lr.status = 'Pending'), 0)::int AS pending
     FROM leave_types lt LEFT JOIN leave_requests lr ON lr.leave_type_id = lt.id AND lr.applicant_type = $1 AND lr.applicant_id = $2
     WHERE lt.status = 'Active' AND lt.applies_to IN ($3, 'Both') GROUP BY lt.id ORDER BY lt.name`,
    [type, id, applies],
  )).rows;
  res.json({ success: true, data: keysToCamel(rows.map((r) => ({ ...r, balance: r.days_per_year ? r.days_per_year - r.used : null }))) });
}));

module.exports = router;
