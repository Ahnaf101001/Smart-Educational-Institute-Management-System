const express = require("express");
const { query } = require("../db/pool");
const asyncHandler = require("../utils/asyncHandler");
const httpError = require("../utils/httpError");
const { keysToCamel } = require("../utils/case");
const { localDate, localMonth, localWeekday } = require("../utils/dates");

const router = express.Router();
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function requireGuardian(req) {
  if (req.user.linkedType !== "Guardian" || !req.user.linkedId) throw httpError(403, "Guardian portal access only.");
  return req.user.linkedId;
}

// Data isolation: a guardian only sees linked, enabled students (GD-05, GA-02, GDX-01).
async function assertLinked(guardianId, studentId) {
  const r = await query(
    "SELECT 1 FROM guardian_students gs JOIN guardians g ON g.id = gs.guardian_id WHERE gs.guardian_id = $1 AND gs.student_id = $2 AND gs.access_status = 'Enabled' AND g.portal_access",
    [guardianId, studentId],
  );
  if (!r.rowCount) throw httpError(403, "This student is not linked to your account.");
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
  const children = (await query(
    `SELECT s.id, s.name, s.name_bn, s.photo_url, s.class_name, s.section, s.roll, s.shift, s.class_id, gs.relation,
            c.teacher_id, t.name AS class_teacher, t.phone AS class_teacher_phone,
            (SELECT status FROM attendance a WHERE a.student_id = s.id AND a.attendance_date = $2) AS today_attendance,
            (SELECT COALESCE(SUM(amount + late_fine - discount - paid_amount),0) FROM fee_invoices i WHERE i.student_id = s.id AND i.status NOT IN ('Paid','Cancelled')) AS fee_due,
            (SELECT COUNT(*)::int FROM homework h WHERE h.class_id = s.class_id AND (h.section IS NULL OR h.section = s.section) AND h.due_date >= $2) AS homework_count,
            (SELECT json_build_object('name', e.name, 'date', es.exam_date, 'subject', sub.name) FROM exam_schedules es
               JOIN exams e ON e.id = es.exam_id JOIN subjects sub ON sub.id = es.subject_id
               WHERE es.class_id = s.class_id AND es.exam_date >= $2 ORDER BY es.exam_date LIMIT 1) AS next_exam
     FROM guardian_students gs JOIN students s ON s.id = gs.student_id
     LEFT JOIN classes c ON c.id = s.class_id LEFT JOIN teachers t ON t.id = c.teacher_id
     WHERE gs.guardian_id = $1 AND gs.access_status = 'Enabled' AND s.status <> 'Archived' ORDER BY s.name`,
    [gid, today],
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
  res.json({ success: true, data: keysToCamel({ guardian, children, notices, unreadNotifications: unread, totalDue: children.reduce((s, c) => s + Number(c.fee_due), 0) }) });
}));

router.get("/guardian/students/:id/attendance", asyncHandler(async (req, res) => {
  const gid = requireGuardian(req);
  await assertLinked(gid, req.params.id);
  const month = req.query.month || localMonth();
  const rows = (await query(
    "SELECT attendance_date, status, in_time, out_time FROM attendance WHERE student_id = $1 AND to_char(attendance_date, 'YYYY-MM') = $2 ORDER BY attendance_date",
    [req.params.id, month],
  )).rows;
  const present = rows.filter((r) => ["Present", "Late"].includes(r.status)).length;
  res.json({ success: true, data: keysToCamel({ month, records: rows, percentage: rows.length ? Math.round((present / rows.length) * 1000) / 10 : null }) });
}));

router.get("/guardian/students/:id/results", asyncHandler(async (req, res) => {
  const gid = requireGuardian(req);
  await assertLinked(gid, req.params.id);
  if (await hideResultsOnDue(req.params.id)) {
    return res.json({ success: true, data: [], message: "Results are hidden until outstanding fees are cleared." });
  }
  const rows = (await query(
    `SELECT r.*, e.name AS exam_name, e.exam_type FROM results r JOIN exams e ON e.id = r.exam_id
     WHERE r.student_id = $1 AND r.published ORDER BY r.published_at DESC`,
    [req.params.id],
  )).rows;
  res.json({ success: true, data: keysToCamel(rows) });
}));

router.get("/guardian/students/:id/fees", asyncHandler(async (req, res) => {
  const gid = requireGuardian(req);
  await assertLinked(gid, req.params.id);
  const [invoices, payments] = await Promise.all([
    query("SELECT *, GREATEST(amount + late_fine - discount - paid_amount, 0) AS due FROM fee_invoices WHERE student_id = $1 AND status <> 'Cancelled' AND fee_head IS DISTINCT FROM 'Advance Credit' ORDER BY billing_month DESC NULLS LAST", [req.params.id]),
    query("SELECT id, receipt_no, amount, payment_method, paid_at, status FROM fee_payments WHERE student_id = $1 ORDER BY paid_at DESC", [req.params.id]),
  ]);
  const settings = (await query("SELECT payment_gateways FROM system_settings WHERE id = 1")).rows[0];
  res.json({ success: true, data: keysToCamel({ invoices: invoices.rows, payments: payments.rows, gateways: settings?.payment_gateways || {} }) });
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
  res.json({ success: true, data: keysToCamel({ routine: routine.rows, homework: homework.rows, examRoutine: examRoutine.rows, events: events.rows, resources: resources.rows, onlineClasses: online }) });
}));

router.get("/guardian/students/:id/extras", asyncHandler(async (req, res) => {
  const gid = requireGuardian(req);
  await assertLinked(gid, req.params.id);
  const id = req.params.id;
  const [hifz, hifzLogs, salah, transport, library, hostel, leaves, teachers] = await Promise.all([
    query("SELECT COUNT(*) FILTER (WHERE status IN ('Done','Revised'))::int AS done FROM hifz_progress WHERE student_id = $1", [id]),
    query("SELECT h.*, t.name AS ustad_name FROM hifz_logs h LEFT JOIN teachers t ON t.id = h.ustad_id WHERE student_id = $1 ORDER BY log_date DESC LIMIT 7", [id]),
    query(`SELECT attendance_date, wakt, status FROM salah_attendance WHERE student_id = $1 AND attendance_date > CURRENT_DATE - 7 ORDER BY attendance_date, wakt`, [id]),
    query(`SELECT ta.stop_name, r.name AS route_name, r.morning_departure, v.registration_no, v.driver_name, v.driver_phone,
             (SELECT json_build_object('lat', latitude, 'lng', longitude, 'at', recorded_at) FROM vehicle_locations vl WHERE vl.vehicle_id = v.id ORDER BY recorded_at DESC LIMIT 1) AS location
           FROM transport_assignments ta JOIN transport_routes r ON r.id = ta.route_id LEFT JOIN transport_vehicles v ON v.id = r.vehicle_id
           WHERE ta.student_id = $1 AND ta.status = 'Active'`, [id]),
    query("SELECT li.*, b.title FROM library_issues li JOIN library_books b ON b.id = li.book_id WHERE li.borrower_type = 'Student' AND li.borrower_id = $1 ORDER BY li.issue_date DESC LIMIT 10", [id]),
    query("SELECT a.*, r.building, r.room_no FROM hostel_allocations a JOIN hostel_rooms r ON r.id = a.room_id WHERE a.student_id = $1 AND a.status = 'Active'", [id]),
    query("SELECT * FROM leave_requests WHERE applicant_type = 'Student' AND applicant_id = $1 ORDER BY created_at DESC LIMIT 20", [id]),
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
      leaves: leaves.rows, teachers: teachers.rows,
    }),
  });
}));

router.get("/guardian/notifications", asyncHandler(async (req, res) => {
  const gid = requireGuardian(req);
  const rows = (await query(
    "SELECT id, event_type, subject, body, student_id, created_at, read_at FROM message_logs WHERE recipient_type = 'Guardian' AND recipient_id = $1 AND channel = 'Portal' ORDER BY created_at DESC LIMIT 100",
    [gid],
  )).rows;
  await query("UPDATE message_logs SET read_at = NOW(), status = 'Read' WHERE recipient_type = 'Guardian' AND recipient_id = $1 AND channel = 'Portal' AND read_at IS NULL", [gid]);
  res.json({ success: true, data: keysToCamel(rows) });
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
