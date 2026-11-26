const express = require("express");
const { query } = require("../db/pool");
const asyncHandler = require("../utils/asyncHandler");
const httpError = require("../utils/httpError");
const { keysToCamel } = require("../utils/case");
const { localDate, localMonth, localWeekday } = require("../utils/dates");
const { cancelApproval, resubmitApproval } = require("../services/approvals");

const router = express.Router();
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function requireGuardian(req) {
  if (req.user.linkedType !== "Guardian" || !req.user.linkedId) throw httpError(403, "Guardian portal access only.");
  return req.user.linkedId;
}

// Data isolation: a guardian only sees linked, enabled students (GD-05, GA-02, GDX-01).
// Returns the link so callers can honour its per-guardian view permissions.
async function assertLinked(guardianId, studentId) {
  const r = await query(
    `SELECT gs.* FROM guardian_students gs JOIN guardians g ON g.id = gs.guardian_id JOIN students s ON s.id = gs.student_id
     WHERE gs.guardian_id = $1 AND gs.student_id = $2 AND gs.access_status = 'Enabled' AND g.portal_access AND s.status NOT IN ('Archived', 'Transferred', 'Dropped', 'Passed Out', 'Inactive')`,
    [guardianId, studentId],
  );
  if (!r.rowCount) throw httpError(403, "This student is not linked to your account.");
  return r.rows[0];
}

// Guardian accounts created by the admin carry a temporary password that must be changed
// on first sign-in before any student data is shown (Guardian App workflow §2, §8).
router.use("/guardian", asyncHandler(async (req, res, next) => {
  requireGuardian(req);
  const u = (await query("SELECT must_change_password FROM users WHERE id = $1", [req.user.id])).rows[0];
  if (u?.must_change_password) {
    return res.status(403).json({ success: false, code: "PASSWORD_CHANGE_REQUIRED", message: "Please change your temporary password to continue." });
  }
  const g = (await query("SELECT status, portal_access FROM guardians WHERE id = $1", [req.user.linkedId])).rows[0];
  if (!g || !g.portal_access || g.status !== "Active") {
    return res.status(403).json({ success: false, code: "ACCOUNT_INACTIVE", message: "Your guardian account is inactive. Please contact the school." });
  }
  return next();
}));

// School-controlled visibility for guardians (Spec §1F class position, §1J teacher contact).
async function guardianVisibility() {
  const s = (await query("SELECT show_class_position, show_teacher_phone_to_guardians FROM system_settings WHERE id = 1")).rows[0] || {};
  return { showPosition: s.show_class_position !== false, showTeacherPhone: s.show_teacher_phone_to_guardians !== false };
}

async function hideResultsOnDue(studentId) {
  const s = (await query("SELECT result_hide_on_due FROM system_settings WHERE id = 1")).rows[0];
  if (!s?.result_hide_on_due) return false;
  const due = (await query("SELECT COALESCE(SUM(amount + late_fine - discount - paid_amount),0) AS due FROM fee_invoices WHERE student_id = $1 AND status NOT IN ('Paid','Cancelled')", [studentId])).rows[0];
  return Number(due.due) > 0;
}

// ---------------------------------------------------------------- Guardian portal
router.get("/guardian/home", asyncHandler(async (req, res) => {
  const gid = requireGuardian(req);
  const guardian = (await query("SELECT id, name, mobile, email, relation_default FROM guardians WHERE id = $1", [gid])).rows[0];
  const today = localDate();
  const dayName = DAYS[localWeekday(new Date())];
  const children = (await query(
    `SELECT s.id, s.name, s.name_bn, s.photo_url, s.class_name, s.section, s.roll, s.shift, s.class_id, s.status, gs.relation,
            gs.is_primary, gs.can_view_results, gs.can_view_fees,
            c.teacher_id, t.name AS class_teacher, t.phone AS class_teacher_phone,
            (SELECT status FROM attendance a WHERE a.student_id = s.id AND a.attendance_date = $2) AS today_attendance,
            (SELECT in_time FROM attendance a WHERE a.student_id = s.id AND a.attendance_date = $2) AS today_in_time,
            (SELECT out_time FROM attendance a WHERE a.student_id = s.id AND a.attendance_date = $2) AS today_out_time,
            (SELECT json_build_object('total', COUNT(*), 'present', COUNT(*) FILTER (WHERE a.status IN ('Present','Late','Early Leave')),
                                      'absent', COUNT(*) FILTER (WHERE a.status = 'Absent'), 'late', COUNT(*) FILTER (WHERE a.status = 'Late'))
               FROM attendance a WHERE a.student_id = s.id AND to_char(a.attendance_date, 'YYYY-MM') = $3) AS month_attendance,
            CASE WHEN gs.can_view_fees THEN (SELECT COALESCE(SUM(amount + late_fine - discount - paid_amount),0) FROM fee_invoices i
               WHERE i.student_id = s.id AND i.status NOT IN ('Paid','Cancelled') AND i.fee_head IS DISTINCT FROM 'Advance Credit') ELSE 0 END AS fee_due,
            CASE WHEN gs.can_view_fees THEN (SELECT COALESCE(SUM(amount + late_fine - discount),0) FROM fee_invoices i
               WHERE i.student_id = s.id AND i.status <> 'Cancelled' AND to_char(i.billing_month, 'YYYY-MM') = $3) ELSE 0 END AS month_fee,
            (SELECT COUNT(*)::int FROM homework h WHERE h.class_id = s.class_id AND (h.section IS NULL OR h.section = s.section)
               AND h.status = 'Published' AND (h.due_date IS NULL OR h.due_date >= $2)
               AND NOT EXISTS (SELECT 1 FROM homework_submissions hs WHERE hs.homework_id = h.id AND hs.student_id = s.id)) AS homework_count,
            (SELECT json_build_object('name', e.name, 'date', es.exam_date, 'subject', sub.name, 'startTime', es.start_time) FROM exam_schedules es
               JOIN exams e ON e.id = es.exam_id JOIN subjects sub ON sub.id = es.subject_id
               WHERE es.class_id = s.class_id AND es.exam_date >= $2 ORDER BY es.exam_date, es.start_time LIMIT 1) AS next_exam,
            (SELECT COALESCE(json_agg(json_build_object('period', r.period_code, 'start', r.start_time, 'end', r.end_time, 'subject', COALESCE(sub.name, r.label),
                                      'teacher', tt.name, 'room', r.room_no, 'isBreak', r.is_break) ORDER BY r.start_time NULLS LAST, r.period_code), '[]'::json)
               FROM routine_entries r LEFT JOIN subjects sub ON sub.id = r.subject_id LEFT JOIN teachers tt ON tt.id = r.teacher_id
               WHERE r.class_id = s.class_id AND (r.section IS NULL OR r.section = s.section) AND r.day_of_week = $4) AS today_routine,
            (SELECT json_build_object('exam', e.name, 'grade', r.grade, 'gpa', r.gpa, 'publishedAt', r.published_at) FROM results r JOIN exams e ON e.id = r.exam_id
               WHERE r.student_id = s.id AND r.published AND gs.can_view_results ORDER BY r.published_at DESC NULLS LAST LIMIT 1) AS latest_result
     FROM guardian_students gs JOIN students s ON s.id = gs.student_id
     LEFT JOIN classes c ON c.id = s.class_id LEFT JOIN teachers t ON t.id = c.teacher_id
     WHERE gs.guardian_id = $1 AND gs.access_status = 'Enabled' AND s.status NOT IN ('Archived', 'Transferred', 'Dropped', 'Passed Out', 'Inactive') ORDER BY s.name`,
    [gid, today, localMonth(), dayName],
  )).rows;
  const visibility = await guardianVisibility();
  for (const c of children) {
    if (!visibility.showTeacherPhone) c.class_teacher_phone = null;
    const m = c.month_attendance || {};
    c.month_attendance_percentage = Number(m.total) ? Math.round((Number(m.present) / Number(m.total)) * 1000) / 10 : null;
  }
  const upcomingExams = (await query(
    `SELECT es.exam_date, es.start_time, es.end_time, es.room, e.name AS exam_name, sub.name AS subject_name, s.id AS student_id, s.name AS student_name
     FROM guardian_students gs JOIN students s ON s.id = gs.student_id JOIN exam_schedules es ON es.class_id = s.class_id
     JOIN exams e ON e.id = es.exam_id JOIN subjects sub ON sub.id = es.subject_id
     WHERE gs.guardian_id = $1 AND gs.access_status = 'Enabled' AND s.status NOT IN ('Archived', 'Transferred', 'Dropped', 'Passed Out', 'Inactive') AND es.exam_date >= $2
     ORDER BY es.exam_date, es.start_time NULLS LAST LIMIT 10`,
    [gid, today],
  )).rows;
  const recentNotifications = (await query(
    `SELECT m.id, m.event_type, m.subject, m.body, m.student_id, s.name AS student_name, m.created_at, m.read_at FROM message_logs m
     LEFT JOIN students s ON s.id = m.student_id
     WHERE m.recipient_type = 'Guardian' AND m.recipient_id = $1 AND m.channel = 'Portal' ORDER BY m.created_at DESC LIMIT 5`,
    [gid],
  )).rows;
  const notices = (await query(
    `SELECT id, title, message, priority, category, created_at, attachment_url, target_class FROM notices
     WHERE show_on_board AND status IN ('Sent','Published','Draft') AND audience ILIKE ANY (ARRAY['%all%','%guardian%','%parent%','%student%','%everyone%'])
       AND (target_class IS NULL OR target_class = '' OR EXISTS (SELECT 1 FROM guardian_students gs JOIN students s ON s.id = gs.student_id
             WHERE gs.guardian_id = $1 AND s.class_name ILIKE notices.target_class || '%'))
     ORDER BY created_at DESC LIMIT 10`,
    [gid],
  )).rows;
  const unread = (await query("SELECT COUNT(*)::int AS n FROM message_logs WHERE recipient_type = 'Guardian' AND recipient_id = $1 AND channel = 'Portal' AND read_at IS NULL", [gid])).rows[0].n;
  res.json({
    success: true,
    data: keysToCamel({
      guardian, children, notices, upcomingExams, recentNotifications, unreadNotifications: unread,
      totalDue: children.reduce((s, c) => s + Number(c.fee_due), 0),
    }),
  });
}));

router.get("/guardian/students/:id/attendance", asyncHandler(async (req, res) => {
  const gid = requireGuardian(req);
  await assertLinked(gid, req.params.id);
  const month = req.query.month || localMonth();
  const rows = (await query(
    "SELECT attendance_date, status, in_time, out_time FROM attendance WHERE student_id = $1 AND to_char(attendance_date, 'YYYY-MM') = $2 ORDER BY attendance_date",
    [req.params.id, month],
  )).rows;
  const present = rows.filter((r) => ["Present", "Late", "Early Leave"].includes(r.status)).length;
  const count = (st) => rows.filter((r) => r.status === st).length;
  const summary = {
    total: rows.length, present, absent: count("Absent"), late: count("Late"), leave: count("Leave"),
    earlyLeave: count("Early Leave"),
  };
  // Six-month history for the attendance-history view.
  const history = (await query(
    `SELECT to_char(attendance_date, 'YYYY-MM') AS month, COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE status IN ('Present','Late','Early Leave'))::int AS present, COUNT(*) FILTER (WHERE status = 'Absent')::int AS absent,
            COUNT(*) FILTER (WHERE status = 'Late')::int AS late
     FROM attendance WHERE student_id = $1 AND attendance_date >= (date_trunc('month', CURRENT_DATE) - INTERVAL '5 months')
     GROUP BY 1 ORDER BY 1 DESC`,
    [req.params.id],
  )).rows.map((h) => ({ ...h, percentage: h.total ? Math.round((h.present / h.total) * 1000) / 10 : null }));
  res.json({ success: true, data: keysToCamel({ month, records: rows, summary, history, percentage: rows.length ? Math.round((present / rows.length) * 1000) / 10 : null }) });
}));

router.get("/guardian/students/:id/results", asyncHandler(async (req, res) => {
  const gid = requireGuardian(req);
  const link = await assertLinked(gid, req.params.id);
  if (!link.can_view_results) {
    return res.json({ success: true, data: [], message: "The school has not enabled result access for your account." });
  }
  if (await hideResultsOnDue(req.params.id)) {
    return res.json({ success: true, data: [], message: "Results are hidden until outstanding fees are cleared." });
  }
  const rows = (await query(
    `SELECT r.*, e.name AS exam_name, e.exam_type FROM results r JOIN exams e ON e.id = r.exam_id
     WHERE r.student_id = $1 AND r.published ORDER BY r.published_at DESC`,
    [req.params.id],
  )).rows;
  const { showPosition } = await guardianVisibility();
  if (!showPosition) for (const r of rows) { r.class_position = null; r.section_position = null; }
  res.json({ success: true, data: keysToCamel(rows), positionVisible: showPosition });
}));

router.get("/guardian/students/:id/fees", asyncHandler(async (req, res) => {
  const gid = requireGuardian(req);
  const link = await assertLinked(gid, req.params.id);
  if (!link.can_view_fees) {
    return res.json({ success: true, data: { invoices: [], payments: [], discounts: [], gateways: {}, hidden: true }, message: "The school has not enabled fee access for your account." });
  }
  // Each student's fees stay separate: everything here is filtered by this one student.
  const [invoices, payments, discounts] = await Promise.all([
    query("SELECT *, GREATEST(amount + late_fine - discount - paid_amount, 0) AS due FROM fee_invoices WHERE student_id = $1 AND status <> 'Cancelled' AND fee_head IS DISTINCT FROM 'Advance Credit' ORDER BY billing_month DESC NULLS LAST", [req.params.id]),
    query(`SELECT p.id, p.receipt_no, p.amount, p.payment_method, p.paid_at, p.status, i.fee_head, i.billing_month
           FROM fee_payments p LEFT JOIN fee_invoices i ON i.id = p.invoice_id WHERE p.student_id = $1 ORDER BY p.paid_at DESC`, [req.params.id]),
    query(`SELECT d.id, d.discount_type, d.mode, d.value, d.reason, d.valid_from, d.valid_to, d.status, fh.name AS fee_head
           FROM fee_discounts d LEFT JOIN fee_heads fh ON fh.id = d.fee_head_id WHERE d.student_id = $1 AND d.status = 'Approved'
           ORDER BY d.created_at DESC`, [req.params.id]).catch(() => ({ rows: [] })),
  ]);
  const settings = (await query("SELECT payment_gateways FROM system_settings WHERE id = 1")).rows[0];
  const open = invoices.rows.filter((i) => Number(i.due) > 0);
  const thisMonth = localMonth();
  const summary = {
    totalPayable: open.reduce((s, i) => s + Number(i.due), 0),
    previousDue: open.filter((i) => i.billing_month && String(i.billing_month).slice(0, 7) < thisMonth).reduce((s, i) => s + Number(i.due), 0),
    currentMonthDue: open.filter((i) => String(i.billing_month || "").slice(0, 7) === thisMonth).reduce((s, i) => s + Number(i.due), 0),
    totalPaid: payments.rows.filter((p) => p.status === "Valid").reduce((s, p) => s + Number(p.amount), 0),
  };
  res.json({ success: true, data: keysToCamel({ invoices: invoices.rows, payments: payments.rows, discounts: discounts.rows, summary, gateways: settings?.payment_gateways || {} }) });
}));

// Digital receipt – only for payments of the guardian's own linked students.
router.get("/guardian/receipts/:receiptNo", asyncHandler(async (req, res) => {
  const gid = requireGuardian(req);
  const first = (await query("SELECT * FROM fee_payments WHERE receipt_no = $1", [req.params.receiptNo])).rows[0];
  if (!first) throw httpError(404, "Receipt not found.");
  const link = await assertLinked(gid, first.student_id);
  if (!link.can_view_fees) throw httpError(403, "Fee access is not enabled for your account.");
  // A grouped receipt may span siblings; show only the lines of students this guardian may see.
  const lines = (first.group_ref
    ? (await query("SELECT p.*, i.fee_head, i.billing_month FROM fee_payments p LEFT JOIN fee_invoices i ON i.id = p.invoice_id WHERE p.group_ref = $1 ORDER BY p.receipt_no", [first.group_ref])).rows
    : (await query("SELECT p.*, i.fee_head, i.billing_month FROM fee_payments p LEFT JOIN fee_invoices i ON i.id = p.invoice_id WHERE p.id = $1", [first.id])).rows
  ).filter((l) => l.student_id === first.student_id);
  const student = (await query("SELECT id, name, class_name, section, roll FROM students WHERE id = $1", [first.student_id])).rows[0];
  const profile = (await query("SELECT name, address, phone, email, logo_url FROM institute_profile WHERE id = 1")).rows[0];
  res.json({
    success: true,
    data: keysToCamel({
      receiptNo: first.receipt_no, paidAt: first.paid_at, method: first.payment_method, reference: first.reference_no, status: first.status,
      lines: lines.map((l) => ({ receiptNo: l.receipt_no, feeHead: l.fee_head, billingMonth: l.billing_month, amount: l.amount, status: l.status })),
      student, institute: profile, total: lines.filter((l) => l.status === "Valid").reduce((s, l) => s + Number(l.amount), 0),
    }),
  });
}));

router.get("/guardian/students/:id/academics", asyncHandler(async (req, res) => {
  const gid = requireGuardian(req);
  await assertLinked(gid, req.params.id);
  const s = (await query("SELECT class_id, section, class_name FROM students WHERE id = $1", [req.params.id])).rows[0];
  const [routine, homework, examRoutine, events, resources] = await Promise.all([
    query(`SELECT r.*, sub.name AS subject_name, t.name AS teacher_name FROM routine_entries r
           LEFT JOIN subjects sub ON sub.id = r.subject_id LEFT JOIN teachers t ON t.id = r.teacher_id
           WHERE r.class_id = $1 AND ($2::text IS NULL OR r.section = $2) ORDER BY r.day_of_week, r.start_time NULLS LAST, r.period_code`, [s?.class_id, s?.section || null]),
    query(`SELECT h.*, sub.name AS subject_name FROM homework h LEFT JOIN subjects sub ON sub.id = h.subject_id
           WHERE h.class_id = $1 AND (h.section IS NULL OR h.section = $2) AND h.status = 'Published' ORDER BY h.due_date DESC NULLS LAST LIMIT 30`, [s?.class_id, s?.section]),
    query(`SELECT es.*, e.name AS exam_name, sub.name AS subject_name FROM exam_schedules es JOIN exams e ON e.id = es.exam_id
           JOIN subjects sub ON sub.id = es.subject_id WHERE es.class_id = $1 AND (es.exam_date IS NULL OR es.exam_date >= CURRENT_DATE - 1) ORDER BY es.exam_date NULLS LAST`, [s?.class_id]),
    query("SELECT * FROM academic_events WHERE is_public AND start_date >= CURRENT_DATE - 30 ORDER BY start_date LIMIT 60"),
    query("SELECT lr.*, sub.name AS subject_name FROM learning_resources lr LEFT JOIN subjects sub ON sub.id = lr.subject_id WHERE lr.class_id = $1 ORDER BY lr.created_at DESC LIMIT 30", [s?.class_id]),
  ]);
  const online = (await query("SELECT * FROM online_classes WHERE class_id = $1 AND (section IS NULL OR section = $2) ORDER BY scheduled_at DESC NULLS LAST LIMIT 20", [s?.class_id, s?.section])).rows;
  // Assignment submission status for this student.
  const subs = homework.rows.length
    ? (await query("SELECT homework_id, status, marks, remarks, submitted_at FROM homework_submissions WHERE student_id = $1 AND homework_id = ANY($2)",
      [req.params.id, homework.rows.map((h) => h.id)])).rows
    : [];
  const subMap = new Map(subs.map((x) => [x.homework_id, x]));
  const homeworkRows = homework.rows.map((h) => {
    const sub = subMap.get(h.id);
    delete h.submissions;
    return { ...h, submission_status: sub ? sub.status : "Not Submitted", submission_marks: sub?.marks ?? null, submission_remarks: sub?.remarks ?? null, submitted_at: sub?.submitted_at ?? null };
  });
  res.json({ success: true, data: keysToCamel({ routine: routine.rows, homework: homeworkRows, examRoutine: examRoutine.rows, events: events.rows, resources: resources.rows, onlineClasses: online }) });
}));

router.get("/guardian/students/:id/extras", asyncHandler(async (req, res) => {
  const gid = requireGuardian(req);
  await assertLinked(gid, req.params.id);
  const id = req.params.id;
  const [hifz, hifzLogs, salah, transport, library, hostel, leaves, teachers] = await Promise.all([
    query("SELECT COUNT(*) FILTER (WHERE status IN ('Done','Revised'))::int AS done FROM hifz_progress WHERE student_id = $1", [id]),
    query("SELECT h.*, t.name AS ustad_name FROM hifz_logs h LEFT JOIN teachers t ON t.id = h.ustad_id WHERE student_id = $1 ORDER BY log_date DESC LIMIT 7", [id]),
    query(`SELECT attendance_date, wakt, status FROM salah_attendance WHERE student_id = $1 AND attendance_date > CURRENT_DATE - 7 ORDER BY attendance_date, wakt`, [id]),
    query(`SELECT ta.stop_name, COALESCE(NULLIF(ta.dropoff_stop, ''), ta.stop_name) AS dropoff_stop, r.name AS route_name, r.morning_departure,
             r.evening_departure, r.stops, v.registration_no, v.driver_name, v.driver_phone,
             (SELECT json_build_object('lat', latitude, 'lng', longitude, 'at', recorded_at) FROM vehicle_locations vl WHERE vl.vehicle_id = v.id ORDER BY recorded_at DESC LIMIT 1) AS location
           FROM transport_assignments ta JOIN transport_routes r ON r.id = ta.route_id LEFT JOIN transport_vehicles v ON v.id = r.vehicle_id
           WHERE ta.student_id = $1 AND ta.status = 'Active'`, [id]),
    query("SELECT li.*, b.title FROM library_issues li JOIN library_books b ON b.id = li.book_id WHERE li.borrower_type = 'Student' AND li.borrower_id = $1 ORDER BY li.issue_date DESC LIMIT 10", [id]),
    query("SELECT a.*, r.building, r.room_no FROM hostel_allocations a JOIN hostel_rooms r ON r.id = a.room_id WHERE a.student_id = $1 AND a.status = 'Active'", [id]),
    // Each leave carries its approval: id, live status (incl. Clarification), history and what this guardian may do.
    query(`SELECT l.*, a.id AS approval_id, a.status AS approval_status, a.history AS approval_history,
              a.decision_note AS approval_note, (a.maker_id = $2) AS own_request
            FROM leave_requests l
            LEFT JOIN LATERAL (SELECT * FROM approval_requests x WHERE x.request_type = 'leave' AND x.reference_id = l.id
                               ORDER BY x.created_at DESC LIMIT 1) a ON TRUE
            WHERE l.applicant_type = 'Student' AND l.applicant_id = $1 ORDER BY l.created_at DESC LIMIT 20`, [id, req.user.id]),
    query(`SELECT DISTINCT t.id, t.name, t.designation, t.phone, sub.name AS subject_name, (c.teacher_id = t.id) AS is_class_teacher
           FROM students s JOIN classes c ON c.id = s.class_id
           LEFT JOIN class_assignments ca ON ca.class_id = s.class_id AND (ca.section = s.section OR ca.section IS NULL)
           LEFT JOIN subjects sub ON sub.id = ca.subject_id
           JOIN teachers t ON t.id = ca.teacher_id OR t.id = c.teacher_id
           WHERE s.id = $1`, [id]),
  ]);
  res.json({
    success: true,
    data: keysToCamel({
      hifz: { parasDone: hifz.rows[0]?.done || 0, logs: hifzLogs.rows },
      salah: salah.rows, transport: transport.rows[0] || null, library: library.rows, hostel: hostel.rows[0] || null,
      leaves: leaves.rows.map(({ approval_history: history, own_request: own, ...l }) => {
        const status = l.approval_status === "Clarification" ? "Clarification" : l.status;
        const open = ["Pending", "Clarification"].includes(status) && Boolean(l.approval_id);
        return {
          ...l, status, history: Array.isArray(history) ? history.map(({ byId, ...h }) => h) : [],
          decision_note: l.decision_note || (status === "Clarification" ? l.approval_note : null),
          can_withdraw: open && Boolean(own), can_respond: status === "Clarification" && Boolean(own),
        };
      }),
      teachers: (await guardianVisibility()).showTeacherPhone ? teachers.rows : teachers.rows.map((t) => ({ ...t, phone: null })),
    }),
  });
}));

router.get("/guardian/notifications", asyncHandler(async (req, res) => {
  const gid = requireGuardian(req);
  const studentId = req.query.studentId ? String(req.query.studentId) : null;
  if (studentId) await assertLinked(gid, studentId);
  const rows = (await query(
    `SELECT m.id, m.event_type, m.subject, m.body, m.student_id, s.name AS student_name, m.created_at, m.read_at
     FROM message_logs m LEFT JOIN students s ON s.id = m.student_id
     WHERE m.recipient_type = 'Guardian' AND m.recipient_id = $1 AND m.channel = 'Portal' AND ($2::text IS NULL OR m.student_id = $2)
     ORDER BY m.created_at DESC LIMIT 100`,
    [gid, studentId],
  )).rows;
  // The web portal marks everything read on open; the mobile app passes markRead=false and
  // marks read explicitly so unread badges stay accurate.
  if (req.query.markRead !== "false") {
    await query("UPDATE message_logs SET read_at = NOW(), status = 'Read' WHERE recipient_type = 'Guardian' AND recipient_id = $1 AND channel = 'Portal' AND read_at IS NULL", [gid]);
  }
  res.json({ success: true, data: keysToCamel(rows) });
}));

// Push device registration (Guardian App H7). A token belongs to one guardian at a time:
// re-registering on a shared phone moves it to the guardian who is signed in now.
router.post("/guardian/devices", asyncHandler(async (req, res) => {
  const gid = requireGuardian(req);
  const token = String(req.body?.token || "").trim();
  if (token.length < 20 || token.length > 4096) throw httpError(422, "A valid device token is required.");
  const platform = ["android", "ios", "web"].includes(req.body?.platform) ? req.body.platform : null;
  await query(
    `INSERT INTO guardian_devices (user_id, guardian_id, token, platform, app_version) VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (token) DO UPDATE SET user_id = EXCLUDED.user_id, guardian_id = EXCLUDED.guardian_id,
       platform = EXCLUDED.platform, app_version = EXCLUDED.app_version, last_seen_at = NOW()`,
    [req.user.id, gid, token, platform, String(req.body?.appVersion || "").slice(0, 40) || null],
  );
  res.status(201).json({ success: true, data: { registered: true, pushEnabled: require("../services/push").isConfigured() } });
}));

router.delete("/guardian/devices", asyncHandler(async (req, res) => {
  requireGuardian(req);
  const token = String(req.body?.token || req.query.token || "").trim();
  if (token) await query("DELETE FROM guardian_devices WHERE token = $1 AND user_id = $2", [token, req.user.id]);
  res.status(204).send();
}));

// Live-sync version: one hash over everything this guardian can see in the app. Row counts catch
// creates and deletes, max(updated_at) (kept current by the set_updated_at triggers) catches edits;
// tables without that trigger are hashed row by row. The app polls this every 30 s and reloads
// open screens when it changes, so web edits, including deletions, reach the phone without a restart.
const SYNC_STATE_SQL = `
WITH kids AS (
  SELECT s.id, s.class_id FROM guardian_students gs JOIN students s ON s.id = gs.student_id
  WHERE gs.guardian_id = $1 AND gs.access_status = 'Enabled'
),
leaves AS (SELECT id FROM leave_requests WHERE applicant_type = 'Student' AND applicant_id IN (SELECT id FROM kids))
SELECT md5(concat_ws('|',
  (SELECT count(*) || ':' || COALESCE(max(updated_at)::text, '') FROM guardians WHERE id = $1),
  (SELECT count(*) || ':' || COALESCE(max(updated_at)::text, '') FROM guardian_students WHERE guardian_id = $1),
  (SELECT count(*) || ':' || COALESCE(max(updated_at)::text, '') FROM students WHERE id IN (SELECT id FROM kids)),
  (SELECT count(*) || ':' || COALESCE(max(updated_at)::text, '') FROM attendance WHERE student_id IN (SELECT id FROM kids)),
  (SELECT count(*) || ':' || COALESCE(max(updated_at)::text, '') FROM salah_attendance WHERE student_id IN (SELECT id FROM kids)),
  (SELECT count(*) || ':' || COALESCE(max(updated_at)::text, '') FROM hifz_logs WHERE student_id IN (SELECT id FROM kids)),
  (SELECT count(*) || ':' || COALESCE(max(updated_at)::text, '') FROM results WHERE student_id IN (SELECT id FROM kids)),
  (SELECT count(*) || ':' || COALESCE(max(updated_at)::text, '') FROM fee_invoices WHERE student_id IN (SELECT id FROM kids)),
  (SELECT count(*) || ':' || COALESCE(max(updated_at)::text, '') FROM fee_discounts WHERE student_id IN (SELECT id FROM kids)),
  (SELECT md5(COALESCE(string_agg(p::text, '' ORDER BY p.id), '')) FROM fee_payments p WHERE student_id IN (SELECT id FROM kids)),
  (SELECT md5(COALESCE(string_agg(h::text, '' ORDER BY h.id), '')) FROM homework_submissions h WHERE student_id IN (SELECT id FROM kids)),
  (SELECT count(*) || ':' || COALESCE(max(updated_at)::text, '') FROM transport_assignments WHERE student_id IN (SELECT id FROM kids)),
  (SELECT count(*) || ':' || COALESCE(max(updated_at)::text, '') FROM hostel_allocations WHERE student_id IN (SELECT id FROM kids)),
  (SELECT count(*) || ':' || COALESCE(max(updated_at)::text, '') FROM library_issues WHERE borrower_type = 'Student' AND borrower_id IN (SELECT id FROM kids)),
  (SELECT count(*) || ':' || COALESCE(max(updated_at)::text, '') FROM leave_requests WHERE id IN (SELECT id FROM leaves)),
  (SELECT count(*) || ':' || COALESCE(max(updated_at)::text, '') FROM approval_requests WHERE request_type = 'leave' AND reference_id IN (SELECT id FROM leaves)),
  (SELECT count(*) || ':' || COALESCE(max(updated_at)::text, '') FROM complaints WHERE guardian_id = $1),
  (SELECT count(*) || ':' || COALESCE(max(updated_at)::text, '') FROM ptm_slots),
  (SELECT count(*) || ':' || COALESCE(max(updated_at)::text, '') FROM routine_entries WHERE class_id IN (SELECT class_id FROM kids)),
  (SELECT count(*) || ':' || COALESCE(max(updated_at)::text, '') FROM homework WHERE class_id IN (SELECT class_id FROM kids)),
  (SELECT count(*) || ':' || COALESCE(max(updated_at)::text, '') FROM exam_schedules WHERE class_id IN (SELECT class_id FROM kids)),
  (SELECT count(*) || ':' || COALESCE(max(updated_at)::text, '') FROM learning_resources WHERE class_id IN (SELECT class_id FROM kids)),
  (SELECT count(*) || ':' || COALESCE(max(updated_at)::text, '') FROM online_classes WHERE class_id IN (SELECT class_id FROM kids)),
  (SELECT count(*) || ':' || COALESCE(max(updated_at)::text, '') FROM exams),
  (SELECT count(*) || ':' || COALESCE(max(updated_at)::text, '') FROM notices),
  (SELECT count(*) || ':' || COALESCE(max(updated_at)::text, '') FROM academic_events),
  (SELECT md5(COALESCE(string_agg(i::text, ''), '')) FROM institute_profile i),
  (SELECT md5(COALESCE(string_agg(x::text, ''), '')) FROM system_settings x)
)) AS version`;

router.get("/guardian/sync-state", asyncHandler(async (req, res) => {
  const gid = requireGuardian(req);
  const { version } = (await query(SYNC_STATE_SQL, [gid])).rows[0];
  res.json({ success: true, data: { version } });
}));

router.get("/guardian/notifications/unread-count", asyncHandler(async (req, res) => {
  const gid = requireGuardian(req);
  const n = (await query("SELECT COUNT(*)::int AS n FROM message_logs WHERE recipient_type = 'Guardian' AND recipient_id = $1 AND channel = 'Portal' AND read_at IS NULL", [gid])).rows[0].n;
  res.json({ success: true, data: { unread: n } });
}));

router.post("/guardian/notifications/read", asyncHandler(async (req, res) => {
  const gid = requireGuardian(req);
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(String) : null;
  await query(
    `UPDATE message_logs SET read_at = NOW(), status = 'Read' WHERE recipient_type = 'Guardian' AND recipient_id = $1 AND channel = 'Portal'
       AND read_at IS NULL AND ($2::text[] IS NULL OR id::text = ANY($2))`,
    [gid, ids],
  );
  res.json({ success: true });
}));

// ---------------------------------------------------------------- Guardian profile & support
async function schoolContact() {
  const p = (await query(
    "SELECT name, name_bn, address, phone, email, website, logo_url, brand_color, accent_color, principal_name, principal_title, emergency_contact, motto FROM institute_profile WHERE id = 1",
  )).rows[0];
  return p || {};
}

router.get("/guardian/profile", asyncHandler(async (req, res) => {
  const gid = requireGuardian(req);
  const guardian = (await query(
    `SELECT g.id, g.name, g.name_bn, g.relation_default, g.mobile, g.alt_mobile, g.email, g.occupation, g.address, g.emergency_contact,
            g.photo_url, g.status, g.notification_prefs, u.email AS login_email, u.last_login_at
     FROM guardians g LEFT JOIN users u ON u.id = g.user_id WHERE g.id = $1`,
    [gid],
  )).rows[0];
  if (!guardian) throw httpError(404, "Guardian profile not found.");
  const children = (await query(
    `SELECT s.id, s.name, s.class_name, s.section, s.roll, s.photo_url, gs.relation, gs.is_primary
     FROM guardian_students gs JOIN students s ON s.id = gs.student_id
     WHERE gs.guardian_id = $1 AND gs.access_status = 'Enabled' AND s.status NOT IN ('Archived', 'Transferred', 'Dropped', 'Passed Out', 'Inactive') ORDER BY s.name`,
    [gid],
  )).rows;
  // Multiple guardian contacts: the other guardians (e.g. mother/father) of the same children.
  const otherGuardians = (await query(
    `SELECT DISTINCT ON (g.id) g.id, g.name, g.relation_default AS relation, g.mobile, g.alt_mobile,
            (SELECT string_agg(s2.name, ', ') FROM guardian_students x JOIN students s2 ON s2.id = x.student_id
              WHERE x.guardian_id = g.id AND x.student_id IN (SELECT student_id FROM guardian_students WHERE guardian_id = $1)) AS children
     FROM guardian_students mine JOIN guardian_students other ON other.student_id = mine.student_id AND other.guardian_id <> mine.guardian_id
     JOIN guardians g ON g.id = other.guardian_id
     WHERE mine.guardian_id = $1 AND g.status = 'Active'`,
    [gid],
  )).rows;
  res.json({ success: true, data: keysToCamel({ guardian, children, otherGuardians, school: await schoolContact() }) });
}));

// Guardians may update their own contact and address details. Login email and the registered
// mobile number are identity fields: only the school changes them (with verification).
router.patch("/guardian/profile", asyncHandler(async (req, res) => {
  const gid = requireGuardian(req);
  const b = req.body || {};
  const fields = { alt_mobile: b.altMobile, occupation: b.occupation, address: b.address, emergency_contact: b.emergencyContact, name_bn: b.nameBn };
  if (b.altMobile && !/^01[3-9]\d{8}$/.test(String(b.altMobile).replace(/\D/g, ""))) throw httpError(422, "Enter a valid alternate mobile number.");
  if (b.notificationPrefs !== undefined && (typeof b.notificationPrefs !== "object" || Array.isArray(b.notificationPrefs))) {
    throw httpError(422, "Notification preferences must be an object.");
  }
  const sets = [];
  const values = [];
  for (const [col, val] of Object.entries(fields)) {
    if (val === undefined) continue;
    values.push(val === "" ? null : String(val).slice(0, 500));
    sets.push(`${col} = $${values.length}`);
  }
  if (b.notificationPrefs !== undefined) {
    const allowed = ["sms", "email", "push", "attendance", "exam", "result", "fee", "homework", "transport", "notice"];
    const prefs = Object.fromEntries(Object.entries(b.notificationPrefs).filter(([k, v]) => allowed.includes(k) && typeof v === "boolean"));
    values.push(JSON.stringify(prefs));
    sets.push(`notification_prefs = notification_prefs || $${values.length}::jsonb`);
  }
  if (!sets.length) throw httpError(422, "Nothing to update.");
  values.push(gid);
  const row = (await query(
    `UPDATE guardians SET ${sets.join(", ")} WHERE id = $${values.length}
     RETURNING id, name, name_bn, relation_default, mobile, alt_mobile, email, occupation, address, emergency_contact, notification_prefs`,
    values,
  )).rows[0];
  res.json({ success: true, data: keysToCamel(row) });
}));

router.get("/guardian/school", asyncHandler(async (req, res) => {
  requireGuardian(req);
  res.json({ success: true, data: keysToCamel(await schoolContact()) });
}));

router.get("/guardian/students/:id/profile", asyncHandler(async (req, res) => {
  const gid = requireGuardian(req);
  const link = await assertLinked(gid, req.params.id);
  const s = (await query(
    `SELECT s.id, s.name, s.name_bn, s.roll, s.gender, s.class_name, s.class_id, s.section, s.shift, s.group_name, s.version, s.photo_url,
            s.date_of_birth, s.admission_date, s.blood_group, s.religion, s.nationality, s.address, s.status, s.previous_school,
            s.allergies, s.special_needs, s.medical_notes, ay.name AS session_name,
            t.id AS class_teacher_id, t.name AS class_teacher, t.phone AS class_teacher_phone, t.email AS class_teacher_email, t.photo_url AS class_teacher_photo
     FROM students s LEFT JOIN classes c ON c.id = s.class_id LEFT JOIN teachers t ON t.id = c.teacher_id
     LEFT JOIN academic_years ay ON ay.id = s.academic_year_id WHERE s.id = $1`,
    [req.params.id],
  )).rows[0];
  if (!s) throw httpError(404, "Student not found.");
  const guardians = (await query(
    `SELECT g.id, g.name, g.mobile, g.alt_mobile, g.emergency_contact, gs.relation, gs.is_primary FROM guardian_students gs
     JOIN guardians g ON g.id = gs.guardian_id WHERE gs.student_id = $1 ORDER BY gs.is_primary DESC, g.name`,
    [req.params.id],
  )).rows;
  if (!(await guardianVisibility()).showTeacherPhone) s.class_teacher_phone = null;
  const primary = guardians.find((g) => g.is_primary) || guardians[0];
  res.json({
    success: true,
    data: keysToCamel({
      ...s,
      relation: link.relation,
      canViewResults: link.can_view_results,
      canViewFees: link.can_view_fees,
      guardians,
      emergencyContact: primary ? { name: primary.name, relation: primary.relation, mobile: primary.emergency_contact || primary.mobile } : null,
    }),
  });
}));

router.get("/guardian/students/:id/documents", asyncHandler(async (req, res) => {
  const gid = requireGuardian(req);
  await assertLinked(gid, req.params.id);
  const [docs, certs] = await Promise.all([
    query(
      "SELECT id, document_type, file_name, file_url, mime_type, size_bytes, created_at FROM student_documents WHERE owner_type = 'Student' AND owner_id = $1 ORDER BY created_at DESC",
      [req.params.id],
    ),
    query(
      "SELECT id, certificate_type, status, created_at, issued_at FROM certificates WHERE holder_type = 'Student' AND holder_id = $1 AND status = 'Issued' ORDER BY created_at DESC",
      [req.params.id],
    ).catch(() => ({ rows: [] })),
  ]);
  res.json({ success: true, data: keysToCamel({ documents: docs.rows, certificates: certs.rows }) });
}));

// Streams one of the student's documents. Private uploads normally need staff permissions;
// here access is granted only through the guardian–student link.
router.get("/guardian/students/:id/documents/:docId/file", asyncHandler(async (req, res) => {
  const gid = requireGuardian(req);
  await assertLinked(gid, req.params.id);
  const doc = (await query(
    "SELECT file_url, file_name, mime_type FROM student_documents WHERE id::text = $1 AND owner_type = 'Student' AND owner_id = $2",
    [req.params.docId, req.params.id],
  )).rows[0];
  if (!doc) throw httpError(404, "Document not found.");
  const path = require("node:path");
  const fs = require("node:fs/promises");
  const env = require("../config/env");
  const name = path.basename(String(doc.file_url || "").split("?")[0]);
  const isPrivate = String(doc.file_url || "").includes("/private/");
  const file = path.resolve(env.uploadDir, isPrivate ? "private" : "public", name);
  try { await fs.access(file); } catch { throw httpError(404, "File not found on the server."); }
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", "private, no-store");
  if (doc.file_name) res.attachment(doc.file_name);
  res.sendFile(file);
}));

// Live bus position for one child (auto-refreshed by the app every few seconds).
router.get("/guardian/students/:id/bus-location", asyncHandler(async (req, res) => {
  const gid = requireGuardian(req);
  await assertLinked(gid, req.params.id);
  const row = (await query(
    `SELECT v.registration_no, vl.latitude, vl.longitude, vl.speed, vl.heading, vl.recorded_at
     FROM transport_assignments ta JOIN transport_routes r ON r.id = ta.route_id JOIN transport_vehicles v ON v.id = r.vehicle_id
     LEFT JOIN LATERAL (SELECT * FROM vehicle_locations x WHERE x.vehicle_id = v.id ORDER BY x.recorded_at DESC LIMIT 1) vl ON TRUE
     WHERE ta.student_id = $1 AND ta.status = 'Active' LIMIT 1`,
    [req.params.id],
  )).rows[0];
  res.json({ success: true, data: row && row.latitude !== null ? keysToCamel(row) : null });
}));

router.get("/guardian/leave-types", asyncHandler(async (req, res) => {
  requireGuardian(req);
  const rows = (await query("SELECT id, name, days_per_year FROM leave_types WHERE status = 'Active' AND applies_to IN ('Student','All') ORDER BY name")).rows;
  res.json({ success: true, data: keysToCamel(rows) });
}));

// Guardian actions on a leave application: withdraw it, or answer the school's clarification request.
async function guardianLeaveApproval(req) {
  const gid = requireGuardian(req);
  const leave = (await query("SELECT * FROM leave_requests WHERE id = $1 AND applicant_type = 'Student'", [req.params.id])).rows[0];
  if (!leave) throw httpError(404, "Leave application not found.");
  await assertLinked(gid, leave.applicant_id);
  const approval = (await query(
    "SELECT id FROM approval_requests WHERE request_type = 'leave' AND reference_id = $1 ORDER BY created_at DESC LIMIT 1", [leave.id],
  )).rows[0];
  if (!approval) throw httpError(409, "This application has no open approval.");
  return approval.id;
}

router.post("/guardian/leaves/:id/withdraw", asyncHandler(async (req, res) => {
  const updated = await cancelApproval(req, await guardianLeaveApproval(req), req.body?.note);
  res.json({ success: true, data: keysToCamel(updated) });
}));

router.post("/guardian/leaves/:id/respond", asyncHandler(async (req, res) => {
  const updated = await resubmitApproval(req, await guardianLeaveApproval(req), req.body?.note);
  res.json({ success: true, data: keysToCamel(updated) });
}));

router.post("/guardian/complaints", asyncHandler(async (req, res) => {
  const gid = requireGuardian(req);
  const { studentId, category, subject, description } = req.body || {};
  if (!String(subject || "").trim()) throw httpError(422, "Subject is required.");
  if (studentId) await assertLinked(gid, studentId);
  const row = (await query(
    "INSERT INTO complaints (guardian_id, student_id, category, subject, description) VALUES ($1,$2,$3,$4,$5) RETURNING *",
    [gid, studentId || null, category || "General", subject, description || null],
  )).rows[0];
  res.status(201).json({ success: true, data: keysToCamel(row) });
}));

router.get("/guardian/complaints", asyncHandler(async (req, res) => {
  const gid = requireGuardian(req);
  const rows = (await query("SELECT * FROM complaints WHERE guardian_id = $1 ORDER BY created_at DESC", [gid])).rows;
  res.json({ success: true, data: keysToCamel(rows) });
}));

router.get("/guardian/ptm-slots", asyncHandler(async (req, res) => {
  const gid = requireGuardian(req);
  const rows = (await query(
    `SELECT p.*, t.name AS teacher_name FROM ptm_slots p JOIN teachers t ON t.id = p.teacher_id
     WHERE p.slot_date >= CURRENT_DATE AND (p.status = 'Available' OR p.guardian_id = $1) ORDER BY p.slot_date, p.start_time`,
    [gid],
  )).rows;
  res.json({ success: true, data: keysToCamel(rows) });
}));

router.post("/guardian/ptm-slots/:id/book", asyncHandler(async (req, res) => {
  const gid = requireGuardian(req);
  const { studentId } = req.body || {};
  await assertLinked(gid, studentId);
  const row = (await query(
    "UPDATE ptm_slots SET status = 'Booked', guardian_id = $1, student_id = $2 WHERE id::text = $3 AND status = 'Available' RETURNING *",
    [gid, studentId, req.params.id],
  )).rows[0];
  if (!row) throw httpError(409, "This slot is no longer available.");
  res.json({ success: true, data: keysToCamel(row) });
}));

// ---------------------------------------------------------------- Teacher portal (TA-01..08)
router.get("/teacher/today", asyncHandler(async (req, res) => {
  if (req.user.linkedType !== "Teacher" || !req.user.linkedId) throw httpError(403, "Your login is not linked to a teacher profile.");
  const tid = req.user.linkedId;
  const today = new Date();
  const day = DAYS[localWeekday(today)];
  const date = localDate(today);
  const [teacher, routine, assignments, classTeacherOf, marks, homework, attendanceToday, leaves] = await Promise.all([
    query("SELECT id, name, designation, department, photo_url, phone, email FROM teachers WHERE id = $1", [tid]),
    query(`SELECT r.*, c.name AS class_name, sub.name AS subject_name FROM routine_entries r JOIN classes c ON c.id = r.class_id
           LEFT JOIN subjects sub ON sub.id = r.subject_id WHERE r.teacher_id = $1 AND r.day_of_week = $2 ORDER BY r.start_time NULLS LAST, r.period_code`, [tid, day]),
    query(`SELECT ca.*, c.name AS class_name, sub.name AS subject_name FROM class_assignments ca JOIN classes c ON c.id = ca.class_id
           JOIN subjects sub ON sub.id = ca.subject_id WHERE ca.teacher_id = $1 ORDER BY c.sort_order, c.name`, [tid]),
    query("SELECT id, name, sections FROM classes WHERE teacher_id = $1", [tid]),
    query(`SELECT mes.*, e.name AS exam_name, c.name AS class_name, sub.name AS subject_name, e.marks_entry_end
           FROM marks_entry_status mes JOIN exams e ON e.id = mes.exam_id JOIN classes c ON c.id = mes.class_id JOIN subjects sub ON sub.id = mes.subject_id
           WHERE mes.status = 'Open' AND EXISTS (SELECT 1 FROM class_assignments ca WHERE ca.teacher_id = $1 AND ca.class_id = mes.class_id AND ca.subject_id = mes.subject_id)`, [tid]),
    query("SELECT * FROM homework WHERE teacher_id = $1 ORDER BY created_at DESC LIMIT 10", [tid]),
    query("SELECT DISTINCT class_name FROM attendance WHERE attendance_date = $1", [date]),
    query("SELECT * FROM leave_requests WHERE applicant_type = 'Teacher' AND applicant_id = $1 ORDER BY created_at DESC LIMIT 10", [tid]),
  ]);
  const taken = new Set(attendanceToday.rows.map((r) => String(r.class_name).toLowerCase()));
  const attendancePending = [];
  for (const c of classTeacherOf.rows) {
    const sections = Array.isArray(c.sections) && c.sections.length ? c.sections : [null];
    for (const s of sections) {
      const name = s ? `${c.name}-${s}` : c.name;
      if (!taken.has(name.toLowerCase())) attendancePending.push({ classId: c.id, className: name, section: s });
    }
  }
  const ownAttendance = (await query(
    "SELECT attendance_date, status, in_time, out_time FROM staff_attendance WHERE employee_type = 'Teacher' AND employee_id = $1 AND attendance_date > CURRENT_DATE - 31 ORDER BY attendance_date DESC",
    [tid],
  )).rows;
  const payslips = (await query("SELECT id, payroll_month, net_pay, status FROM payroll_records WHERE employee_type = 'Teacher' AND employee_id = $1 ORDER BY payroll_month DESC LIMIT 12", [tid])).rows;
  res.json({
    success: true,
    data: keysToCamel({
      teacher: teacher.rows[0], day, routine: routine.rows, assignments: assignments.rows, classTeacherOf: classTeacherOf.rows,
      attendancePending, marksPending: marks.rows, homework: homework.rows, leaves: leaves.rows, ownAttendance, payslips,
    }),
  });
}));

router.get("/notifications", asyncHandler(async (req, res) => {
  const rows = (await query(
    `SELECT id, event_type, subject, body, created_at, read_at, related_type, related_id FROM message_logs
     WHERE channel = 'Portal' AND ((recipient_type = 'User' AND recipient_id = $1) OR (recipient_type = $2 AND recipient_id = $3))
     ORDER BY created_at DESC LIMIT 50`,
    [req.user.id, req.user.linkedType || "-", req.user.linkedId || "-"],
  )).rows;
  res.json({ success: true, data: keysToCamel(rows) });
}));

module.exports = router;
