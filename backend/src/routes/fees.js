const express = require("express");
const { z } = require("zod");
const { query, transaction } = require("../db/pool");
const validate = require("../middleware/validate");
const asyncHandler = require("../utils/asyncHandler");
const httpError = require("../utils/httpError");
const { keysToCamel } = require("../utils/case");
const { requirePermission, requireAny } = require("../middleware/auth");
const { writeAudit } = require("../services/audit");
const { createApproval } = require("../services/approvals");
const { postPayment, applyDiscounts, applyAdvanceCredit, notifyPayment } = require("../services/fees");
const { queueMessage } = require("../services/notifications");
const { renderTemplate, defaultLanguage } = require("../services/templates");
const payments = require("../services/payments");

const router = express.Router();
const DUE_SQL = "GREATEST(i.amount + i.late_fine - i.discount - i.paid_amount, 0)";

router.get("/dues", requirePermission("fees", "view"), asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT s.id AS student_id, s.name, s.roll, s.class_name, s.parent_contact,
            COALESCE(SUM(i.amount + i.late_fine - i.discount) FILTER (WHERE i.fee_head IS DISTINCT FROM 'Advance Credit'), 0) AS total_fee,
            COALESCE(SUM(i.paid_amount), 0) AS paid,
            COALESCE(SUM(${DUE_SQL}), 0) AS due,
            CASE WHEN COUNT(*) FILTER (WHERE i.status = 'Overdue' OR (i.due_date < CURRENT_DATE AND ${DUE_SQL} > 0)) > 0 THEN 'Overdue'
                 WHEN COALESCE(SUM(${DUE_SQL}), 0) > 0 THEN 'Due' ELSE 'Clear' END AS status,
            (SELECT MAX(p.paid_at) FROM fee_payments p WHERE p.student_id = s.id AND p.status = 'Valid') AS last_paid
     FROM students s LEFT JOIN fee_invoices i ON i.student_id = s.id AND i.status <> 'Cancelled'
     WHERE s.status = 'Active' AND ($1::text IS NULL OR s.class_name = $1 OR s.class_name ILIKE $1 || '-%')
     GROUP BY s.id ORDER BY s.name`,
    [req.query.className || null],
  );
  res.json({ success: true, data: keysToCamel(result.rows) });
}));

// Student-wise due ledger (FE-08).
router.get("/student/:id/ledger", requirePermission("fees", "view"), asyncHandler(async (req, res) => {
  const id = req.params.id;
  const [invoices, pays, discounts, student] = await Promise.all([
    query(`SELECT i.*, ${DUE_SQL} AS due FROM fee_invoices i WHERE i.student_id = $1 ORDER BY i.billing_month DESC NULLS LAST, i.created_at DESC`, [id]),
    query("SELECT * FROM fee_payments WHERE student_id = $1 ORDER BY paid_at DESC", [id]),
    query("SELECT * FROM fee_discounts WHERE student_id = $1 ORDER BY created_at DESC", [id]),
    query("SELECT id, name, class_name, roll, parent_contact FROM students WHERE id = $1", [id]),
  ]);
  if (!student.rowCount) throw httpError(404, "Student not found.");
  const totalDue = invoices.rows.filter((i) => i.status !== "Cancelled").reduce((s, i) => s + Number(i.due), 0);
  res.json({ success: true, data: keysToCamel({ student: student.rows[0], invoices: invoices.rows, payments: pays.rows, discounts: discounts.rows, totalDue }) });
}));

// Guardian-wise consolidated due view for siblings (FE-08, FIN-09).
router.get("/guardian/:id/dues", requirePermission("fees", "view"), asyncHandler(async (req, res) => {
  const rows = (await query(
    `SELECT s.id AS student_id, s.name, s.class_name, i.id AS invoice_id, i.fee_head, i.billing_month, i.due_date, ${DUE_SQL} AS due
     FROM guardian_students gs JOIN students s ON s.id = gs.student_id
     JOIN fee_invoices i ON i.student_id = s.id AND i.status NOT IN ('Paid','Cancelled')
     WHERE gs.guardian_id = $1 ORDER BY s.name, i.due_date NULLS LAST`,
    [req.params.id],
  )).rows;
  res.json({ success: true, data: keysToCamel({ items: rows, total: rows.reduce((s, r) => s + Number(r.due), 0) }) });
}));

const legacyPayment = z.object({
  invoiceId: z.string().min(1),
  amount: z.coerce.number().positive(),
  paymentMethod: z.string().min(1),
  referenceNo: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});
router.post("/payments", requirePermission("fees", "create"), validate(legacyPayment), asyncHandler(async (req, res) => {
  const result = await transaction((client) => postPayment(client, req, {
    invoiceIds: [req.body.invoiceId], amount: req.body.amount, method: req.body.paymentMethod,
    referenceNo: req.body.referenceNo, notes: req.body.notes, allowAdvance: false,
  }));
  const sid = result.receipts[0]?.student_id;
  if (sid) notifyPayment(sid, result.receipts, await defaultLanguage()).catch(() => {});
  res.status(201).json({ success: true, data: keysToCamel(result.receipts[0]), receipts: keysToCamel(result.receipts) });
}));

// Counter collection: partial / advance / multi-head / combined siblings (FE-09/12, FIN-03/07/09).
const collectSchema = z.object({
  studentIds: z.array(z.string()).optional(),
  studentId: z.string().optional(),
  invoiceIds: z.array(z.string()).optional(),
  amount: z.coerce.number().positive(),
  paymentMethod: z.enum(["Cash", "Cheque", "Bank Transfer", "bKash", "Nagad", "Rocket", "Card", "Other"]),
  referenceNo: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  guardianId: z.string().nullable().optional(),
});
router.post("/collect", requirePermission("fees", "create"), validate(collectSchema), asyncHandler(async (req, res) => {
  const b = req.body;
  const studentIds = b.studentIds?.length ? b.studentIds : b.studentId ? [b.studentId] : [];
  if (!studentIds.length && !b.invoiceIds?.length) throw httpError(422, "Select a student or invoices.");
  if (["Cheque", "Bank Transfer", "bKash", "Nagad", "Rocket"].includes(b.paymentMethod) && !b.referenceNo) {
    throw httpError(422, "A reference/transaction number is required for this payment method.");
  }
  const result = await transaction((client) => postPayment(client, req, {
    studentIds, invoiceIds: b.invoiceIds, amount: b.amount, method: b.paymentMethod,
    referenceNo: b.referenceNo, notes: b.notes, guardianId: b.guardianId, allowAdvance: true,
  }));
  const lang = await defaultLanguage();
  for (const sid of new Set(result.receipts.map((r) => r.student_id))) {
    notifyPayment(sid, result.receipts.filter((r) => r.student_id === sid), lang).catch(() => {});
  }
  res.status(201).json({ success: true, data: keysToCamel(result) });
}));

router.get("/payments", requirePermission("fees", "view"), asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT p.*, s.name AS student_name, s.roll, s.class_name, i.fee_head, i.billing_month
     FROM fee_payments p JOIN students s ON s.id = p.student_id LEFT JOIN fee_invoices i ON i.id = p.invoice_id
     WHERE ($1::text IS NULL OR p.student_id = $1) AND ($2::text IS NULL OR p.status = $2)
       AND ($3::date IS NULL OR p.paid_at >= $3::date) AND ($4::date IS NULL OR p.paid_at < $4::date + 1)
     ORDER BY p.paid_at DESC LIMIT 2000`,
    [req.query.studentId || null, req.query.status || null, req.query.from || null, req.query.to || null],
  );
  res.json({ success: true, data: keysToCamel(result.rows) });
}));

// Receipt (single or grouped) for printing (FE-13).
router.get("/receipts/:receiptNo", requireAny(["fees", "view"], ["fees", "print"]), asyncHandler(async (req, res) => {
  const first = (await query("SELECT * FROM fee_payments WHERE receipt_no = $1", [req.params.receiptNo])).rows[0];
  if (!first) throw httpError(404, "Receipt not found.");
  const lines = first.group_ref
    ? (await query("SELECT p.*, i.fee_head, i.billing_month FROM fee_payments p LEFT JOIN fee_invoices i ON i.id = p.invoice_id WHERE p.group_ref = $1 ORDER BY p.receipt_no", [first.group_ref])).rows
    : (await query("SELECT p.*, i.fee_head, i.billing_month FROM fee_payments p LEFT JOIN fee_invoices i ON i.id = p.invoice_id WHERE p.id = $1", [first.id])).rows;
  const students = (await query("SELECT id, name, class_name, section, roll FROM students WHERE id = ANY($1)", [[...new Set(lines.map((l) => l.student_id))]])).rows;
  const profile = (await query("SELECT * FROM institute_profile WHERE id = 1")).rows[0];
  res.json({ success: true, data: keysToCamel({ receiptNo: first.receipt_no, groupRef: first.group_ref, paidAt: first.paid_at, method: first.payment_method, collector: first.collector_name, status: first.status, lines, students, institute: profile, total: lines.filter((l) => l.status === "Valid").reduce((s, l) => s + Number(l.amount), 0) }) });
}));

// Receipt cancellation request (FIN-10, APR-02).
router.post("/payments/:id/cancel-request", requirePermission("fees", "edit"), asyncHandler(async (req, res) => {
  const reason = String(req.body?.reason || "").trim();
  if (!reason) throw httpError(422, "Cancellation reason is required.");
  const pay = (await query("SELECT * FROM fee_payments WHERE id = $1", [req.params.id])).rows[0];
  if (!pay) throw httpError(404, "Payment not found.");
  if (pay.status === "Cancelled") throw httpError(409, "Receipt already cancelled.");
  const approval = await createApproval(req, {
    type: "receipt_cancel", title: `Cancel receipt ${pay.receipt_no} (৳${pay.amount})`, referenceTable: "fee_payments",
    referenceId: pay.id, amount: pay.amount, payload: { paymentId: pay.id, reason },
  });
  res.status(201).json({ success: true, data: keysToCamel(approval) });
}));

// Monthly / term invoice generation (FE-07, FIN-06). Safe to run repeatedly.
router.post("/invoices/generate", requirePermission("fees", "create"), asyncHandler(async (req, res) => {
  const month = req.body?.month || new Date().toISOString().slice(0, 7);
  const result = await generateInvoices(month, { classId: req.body?.classId || null, frequency: req.body?.frequency || "Monthly" });
  await writeAudit(req, { entity: "fee_invoices", entityId: month, action: "GENERATE", newValue: result });
  res.json({ success: true, data: result });
}));

async function generateInvoices(month, { classId = null, frequency = "Monthly" } = {}) {
  const billing = `${month}-01`;
  return transaction(async (client) => {
    const structures = (await client.query(
      `SELECT fs.*, fh.name AS head_name FROM fee_structures fs LEFT JOIN fee_heads fh ON fh.id = fs.fee_head_id
       WHERE fs.status = 'Active' AND fs.frequency = $1 AND ($2::text IS NULL OR fs.class_id = $2)`,
      [frequency, classId],
    )).rows;
    let created = 0;
    const touched = new Set();
    for (const fs of structures) {
      const students = (await client.query(
        `SELECT id FROM students WHERE status = 'Active' AND ($1::text IS NULL OR class_id = $1)
           AND ($2::text IS NULL OR $2 = '' OR section = $2) AND ($3::text IS NULL OR $3 = '' OR shift = $3)
           AND ($4::text IS NULL OR $4 = '' OR group_name = $4)`,
        [fs.class_id, fs.section, fs.shift, fs.group_name],
      )).rows;
      const due = `${month}-${String(Math.min(Number(fs.due_day || 10), 28)).padStart(2, "0")}`;
      for (const s of students) {
        const r = await client.query(
          `INSERT INTO fee_invoices (student_id, fee_structure_id, billing_month, due_date, amount, status, fee_head)
           SELECT $1, $2, $3::date, $4::date, $5, 'Due', $6
           WHERE NOT EXISTS (SELECT 1 FROM fee_invoices WHERE student_id = $1 AND fee_structure_id = $2 AND billing_month = $3::date)`,
          [s.id, fs.id, billing, due, fs.amount, fs.head_name || fs.name],
        );
        if (r.rowCount) { created += 1; touched.add(s.id); }
      }
    }
    for (const sid of touched) {
      await applyDiscounts(client, sid);
      await applyAdvanceCredit(client, sid);
    }
    return { month, created, students: touched.size };
  });
}

// Late fine (FE-04, FIN-04): fixed or per-day after due date + grace period.
router.post("/invoices/apply-late-fines", requirePermission("fees", "edit"), asyncHandler(async (req, res) => {
  const updated = await applyLateFines();
  await writeAudit(req, { entity: "fee_invoices", action: "LATE_FINES", newValue: { updated } });
  res.json({ success: true, data: { updated } });
}));

async function applyLateFines() {
  const rows = (await query(
    `SELECT i.id, i.due_date, i.late_fine, fs.late_fine_type, fs.late_fine_amount, fs.grace_days
     FROM fee_invoices i JOIN fee_structures fs ON fs.id = i.fee_structure_id
     WHERE i.status IN ('Due','Partial','Overdue') AND fs.late_fine_type <> 'None' AND i.due_date IS NOT NULL
       AND i.due_date + fs.grace_days < CURRENT_DATE`,
  )).rows;
  let updated = 0;
  for (const r of rows) {
    const overdueDays = Math.floor((Date.now() - new Date(r.due_date).getTime()) / 86400000) - Number(r.grace_days || 0);
    const fine = r.late_fine_type === "PerDay" ? overdueDays * Number(r.late_fine_amount) : Number(r.late_fine_amount);
    if (fine > Number(r.late_fine)) {
      await query("UPDATE fee_invoices SET late_fine = $1, status = CASE WHEN paid_amount > 0 THEN 'Partial' ELSE 'Overdue' END WHERE id = $2", [fine, r.id]);
      updated += 1;
    }
  }
  await query("UPDATE fee_invoices SET status = 'Overdue' WHERE status = 'Due' AND due_date < CURRENT_DATE");
  return updated;
}

// Discount / scholarship / waiver request → approval (FE-03, FIN-05, scenario "waiver exceeds policy").
router.post("/discounts", requirePermission("fees", "create"), asyncHandler(async (req, res) => {
  const { studentId, feeHeadId, discountType, mode = "Percent", value, reason, validFrom, validTo } = req.body || {};
  if (!studentId || !discountType || value === undefined) throw httpError(422, "Student, type and value are required.");
  if (!String(reason || "").trim()) throw httpError(422, "A reason is mandatory for discounts and waivers.");
  if (mode === "Percent" && (Number(value) < 0 || Number(value) > 100)) throw httpError(422, "Percent must be between 0 and 100.");
  const student = (await query("SELECT name FROM students WHERE id = $1", [studentId])).rows[0];
  if (!student) throw httpError(404, "Student not found.");
  const result = await transaction(async (client) => {
    const d = (await client.query(
      `INSERT INTO fee_discounts (student_id, fee_head_id, discount_type, mode, value, reason, valid_from, valid_to, requested_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [studentId, feeHeadId || null, discountType, mode, value, reason, validFrom || null, validTo || null, req.user.name],
    )).rows[0];
    const approval = await createApproval(req, {
      type: "fee_waiver", title: `${discountType} ${mode === "Percent" ? `${value}%` : `৳${value}`} – ${student.name}`,
      referenceTable: "fee_discounts", referenceId: d.id, amount: mode === "Fixed" ? value : null,
      payload: { discountId: d.id }, urgency: Number(value) >= 50 && mode === "Percent" ? "High" : "Normal",
    }, client);
    return { discount: d, approval };
  });
  res.status(201).json({ success: true, data: keysToCamel(result) });
}));

// Eligible sibling detection (FE-06): students sharing a guardian.
router.get("/discounts/sibling-candidates", requirePermission("fees", "view"), asyncHandler(async (req, res) => {
  const rows = (await query(
    `SELECT g.id AS guardian_id, g.name AS guardian_name, g.mobile,
            json_agg(json_build_object('id', s.id, 'name', s.name, 'className', s.class_name,
              'hasSiblingDiscount', EXISTS (SELECT 1 FROM fee_discounts d WHERE d.student_id = s.id AND d.discount_type = 'Sibling' AND d.status IN ('Approved','Pending')))
              ORDER BY s.admission_date NULLS LAST, s.id) AS students
     FROM guardians g JOIN guardian_students gs ON gs.guardian_id = g.id JOIN students s ON s.id = gs.student_id AND s.status = 'Active'
     GROUP BY g.id HAVING COUNT(*) > 1 ORDER BY g.name`,
  )).rows;
  res.json({ success: true, data: keysToCamel(rows) });
}));

router.post("/refunds", requirePermission("fees", "create"), asyncHandler(async (req, res) => {
  const { paymentId, studentId, amount, reason, method } = req.body || {};
  if (!amount || !String(reason || "").trim()) throw httpError(422, "Amount and reason are required.");
  const result = await transaction(async (client) => {
    if (paymentId) {
      const p = (await client.query("SELECT * FROM fee_payments WHERE id = $1", [paymentId])).rows[0];
      if (!p) throw httpError(404, "Original payment not found.");
      if (Number(amount) > Number(p.amount)) throw httpError(422, "Refund cannot exceed the original payment.");
    }
    const r = (await client.query(
      "INSERT INTO refunds (payment_id, student_id, amount, reason, method, requested_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *",
      [paymentId || null, studentId || null, amount, reason, method || "Cash", req.user.name],
    )).rows[0];
    const approval = await createApproval(req, {
      type: "refund", title: `Refund ৳${amount} – ${studentId || paymentId}`, referenceTable: "refunds", referenceId: r.id,
      amount, payload: { refundId: r.id },
    }, client);
    return { refund: r, approval };
  });
  res.status(201).json({ success: true, data: keysToCamel(result) });
}));

// Daily cashier closing (FE-16, FIN-13).
router.get("/cash-closing/preview", requirePermission("fees", "view"), asyncHandler(async (req, res) => {
  const date = req.query.date || new Date().toISOString().slice(0, 10);
  const collectorId = req.query.collectorId || req.user.id;
  const rows = (await query(
    `SELECT payment_method, COUNT(*)::int AS receipts, COALESCE(SUM(amount),0) AS total FROM fee_payments
     WHERE received_by = $1 AND status = 'Valid' AND paid_at::date = $2::date GROUP BY payment_method`,
    [collectorId, date],
  )).rows;
  const prev = (await query("SELECT closing_balance FROM cash_closings WHERE collector_id = $1 AND closing_date < $2 ORDER BY closing_date DESC LIMIT 1", [collectorId, date])).rows[0];
  const existing = (await query("SELECT * FROM cash_closings WHERE collector_id = $1 AND closing_date = $2", [collectorId, date])).rows[0];
  const cash = rows.find((r) => r.payment_method === "Cash");
  res.json({ success: true, data: keysToCamel({ date, collectorId, byMethod: rows, cashCollection: Number(cash?.total || 0), openingBalance: Number(prev?.closing_balance || 0), existing: existing || null }) });
}));

router.post("/cash-closing", requirePermission("fees", "create"), asyncHandler(async (req, res) => {
  const { date = new Date().toISOString().slice(0, 10), cashCounted, handedOver = 0, handedOverTo, note } = req.body || {};
  if (cashCounted === undefined) throw httpError(422, "Counted cash is required.");
  const collectorId = req.user.id;
  const sys = (await query(
    "SELECT COALESCE(SUM(amount),0) AS total FROM fee_payments WHERE received_by = $1 AND status = 'Valid' AND payment_method = 'Cash' AND paid_at::date = $2::date",
    [collectorId, date],
  )).rows[0];
  const prev = (await query("SELECT closing_balance FROM cash_closings WHERE collector_id = $1 AND closing_date < $2 ORDER BY closing_date DESC LIMIT 1", [collectorId, date])).rows[0];
  const opening = Number(prev?.closing_balance || 0);
  const expected = opening + Number(sys.total);
  const mismatch = Math.round((Number(cashCounted) - expected) * 100) / 100;
  const closing = Number(cashCounted) - Number(handedOver);
  const row = (await query(
    `INSERT INTO cash_closings (closing_date, collector_id, collector_name, opening_balance, system_collection, cash_counted, handed_over, handed_over_to, closing_balance, mismatch, note)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     ON CONFLICT (closing_date, collector_id) DO NOTHING RETURNING *`,
    [date, collectorId, req.user.name, opening, sys.total, cashCounted, handedOver, handedOverTo || null, closing, mismatch, note || null],
  )).rows[0];
  if (!row) throw httpError(409, "Cash for this date is already closed.");
  await writeAudit(req, { entity: "cash_closings", entityId: row.id, action: "CLOSE", newValue: row });
  if (Math.abs(mismatch) > 0.009) {
    await queueMessage({ channel: "Portal", eventType: "CashMismatch", recipientType: "Role", recipientId: "accounts", subject: "Cash mismatch", body: `${req.user.name}: cash mismatch of ৳${mismatch} on ${date}.` });
  }
  res.status(201).json({ success: true, data: keysToCamel(row) });
}));

// Due reminders (FE-14).
router.post("/reminders/send", requirePermission("fees", "send"), asyncHandler(async (req, res) => {
  const result = await sendDueReminders({ classId: req.body?.classId || null, minDue: Number(req.body?.minDue || 1), dueBy: req.body?.dueBy });
  await writeAudit(req, { entity: "fee_invoices", action: "REMINDERS", newValue: result });
  res.json({ success: true, data: result });
}));

async function sendDueReminders({ classId = null, minDue = 1, dueBy } = {}) {
  const rows = (await query(
    `SELECT s.id, s.name, COALESCE(g.mobile, s.parent_contact) AS mobile, g.id AS guardian_id,
            SUM(${DUE_SQL}) AS due
     FROM students s JOIN fee_invoices i ON i.student_id = s.id AND i.status NOT IN ('Paid','Cancelled')
     LEFT JOIN guardian_students gs ON gs.student_id = s.id AND gs.is_primary
     LEFT JOIN guardians g ON g.id = gs.guardian_id
     WHERE s.status = 'Active' AND ($1::text IS NULL OR s.class_id = $1)
     GROUP BY s.id, g.mobile, g.id HAVING SUM(${DUE_SQL}) >= $2`,
    [classId, minDue],
  )).rows;
  const lang = await defaultLanguage();
  const date = dueBy || new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  let queued = 0;
  for (const r of rows) {
    if (!r.mobile) continue;
    const body = await renderTemplate("fee_reminder", lang, { student: r.name, due: Number(r.due).toFixed(0), date });
    await queueMessage({ channel: "SMS", eventType: "FeeReminder", recipient: r.mobile, recipientType: "Guardian", recipientId: r.guardian_id, studentId: r.id, body });
    queued += 1;
  }
  await query("UPDATE fee_invoices SET last_reminder_at = NOW() WHERE status IN ('Due','Partial','Overdue')");
  return { students: rows.length, queued };
}

// Daily & monthly collection reports (feature list; ACC-04, FIN-17).
router.get("/reports/collection", requireAny(["fees", "view"], ["reports", "view"]), asyncHandler(async (req, res) => {
  const from = req.query.from || `${new Date().toISOString().slice(0, 8)}01`;
  const to = req.query.to || new Date().toISOString().slice(0, 10);
  const groupBy = req.query.groupBy || "day";
  const expr = {
    day: "to_char(p.paid_at, 'YYYY-MM-DD')",
    month: "to_char(p.paid_at, 'YYYY-MM')",
    method: "p.payment_method",
    collector: "COALESCE(p.collector_name, 'Unknown')",
    head: "COALESCE(i.fee_head, 'Other')",
    class: "s.class_name",
  }[groupBy] || "to_char(p.paid_at, 'YYYY-MM-DD')";
  const rows = (await query(
    `SELECT ${expr} AS label, COUNT(*)::int AS receipts, COALESCE(SUM(p.amount),0) AS total
     FROM fee_payments p LEFT JOIN fee_invoices i ON i.id = p.invoice_id JOIN students s ON s.id = p.student_id
     WHERE p.status = 'Valid' AND p.paid_at::date BETWEEN $1 AND $2 GROUP BY 1 ORDER BY 1`,
    [from, to],
  )).rows;
  res.json({ success: true, data: keysToCamel({ from, to, groupBy, rows, total: rows.reduce((s, r) => s + Number(r.total), 0) }) });
}));

// ------------------------------------------------------------ online payments
router.post("/online/initiate", asyncHandler(async (req, res) => {
  const { invoiceIds = [], gateway } = req.body || {};
  if (req.user.linkedType !== "Guardian" && !req.user.isAdmin && !req.user.matrix?.fees?.includes("create")) {
    throw httpError(403, "You do not have permission to start an online payment.");
  }
  if (req.user.linkedType === "Guardian") {
    const own = await query(
      `SELECT i.id FROM fee_invoices i JOIN guardian_students gs ON gs.student_id = i.student_id
       WHERE gs.guardian_id = $1 AND i.id = ANY($2)`,
      [req.user.linkedId, invoiceIds],
    );
    if (own.rowCount !== invoiceIds.length) throw httpError(403, "You can only pay invoices of your linked students.");
  }
  const result = await payments.initiate(req, { invoiceIds, gateway, guardianId: req.user.linkedType === "Guardian" ? req.user.linkedId : null });
  res.status(201).json({ success: true, data: keysToCamel(result) });
}));

router.get("/online/:id", asyncHandler(async (req, res) => {
  const row = (await query("SELECT * FROM gateway_transactions WHERE id::text = $1", [req.params.id])).rows[0];
  if (!row) throw httpError(404, "Transaction not found.");
  res.json({ success: true, data: keysToCamel(row) });
}));

module.exports = router;
module.exports.generateInvoices = generateInvoices;
module.exports.applyLateFines = applyLateFines;
module.exports.sendDueReminders = sendDueReminders;
