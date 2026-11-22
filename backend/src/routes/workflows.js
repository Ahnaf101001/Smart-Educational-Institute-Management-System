const express = require("express");
const { query, transaction } = require("../db/pool");
const asyncHandler = require("../utils/asyncHandler");
const httpError = require("../utils/httpError");
const { keysToCamel } = require("../utils/case");
const { requirePermission, hasPermission } = require("../middleware/auth");
const { writeAudit } = require("../services/audit");
const { createApproval } = require("../services/approvals");
const { previewNotice, dispatchNotice } = require("../services/notices");
const { processQueue } = require("../services/notifications");

const { queueMessage } = require("../services/notifications");
const { localMonth, localMinutes } = require("../utils/dates");
const router = express.Router();

function monthLabel(value) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString("en-US", { month: "long", year: "numeric" });
}

async function postSalaryExpense(client, record) {
  await client.query(
    `INSERT INTO financial_transactions (type, transaction_date, description, category, payment_method, amount, status, reference_no, details)
     VALUES ('Expense', CURRENT_DATE, $1, 'Salary', $2, $3, 'Completed', $4, $5)`,
    [`Salary Payment - ${record.employee_name} (${monthLabel(record.payroll_month)})`, record.details?.paymentMethod || "Bank Transfer",
      record.net_pay, record.id, JSON.stringify({ payrollId: record.id })],
  );
}

// Monthly payroll from salary structures with attendance/leave/advance adjustments (HR-07, HRX-06/07).
router.post("/payroll/generate", requirePermission("payroll", "create"), asyncHandler(async (req, res) => {
  const month = req.body?.month || localMonth();
  const payrollMonth = `${month}-01`;
  const result = await transaction(async (client) => {
    const policy = (await client.query("SELECT late_days_per_deduction, half_day_counts_as FROM system_settings WHERE id = 1")).rows[0] || {};
    const people = (await client.query(
      `SELECT 'Teacher' AS type, id, name, designation AS role, department, salary FROM teachers WHERE status = 'Active'
       UNION ALL SELECT 'Staff', id, name, designation, department, salary FROM staff WHERE status = 'Active'`,
    )).rows;
    let created = 0;
    for (const p of people) {
      const exists = await client.query("SELECT 1 FROM payroll_records WHERE employee_type = $1 AND employee_id = $2 AND payroll_month = $3", [p.type, p.id, payrollMonth]);
      if (exists.rowCount) continue;
      const s = (await client.query("SELECT * FROM salary_structures WHERE employee_type = $1 AND employee_id = $2", [p.type, p.id])).rows[0];
      const basic = Number(s?.basic ?? p.salary ?? 0);
      const allowances = s ? Number(s.house_rent) + Number(s.medical) + Number(s.transport) + Number(s.other_allowance) + Number(s.bonus) : 0;
      const att = (await client.query(
        `SELECT COUNT(*) FILTER (WHERE sa.status = 'Absent')::int AS absent,
                COUNT(*) FILTER (WHERE sa.status = 'Late')::int AS late,
                COUNT(*) FILTER (WHERE sa.status IN ('Half Day', 'Half-day', 'HalfDay'))::int AS half_day,
                COUNT(*) FILTER (WHERE sa.status = 'Leave' AND NOT COALESCE(lt.is_paid, TRUE))::int AS unpaid_leave
         FROM staff_attendance sa
         LEFT JOIN leave_requests lr ON lr.applicant_type = sa.employee_type AND lr.applicant_id = sa.employee_id
           AND sa.attendance_date BETWEEN lr.from_date AND lr.to_date AND lr.status = 'Approved'
         LEFT JOIN leave_types lt ON lt.id = lr.leave_type_id
         WHERE sa.employee_type = $1 AND sa.employee_id = $2 AND to_char(sa.attendance_date, 'YYYY-MM') = $3`,
        [p.type, p.id, month],
      )).rows[0];
      // Late / half-day policy (AT-11, ATT-07): every N late days count as one absent day; a half day counts as a fraction.
      const lateDays = policy.late_days_per_deduction > 0 ? Math.floor(Number(att.late) / Number(policy.late_days_per_deduction)) : 0;
      const halfDays = Number(att.half_day) * Number(policy.half_day_counts_as ?? 0.5);
      const absenceDeduction = (Number(att.absent) + Number(att.unpaid_leave) + lateDays + halfDays) * Number(s?.per_day_absence_deduction || 0);
      const advance = (await client.query(
        "SELECT id, amount, installment, recovered FROM salary_advances WHERE employee_type = $1 AND employee_id = $2 AND status = 'Active'",
        [p.type, p.id],
      )).rows;
      let advanceCut = 0;
      for (const a of advance) {
        const cut = Math.min(Number(a.installment || 0), Number(a.amount) - Number(a.recovered));
        if (cut > 0) {
          advanceCut += cut;
          await client.query("UPDATE salary_advances SET recovered = recovered + $1, status = CASE WHEN recovered + $1 >= amount THEN 'Closed' ELSE status END WHERE id = $2", [cut, a.id]);
        }
      }
      const deductions = (s ? Number(s.provident_fund) + Number(s.tax) + Number(s.other_deduction) : 0) + absenceDeduction + advanceCut;
      const net = Math.max(0, basic + allowances - deductions);
      await client.query(
        `INSERT INTO payroll_records (employee_type, employee_id, employee_name, role, department, payroll_month, basic_salary, allowances, deductions, net_pay, details)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [p.type, p.id, p.name, p.role, p.department, payrollMonth, basic, allowances, deductions, net,
          JSON.stringify({ absentDays: att.absent, unpaidLeave: att.unpaid_leave, absenceDeduction, advanceCut, govtPortion: Number(s?.govt_portion || 0), bankAccount: s?.bank_account || null })],
      );
      created += 1;
    }
    await writeAudit(req, { entity: "payroll_records", entityId: month, action: "GENERATE", newValue: { created } }, client);
    return { month, created };
  });
  res.json({ success: true, data: result });
}));

router.post("/payroll/request-approval", requirePermission("payroll", "create"), asyncHandler(async (req, res) => {
  const month = req.body?.month;
  if (!month) throw httpError(422, "Month is required.");
  const total = (await query("SELECT COUNT(*)::int AS n, COALESCE(SUM(net_pay),0) AS total FROM payroll_records WHERE payroll_month = $1", [`${month.slice(0, 7)}-01`])).rows[0];
  const approval = await createApproval(req, {
    type: "payroll", title: `Payroll ${month.slice(0, 7)} – ${total.n} staff, ৳${Number(total.total).toLocaleString()}`,
    referenceTable: "payroll_records", referenceId: month.slice(0, 7), amount: total.total, payload: { month: `${month.slice(0, 7)}-01` },
  });
  res.status(201).json({ success: true, data: keysToCamel(approval) });
}));

router.post("/payroll/:id/pay", requirePermission("payroll", "edit"), asyncHandler(async (req, res) => {
  const data = await transaction(async (client) => {
    const result = await client.query(
      `UPDATE payroll_records SET status = 'Paid', paid_at = NOW(), details = details || $2::jsonb
       WHERE id = $1 AND status = 'Pending' RETURNING *`,
      [req.params.id, JSON.stringify({ paymentMethod: req.body?.paymentMethod || "Bank Transfer" })],
    );
    if (!result.rowCount) throw httpError(404, "Pending payroll record not found.");
    await postSalaryExpense(client, result.rows[0]);
    await writeAudit(req, { entity: "payroll_records", entityId: req.params.id, action: "PAY" }, client);
    return keysToCamel(result.rows[0]);
  });
  res.json({ success: true, data });
}));

router.post("/payroll/process", requirePermission("payroll", "edit"), asyncHandler(async (req, res) => {
  const month = req.body.month;
  if (!month) throw httpError(422, "Payroll month is required.");
  const data = await transaction(async (client) => {
    const result = await client.query(
      "UPDATE payroll_records SET status = 'Paid', paid_at = NOW() WHERE payroll_month = $1 AND status = 'Pending' RETURNING *",
      [month],
    );
    for (const record of result.rows) await postSalaryExpense(client, record);
    await writeAudit(req, { entity: "payroll_records", entityId: month, action: "PROCESS", newValue: { paid: result.rowCount } }, client);
    return keysToCamel(result.rows);
  });
  res.json({ success: true, message: `${data.length} payroll records processed.`, data });
}));

// Payslip (HR-07) – staff can view their own.
router.get("/payroll/:id/payslip", asyncHandler(async (req, res) => {
  const r = (await query("SELECT * FROM payroll_records WHERE id = $1", [req.params.id])).rows[0];
  if (!r) throw httpError(404, "Payroll record not found.");
  const own = req.user.linkedId && req.user.linkedId === r.employee_id;
  if (!own && !hasPermission(req.user, "payroll", "view")) throw httpError(403, "You can only view your own payslip.");
  const s = (await query("SELECT * FROM salary_structures WHERE employee_type = $1 AND employee_id = $2", [r.employee_type, r.employee_id])).rows[0];
  const profile = (await query("SELECT name, address, logo_url FROM institute_profile WHERE id = 1")).rows[0];
  res.json({ success: true, data: keysToCamel({ record: r, structure: s || null, institute: profile }) });
}));

// ------------------------------------------------------------ communication
router.post("/notices/preview", requirePermission("communication", "view"), asyncHandler(async (req, res) => {
  const b = req.body || {};
  const preview = await previewNotice({
    title: b.title || "", message: b.message || "", channel: b.channel, audience: b.audience,
    target_class: b.targetClass, target_section: b.targetSection, target_student_id: b.targetStudentId,
  });
  res.json({ success: true, data: preview });
}));

// Bulk SMS/email needs authorised approval (CM-04, COM-03, APR-08).
router.post("/notices/:id/send", requirePermission("communication", "create"), asyncHandler(async (req, res) => {
  const notice = (await query("SELECT * FROM notices WHERE id = $1", [req.params.id])).rows[0];
  if (!notice) throw httpError(404, "Notice not found.");
  const preview = await previewNotice(notice);
  const isBulkPaid = preview.smsRecipients > 1 || preview.emailRecipients > 20;
  const canSendDirectly = hasPermission(req.user, "communication", "approve") || req.user.isAdmin;
  if (isBulkPaid && !canSendDirectly) {
    const approval = await transaction(async (client) => {
      await client.query("UPDATE notices SET approval_status = 'Pending', status = 'Pending Approval' WHERE id = $1", [notice.id]);
      return createApproval(req, {
        type: "bulk_sms", title: `${notice.channel} to ${preview.recipients} recipients: ${notice.title} (est. ৳${preview.estimatedCost})`,
        referenceTable: "notices", referenceId: notice.id, amount: preview.estimatedCost, payload: { noticeId: notice.id },
        urgency: notice.priority === "Emergency" ? "High" : "Normal",
      }, client);
    });
    return res.status(202).json({ success: true, pendingApproval: true, data: keysToCamel(approval), message: "Sent for approval before delivery." });
  }
  const result = await dispatchNotice(notice.id);
  await writeAudit(req, { entity: "notices", entityId: notice.id, action: "SEND", newValue: result });
  processQueue().catch(() => {});
  const updated = (await query("SELECT * FROM notices WHERE id = $1", [notice.id])).rows[0];
  res.json({ success: true, data: keysToCamel(updated), dispatch: result });
}));

router.post("/messages/retry-failed", requirePermission("communication", "send"), asyncHandler(async (req, res) => {
  const r = await query(
    "UPDATE message_logs SET status = 'Queued', attempts = 0, scheduled_at = NOW(), error = NULL WHERE status = 'Failed' AND ($1::text IS NULL OR related_id = $1) RETURNING id",
    [req.body?.relatedId || null],
  );
  processQueue().catch(() => {});
  res.json({ success: true, data: { requeued: r.rowCount } });
}));

router.get("/messages/stats", requirePermission("communication", "view"), asyncHandler(async (req, res) => {
  const rows = (await query(
    `SELECT channel, status, COUNT(*)::int AS n, COALESCE(SUM(cost),0) AS cost FROM message_logs
     WHERE created_at >= COALESCE($1::date, CURRENT_DATE - 30) GROUP BY channel, status`,
    [req.query.from || null],
  )).rows;
  res.json({ success: true, data: keysToCamel(rows) });
}));

// Returns the end of the quiet period if "now" falls inside it, else null.
function quietUntil(qh) {
  if (!qh || !qh.enabled || !qh.start || !qh.end) return null;
  const now = new Date();
  const mins = localMinutes(now);
  const [sh, sm] = String(qh.start).split(":").map(Number);
  const [eh, em] = String(qh.end).split(":").map(Number);
  const start = sh * 60 + sm;
  const end = eh * 60 + em;
  const inside = start <= end ? mins >= start && mins < end : mins >= start || mins < end;
  if (!inside) return null;
  let delta = (end - mins + 1440) % 1440;
  if (delta === 0) delta = 1440;
  const until = new Date(now.getTime() + delta * 60_000);
  until.setSeconds(0, 0);
  return until.toISOString();
}

// Guardian–teacher controlled messaging (CM-05, COM-04).
router.get("/conversations", asyncHandler(async (req, res) => {
  const me = req.user.linkedType && req.user.linkedId ? { type: req.user.linkedType, id: req.user.linkedId } : { type: "User", id: req.user.id };
  const rows = (await query(
    `SELECT DISTINCT ON (thread_key) thread_key, sender_type, sender_id, sender_name, recipient_type, recipient_id, student_id, body, created_at,
            (SELECT COUNT(*)::int FROM messages m2 WHERE m2.thread_key = m.thread_key AND m2.recipient_id = $2 AND m2.read_at IS NULL) AS unread
     FROM messages m WHERE (sender_type = $1 AND sender_id = $2) OR (recipient_type = $1 AND recipient_id = $2)
     ORDER BY thread_key, created_at DESC`,
    [me.type, me.id],
  )).rows;
  res.json({ success: true, data: keysToCamel(rows) });
}));

router.get("/conversations/:thread", asyncHandler(async (req, res) => {
  const me = req.user.linkedId || req.user.id;
  const rows = (await query("SELECT * FROM messages WHERE thread_key = $1 ORDER BY created_at", [req.params.thread])).rows;
  if (rows.length && !rows.some((r) => r.sender_id === me || r.recipient_id === me) && !hasPermission(req.user, "communication", "approve")) {
    throw httpError(403, "Not your conversation.");
  }
  await query("UPDATE messages SET read_at = NOW() WHERE thread_key = $1 AND recipient_id = $2 AND read_at IS NULL", [req.params.thread, me]);
  res.json({ success: true, data: keysToCamel(rows) });
}));

router.post("/conversations", asyncHandler(async (req, res) => {
  const { recipientType, recipientId, studentId, body } = req.body || {};
  if (!recipientType || !recipientId || !String(body || "").trim()) throw httpError(422, "Recipient and message are required.");
  const me = req.user.linkedType && req.user.linkedId ? { type: req.user.linkedType, id: req.user.linkedId } : { type: "User", id: req.user.id };
  if (me.type === "Guardian") {
    if (recipientType !== "Teacher") throw httpError(403, "Guardians can message teachers only.");
    const ok = await query(
      `SELECT 1 FROM guardian_students gs JOIN students s ON s.id = gs.student_id
       WHERE gs.guardian_id = $1 AND gs.student_id = $2 AND (
         EXISTS (SELECT 1 FROM classes c WHERE c.id = s.class_id AND c.teacher_id = $3)
         OR EXISTS (SELECT 1 FROM class_assignments ca WHERE ca.class_id = s.class_id AND ca.teacher_id = $3))`,
      [me.id, studentId, recipientId],
    );
    if (!ok.rowCount) throw httpError(403, "You can only message your child's teachers.");
  }
  const key = [`${me.type}:${me.id}`, `${recipientType}:${recipientId}`].sort().join("|") + (studentId ? `|${studentId}` : "");
  const row = (await query(
    `INSERT INTO messages (thread_key, sender_type, sender_id, sender_name, recipient_type, recipient_id, student_id, body)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [key, me.type, me.id, req.user.name, recipientType, recipientId, studentId || null, String(body).slice(0, 2000)],
  )).rows[0];
  // Notify the recipient. A teacher in quiet hours gets the alert when they end (v1 CM-05).
  let deferredUntil = null;
  const recipientUser = (await query("SELECT id, quiet_hours FROM users WHERE linked_type = $1 AND linked_id = $2 AND status = 'Active' LIMIT 1", [recipientType, recipientId])).rows[0];
  if (recipientUser) {
    if (recipientType === "Teacher") {
      const global = (await query("SELECT teacher_quiet_hours FROM system_settings WHERE id = 1")).rows[0]?.teacher_quiet_hours || {};
      const qh = recipientUser.quiet_hours?.enabled ? recipientUser.quiet_hours : global;
      deferredUntil = quietUntil(qh);
    }
    // Teacher → guardian messages reach the Guardian App inbox and push (Spec §1H teacher
    // notifications), tagged with the child so multi-child guardians know who it concerns.
    const toGuardian = recipientType === "Guardian";
    await queueMessage({
      channel: "Portal", eventType: toGuardian ? "TeacherMessage" : "Message",
      recipientType: toGuardian ? "Guardian" : "User", recipientId: toGuardian ? recipientId : recipientUser.id,
      studentId: toGuardian ? studentId || null : null,
      subject: `Message from ${req.user.name}`, body: String(body).slice(0, 140), relatedType: "messages", relatedId: String(row.id),
      scheduledAt: deferredUntil,
    });
  }
  res.status(201).json({ success: true, data: { ...keysToCamel(row), deliveredAfter: deferredUntil } });
}));

module.exports = router;
