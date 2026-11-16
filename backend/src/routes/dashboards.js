// Role dashboards (SRS RP-20..24) and advanced analytics (feature list).
const express = require("express");
const { query } = require("../db/pool");
const asyncHandler = require("../utils/asyncHandler");
const { keysToCamel } = require("../utils/case");
const { hasPermission } = require("../middleware/auth");
const httpError = require("../utils/httpError");
const { localDate } = require("../utils/dates");

const router = express.Router();

async function one(sql, params = []) {
  return (await query(sql, params)).rows[0] || {};
}

router.get("/overview", asyncHandler(async (req, res) => {
  const today = localDate();
  const data = {};
  data.counts = await one(`SELECT
      (SELECT COUNT(*)::int FROM students WHERE status = 'Active') AS students,
      (SELECT COUNT(*)::int FROM classes WHERE status = 'Active') AS classes,
      (SELECT COUNT(*)::int FROM teachers WHERE status = 'Active') AS teachers,
      (SELECT COUNT(*)::int FROM staff WHERE status = 'Active') AS staff,
      (SELECT COUNT(*)::int FROM guardians WHERE status = 'Active') AS guardians`);
  data.attendanceToday = await one(`SELECT COUNT(*)::int AS marked,
      COUNT(*) FILTER (WHERE status IN ('Present','Late'))::int AS present,
      COUNT(*) FILTER (WHERE status = 'Absent')::int AS absent, COUNT(*) FILTER (WHERE status = 'Late')::int AS late
      FROM attendance WHERE attendance_date = $1`, [today]);
  data.staffToday = await one(`SELECT COUNT(*) FILTER (WHERE status IN ('Present','Late'))::int AS present, COUNT(*) FILTER (WHERE status='Absent')::int AS absent FROM staff_attendance WHERE attendance_date = $1`, [today]);

  if (hasPermission(req.user, "fees", "view") || hasPermission(req.user, "accounts", "view")) {
    data.fees = await one(`SELECT
        (SELECT COALESCE(SUM(amount),0) FROM fee_payments WHERE status = 'Valid' AND paid_at::date = $1) AS today_collection,
        (SELECT COALESCE(SUM(amount),0) FROM fee_payments WHERE status = 'Valid' AND date_trunc('month', paid_at) = date_trunc('month', CURRENT_DATE)) AS month_collection,
        (SELECT COALESCE(SUM(GREATEST(amount + late_fine - discount - paid_amount,0)),0) FROM fee_invoices WHERE status NOT IN ('Paid','Cancelled')) AS total_due,
        (SELECT COUNT(*)::int FROM gateway_transactions WHERE status = 'Pending') AS pending_online,
        (SELECT COALESCE(SUM(amount),0) FROM financial_transactions WHERE type = 'Expense' AND transaction_date = $1 AND approval_status = 'Approved') AS today_expense,
        (SELECT COUNT(*)::int FROM cash_closings WHERE closing_date = $1) AS closings_today`, [today]);
  }
  if (hasPermission(req.user, "admission", "view")) {
    data.admission = await one(`SELECT COUNT(*)::int AS applications,
        COUNT(*) FILTER (WHERE status = 'Shortlisted')::int AS shortlisted, COUNT(*) FILTER (WHERE status = 'Selected')::int AS selected,
        COUNT(*) FILTER (WHERE status = 'Admitted')::int AS admitted, COUNT(*) FILTER (WHERE status IN ('Submitted','Under Review'))::int AS pending,
        (SELECT COALESCE(SUM(seats),0)::int FROM admission_circulars WHERE status = 'Published') AS seats
        FROM admissions WHERE application_date > CURRENT_DATE - 365`);
  }
  if (hasPermission(req.user, "exams", "view") || hasPermission(req.user, "results", "view")) {
    data.exams = (await query(`SELECT e.id, e.name, e.result_status, e.marks_entry_end,
        (SELECT COUNT(*)::int FROM marks_entry_status m WHERE m.exam_id = e.id AND m.status IN ('Submitted','Locked')) AS submitted,
        (SELECT COUNT(*)::int FROM marks_entry_status m WHERE m.exam_id = e.id) AS total
        FROM exams e WHERE e.result_status <> 'Published' OR e.published_at > NOW() - INTERVAL '30 days' ORDER BY e.created_at DESC LIMIT 5`)).rows;
  }
  data.pendingApprovals = (await query(
    "SELECT request_type, COUNT(*)::int AS n FROM approval_requests WHERE status IN ('Pending','Clarification') GROUP BY request_type",
  )).rows.filter((r) => req.user.isAdmin || hasPermission(req.user, require("../services/approvals").REQUEST_TYPES[r.request_type]?.module, "approve"));
  data.attendanceTrend = (await query(`SELECT attendance_date::text AS date,
      ROUND(100.0 * COUNT(*) FILTER (WHERE status IN ('Present','Late')) / NULLIF(COUNT(*),0), 1) AS rate
      FROM attendance WHERE attendance_date > CURRENT_DATE - 30 GROUP BY 1 ORDER BY 1`)).rows;
  data.notices = (await query("SELECT id, title, priority, created_at FROM notices ORDER BY created_at DESC LIMIT 5")).rows;
  data.idCards = await one(`SELECT
      (SELECT COUNT(*)::int FROM students s WHERE status = 'Active' AND NOT EXISTS (SELECT 1 FROM id_cards c WHERE c.holder_type='Student' AND c.holder_id = s.id AND c.status='Active')) AS students_without_card,
      (SELECT COUNT(*)::int FROM id_card_print_jobs WHERE status IN ('Queued','Processing')) AS jobs_pending`);
  data.lowStock = (await one("SELECT COUNT(*)::int AS n FROM inventory_items WHERE status = 'Active' AND quantity <= reorder_level")).n;
  data.messages = await one(`SELECT COUNT(*) FILTER (WHERE status='Queued')::int AS queued, COUNT(*) FILTER (WHERE status='Failed')::int AS failed FROM message_logs WHERE created_at > NOW() - INTERVAL '7 days'`);
  res.json({ success: true, data: keysToCamel(data) });
}));

// Advanced analytics: class performance, attendance vs result, collection trend, dropout risk.
router.get("/analytics", asyncHandler(async (req, res) => {
  if (!hasPermission(req.user, "reports", "view")) throw httpError(403, "Analytics requires report access.");
  const [collection, classPerf, risk, admissionsTrend, genders] = await Promise.all([
    query(`SELECT to_char(date_trunc('month', paid_at), 'YYYY-MM') AS month, COALESCE(SUM(amount),0) AS collected
           FROM fee_payments WHERE status = 'Valid' AND paid_at > NOW() - INTERVAL '12 months' GROUP BY 1 ORDER BY 1`),
    query(`SELECT r.class_name, ROUND(AVG(r.gpa),2) AS avg_gpa, ROUND(100.0 * COUNT(*) FILTER (WHERE r.status='Pass') / NULLIF(COUNT(*),0),1) AS pass_rate, COUNT(*)::int AS students
           FROM results r JOIN exams e ON e.id = r.exam_id WHERE e.result_status IN ('Published','Processed','Reviewed') GROUP BY r.class_name ORDER BY r.class_name`),
    query(`SELECT s.id, s.name, s.class_name,
             ROUND(100.0 * COUNT(a.*) FILTER (WHERE a.status IN ('Present','Late')) / NULLIF(COUNT(a.*),0),1) AS attendance_rate,
             (SELECT COALESCE(SUM(GREATEST(amount + late_fine - discount - paid_amount,0)),0) FROM fee_invoices i WHERE i.student_id = s.id AND i.status NOT IN ('Paid','Cancelled')) AS due,
             (SELECT r.status FROM results r WHERE r.student_id = s.id ORDER BY r.created_at DESC LIMIT 1) AS last_result
           FROM students s LEFT JOIN attendance a ON a.student_id = s.id AND a.attendance_date > CURRENT_DATE - 60
           WHERE s.status = 'Active' GROUP BY s.id`),
    query(`SELECT to_char(date_trunc('month', application_date), 'YYYY-MM') AS month, COUNT(*)::int AS applications,
             COUNT(*) FILTER (WHERE status='Admitted')::int AS admitted FROM admissions WHERE application_date > CURRENT_DATE - 365 GROUP BY 1 ORDER BY 1`),
    query("SELECT COALESCE(gender,'Unknown') AS gender, COUNT(*)::int AS n FROM students WHERE status='Active' GROUP BY 1"),
  ]);
  const months = collection.rows.map((r) => Number(r.collected));
  const avg = months.length ? months.slice(-3).reduce((s, v) => s + v, 0) / Math.min(3, months.length) : 0;
  const atRisk = risk.rows.map((r) => {
    let score = 0;
    if (r.attendance_rate !== null && Number(r.attendance_rate) < 75) score += 40;
    if (Number(r.due) > 0) score += 20;
    if (r.last_result === "Fail") score += 40;
    return { ...r, riskScore: score };
  }).filter((r) => r.riskScore >= 40).sort((a, b) => b.riskScore - a.riskScore).slice(0, 25);
  res.json({
    success: true,
    data: keysToCamel({
      collectionTrend: collection.rows, collectionForecastNextMonth: Math.round(avg), classPerformance: classPerf.rows,
      dropoutRisk: atRisk, admissionsTrend: admissionsTrend.rows, genderDistribution: genders.rows,
    }),
  });
}));

module.exports = router;
