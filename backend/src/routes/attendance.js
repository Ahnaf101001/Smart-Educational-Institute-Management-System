const express = require("express");
const { z } = require("zod");
const { query, transaction } = require("../db/pool");
const validate = require("../middleware/validate");
const asyncHandler = require("../utils/asyncHandler");
const httpError = require("../utils/httpError");
const { keysToCamel } = require("../utils/case");
const { requirePermission, hasPermission } = require("../middleware/auth");
const { writeAudit } = require("../services/audit");
const { createApproval } = require("../services/approvals");
const { notifyStudentGuardians } = require("../services/notifications");
const { renderTemplate, defaultLanguage } = require("../services/templates");

const router = express.Router();
const STATUS = z.enum(["Present", "Absent", "Late", "Leave"]);
const bulkSchema = z.object({
  className: z.string().min(1),
  date: z.string().date(),
  records: z.array(z.object({ studentId: z.string().min(1), status: STATUS, note: z.string().optional().nullable() })).min(1),
});

function daysBetween(a, b) {
  return Math.floor((new Date(b).setHours(0, 0, 0, 0) - new Date(a).setHours(0, 0, 0, 0)) / 86400000);
}

router.get("/", requirePermission("attendance", "view"), asyncHandler(async (req, res) => {
  const values = [];
  const conditions = [];
  if (req.query.className) { values.push(req.query.className); conditions.push(`a.class_name = $${values.length}`); }
  if (req.query.date) { values.push(req.query.date); conditions.push(`a.attendance_date = $${values.length}`); }
  if (req.query.studentId) { values.push(req.query.studentId); conditions.push(`a.student_id = $${values.length}`); }
  if (req.query.from) { values.push(req.query.from); conditions.push(`a.attendance_date >= $${values.length}`); }
  if (req.query.to) { values.push(req.query.to); conditions.push(`a.attendance_date <= $${values.length}`); }
  const result = await query(
    `SELECT a.*, s.name AS student_name, s.roll FROM attendance a JOIN students s ON s.id = a.student_id
     ${conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""}
     ORDER BY a.attendance_date DESC, s.roll LIMIT 5000`,
    values,
  );
  res.json({ success: true, data: keysToCamel(result.rows) });
}));

// Bulk save with edit window, lock, audit and guardian notification (AT-02..05, AT-12, ATT-03/04).
router.put("/bulk", requirePermission("attendance", "create"), validate(bulkSchema), asyncHandler(async (req, res) => {
  const { className, date, records } = req.body;
  const settings = (await query("SELECT * FROM system_settings WHERE id = 1")).rows[0] || {};
  const age = daysBetween(date, new Date());
  if (age < 0) throw httpError(422, "Attendance cannot be recorded for a future date.");
  const windowDays = Number(settings.attendance_edit_window_days || 0);
  const canOverride = hasPermission(req.user, "attendance", "approve");

  const newlyNotify = [];
  const changed = [];
  await transaction(async (client) => {
    const existing = new Map((await client.query(
      "SELECT * FROM attendance WHERE attendance_date = $1 AND student_id = ANY($2)",
      [date, records.map((r) => r.studentId)],
    )).rows.map((r) => [r.student_id, r]));

    for (const record of records) {
      const prev = existing.get(record.studentId);
      if (prev && prev.status !== record.status) {
        // Within the configured edit window (default: same day) the teacher may edit;
        // afterwards only an approver can change it directly – others must request a correction.
        if (age > windowDays && !canOverride) {
          throw httpError(409, `Attendance for ${date} is closed. Submit a correction request for approval.`);
        }
        changed.push({ studentId: record.studentId, from: prev.status, to: record.status });
      }
      await client.query(
        `INSERT INTO attendance (student_id, class_name, attendance_date, status, note, marked_by, source, locked)
         VALUES ($1, $2, $3, $4, $5, $6, 'Manual', TRUE)
         ON CONFLICT (student_id, attendance_date)
         DO UPDATE SET class_name = EXCLUDED.class_name, status = EXCLUDED.status, note = EXCLUDED.note,
                       marked_by = EXCLUDED.marked_by, locked = TRUE`,
        [record.studentId, className, date, record.status, record.note || null, req.user.id],
      );
      if (["Absent", "Late"].includes(record.status) && (!prev || prev.status !== record.status) && age === 0) {
        newlyNotify.push(record);
      }
    }
    await writeAudit(req, {
      entity: "attendance", entityId: `${className}:${date}`, action: existing.size ? "UPDATE" : "SUBMIT",
      oldValue: changed.length ? changed.map((c) => ({ studentId: c.studentId, status: c.from })) : undefined,
      newValue: { count: records.length, changed: changed.length },
    }, client);
  });

  // Guardian notifications (AT-05): queued, delivered by the background worker.
  let notified = 0;
  if (newlyNotify.length) {
    const lang = await defaultLanguage();
    const names = new Map((await query("SELECT id, name FROM students WHERE id = ANY($1)", [newlyNotify.map((r) => r.studentId)])).rows.map((s) => [s.id, s.name]));
    for (const r of newlyNotify) {
      if (r.status === "Absent" && settings.notify_absent === false) continue;
      if (r.status === "Late" && settings.notify_late === false) continue;
      const body = await renderTemplate(r.status === "Absent" ? "absent" : "late", lang, { student: names.get(r.studentId), date });
      notified += await notifyStudentGuardians(r.studentId, { eventType: r.status, body, subject: `${r.status} alert`, relatedType: "attendance" });
      await query("UPDATE attendance SET notified_at = NOW() WHERE student_id = $1 AND attendance_date = $2", [r.studentId, date]);
    }
  }
  res.json({ success: true, message: "Attendance saved successfully.", data: { saved: records.length, notificationsQueued: notified, corrected: changed.length } });
}));

// Correction request for closed attendance (AT-04, AT-12, scenario "wrong student/date").
router.post("/corrections", requirePermission("attendance", "create"), asyncHandler(async (req, res) => {
  const { studentId, date, newStatus, reason, className } = req.body || {};
  if (!studentId || !date || !newStatus || !String(reason || "").trim()) throw httpError(422, "studentId, date, newStatus and reason are required.");
  STATUS.parse(newStatus);
  const prev = (await query("SELECT status, class_name FROM attendance WHERE student_id = $1 AND attendance_date = $2", [studentId, date])).rows[0];
  const approval = await createApproval(req, {
    type: "attendance_correction",
    title: `Attendance ${studentId} on ${date}: ${prev?.status || "None"} → ${newStatus}`,
    referenceTable: "attendance", referenceId: `${studentId}:${date}`,
    payload: { studentId, date, newStatus, oldStatus: prev?.status || null, reason, className: className || prev?.class_name },
  });
  res.status(201).json({ success: true, data: keysToCamel(approval) });
}));

router.get("/summary", requirePermission("attendance", "view"), asyncHandler(async (req, res) => {
  const className = req.query.className || null;
  const from = req.query.from || `${new Date().toISOString().slice(0, 8)}01`;
  const to = req.query.to || new Date().toISOString().slice(0, 10);
  const result = await query(
    `SELECT attendance_date, COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE status = 'Present')::int AS present,
            COUNT(*) FILTER (WHERE status = 'Absent')::int AS absent,
            COUNT(*) FILTER (WHERE status = 'Late')::int AS late,
            COUNT(*) FILTER (WHERE status = 'Leave')::int AS leave,
            ROUND(100.0 * COUNT(*) FILTER (WHERE status IN ('Present', 'Late')) / NULLIF(COUNT(*), 0), 2) AS attendance_rate
     FROM attendance WHERE attendance_date BETWEEN $1 AND $2 AND ($3::text IS NULL OR class_name = $3)
     GROUP BY attendance_date ORDER BY attendance_date`,
    [from, to, className],
  );
  res.json({ success: true, data: keysToCamel(result.rows) });
}));

// Monthly register (AT-08): student x day matrix with percentage.
router.get("/report/monthly", requirePermission("attendance", "view"), asyncHandler(async (req, res) => {
  const month = req.query.month || new Date().toISOString().slice(0, 7);
  const from = `${month}-01`;
  const to = new Date(new Date(from).getFullYear(), new Date(from).getMonth() + 1, 0).toISOString().slice(0, 10);
  const className = req.query.className;
  if (!className) throw httpError(422, "className is required.");
  const students = (await query(
    "SELECT id, name, roll FROM students WHERE class_name = $1 AND status = 'Active' ORDER BY NULLIF(regexp_replace(roll, '\\D', '', 'g'), '')::int NULLS LAST, name",
    [className],
  )).rows;
  const rows = (await query(
    "SELECT student_id, attendance_date, status FROM attendance WHERE class_name = $1 AND attendance_date BETWEEN $2 AND $3",
    [className, from, to],
  )).rows;
  const map = new Map();
  for (const r of rows) {
    const day = new Date(r.attendance_date).getDate();
    if (!map.has(r.student_id)) map.set(r.student_id, {});
    map.get(r.student_id)[day] = r.status;
  }
  const data = students.map((s) => {
    const days = map.get(s.id) || {};
    const values = Object.values(days);
    const present = values.filter((v) => v === "Present" || v === "Late").length;
    return {
      ...s, days,
      present, absent: values.filter((v) => v === "Absent").length, late: values.filter((v) => v === "Late").length,
      leave: values.filter((v) => v === "Leave").length,
      percentage: values.length ? Math.round((present / values.length) * 1000) / 10 : null,
    };
  });
  res.json({ success: true, data: keysToCamel({ month, from, to, daysInMonth: new Date(to).getDate(), students: data }) });
}));

router.get("/report/classwise", requirePermission("attendance", "view"), asyncHandler(async (req, res) => {
  const from = req.query.from || new Date().toISOString().slice(0, 10);
  const to = req.query.to || from;
  const rows = (await query(
    `SELECT class_name, COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE status IN ('Present','Late'))::int AS present,
            COUNT(*) FILTER (WHERE status = 'Absent')::int AS absent,
            COUNT(*) FILTER (WHERE status = 'Late')::int AS late,
            ROUND(100.0 * COUNT(*) FILTER (WHERE status IN ('Present','Late')) / NULLIF(COUNT(*),0), 1) AS percentage
     FROM attendance WHERE attendance_date BETWEEN $1 AND $2 GROUP BY class_name ORDER BY class_name`,
    [from, to],
  )).rows;
  res.json({ success: true, data: keysToCamel(rows) });
}));

router.get("/report/student/:id", requirePermission("attendance", "view"), asyncHandler(async (req, res) => {
  const from = req.query.from || `${new Date().getFullYear()}-01-01`;
  const to = req.query.to || new Date().toISOString().slice(0, 10);
  const rows = (await query(
    "SELECT attendance_date, status, note, source, in_time, out_time FROM attendance WHERE student_id = $1 AND attendance_date BETWEEN $2 AND $3 ORDER BY attendance_date",
    [req.params.id, from, to],
  )).rows;
  const present = rows.filter((r) => ["Present", "Late"].includes(r.status)).length;
  res.json({ success: true, data: keysToCamel({ records: rows, total: rows.length, present, percentage: rows.length ? Math.round((present / rows.length) * 1000) / 10 : 0 }) });
}));

// Late arrival & absence tracking for a date (feature list).
router.get("/report/late-absent", requirePermission("attendance", "view"), asyncHandler(async (req, res) => {
  const date = req.query.date || new Date().toISOString().slice(0, 10);
  const rows = (await query(
    `SELECT a.*, s.name AS student_name, s.roll, s.parent_contact FROM attendance a JOIN students s ON s.id = a.student_id
     WHERE a.attendance_date = $1 AND a.status IN ('Absent','Late') ORDER BY a.class_name, a.status, s.roll`,
    [date],
  )).rows;
  res.json({ success: true, data: keysToCamel(rows) });
}));

// Consecutive absence alert list (AT-07).
router.get("/alerts/consecutive", requirePermission("attendance", "view"), asyncHandler(async (req, res) => {
  const settings = (await query("SELECT consecutive_absence_threshold FROM system_settings WHERE id = 1")).rows[0] || {};
  const threshold = Number(req.query.threshold || settings.consecutive_absence_threshold || 3);
  const rows = (await query(
    `WITH recent AS (
       SELECT student_id, attendance_date, status,
              ROW_NUMBER() OVER (PARTITION BY student_id ORDER BY attendance_date DESC) AS rn
       FROM attendance WHERE attendance_date >= CURRENT_DATE - INTERVAL '30 days')
     SELECT r.student_id, s.name, s.class_name, s.parent_contact, COUNT(*)::int AS streak
     FROM recent r JOIN students s ON s.id = r.student_id
     WHERE r.rn <= $1 AND r.status = 'Absent'
     GROUP BY r.student_id, s.name, s.class_name, s.parent_contact HAVING COUNT(*) >= $1`,
    [threshold],
  )).rows;
  res.json({ success: true, data: keysToCamel({ threshold, students: rows }) });
}));

// ---------------------------------------------------------------- staff attendance
router.put("/staff/bulk", requirePermission("staff_attendance", "create"), asyncHandler(async (req, res) => {
  const { date, records = [] } = req.body || {};
  if (!date || !records.length) throw httpError(422, "date and records are required.");
  await transaction(async (client) => {
    for (const r of records) {
      await client.query(
        `INSERT INTO staff_attendance (employee_type, employee_id, employee_name, attendance_date, status, in_time, out_time, early_leave, note, marked_by, source)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'Manual')
         ON CONFLICT (employee_type, employee_id, attendance_date) DO UPDATE SET status = EXCLUDED.status,
           in_time = COALESCE(EXCLUDED.in_time, staff_attendance.in_time), out_time = COALESCE(EXCLUDED.out_time, staff_attendance.out_time),
           early_leave = EXCLUDED.early_leave, note = EXCLUDED.note, marked_by = EXCLUDED.marked_by`,
        [r.employeeType, r.employeeId, r.employeeName || null, date, r.status, r.inTime ? `${date} ${r.inTime}` : null,
          r.outTime ? `${date} ${r.outTime}` : null, Boolean(r.earlyLeave), r.note || null, req.user.id],
      );
    }
    await writeAudit(req, { entity: "staff_attendance", entityId: date, action: "SUBMIT", newValue: { count: records.length } }, client);
  });
  res.json({ success: true });
}));

router.get("/staff", requirePermission("staff_attendance", "view"), asyncHandler(async (req, res) => {
  const date = req.query.date || new Date().toISOString().slice(0, 10);
  const people = (await query(
    `SELECT 'Teacher' AS employee_type, id AS employee_id, name AS employee_name, designation, department FROM teachers WHERE status = 'Active'
     UNION ALL SELECT 'Staff', id, name, designation, department FROM staff WHERE status = 'Active' ORDER BY 1, 3`,
  )).rows;
  const marks = new Map((await query("SELECT * FROM staff_attendance WHERE attendance_date = $1", [date])).rows.map((r) => [`${r.employee_type}:${r.employee_id}`, r]));
  res.json({ success: true, data: keysToCamel(people.map((p) => ({ ...p, record: marks.get(`${p.employee_type}:${p.employee_id}`) || null }))) });
}));

router.get("/staff/report", requirePermission("staff_attendance", "view"), asyncHandler(async (req, res) => {
  const month = req.query.month || new Date().toISOString().slice(0, 7);
  const rows = (await query(
    `SELECT employee_type, employee_id, MAX(employee_name) AS employee_name,
            COUNT(*) FILTER (WHERE status = 'Present')::int AS present,
            COUNT(*) FILTER (WHERE status = 'Late')::int AS late,
            COUNT(*) FILTER (WHERE status = 'Absent')::int AS absent,
            COUNT(*) FILTER (WHERE status = 'Leave')::int AS leave,
            COUNT(*) FILTER (WHERE status = 'Half Day')::int AS half_day,
            COUNT(*) FILTER (WHERE early_leave)::int AS early_leave
     FROM staff_attendance WHERE to_char(attendance_date, 'YYYY-MM') = $1
     GROUP BY employee_type, employee_id ORDER BY employee_type, employee_name`,
    [month],
  )).rows;
  res.json({ success: true, data: keysToCamel(rows) });
}));

// Period-wise attendance (AT-09).
router.put("/period/bulk", requirePermission("attendance", "create"), asyncHandler(async (req, res) => {
  const { date, periodCode, subjectId, records = [] } = req.body || {};
  if (!date || !periodCode || !records.length) throw httpError(422, "date, periodCode and records are required.");
  await transaction(async (client) => {
    for (const r of records) {
      await client.query(
        `INSERT INTO period_attendance (student_id, attendance_date, period_code, subject_id, status, marked_by)
         VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (student_id, attendance_date, period_code)
         DO UPDATE SET status = EXCLUDED.status, subject_id = EXCLUDED.subject_id, marked_by = EXCLUDED.marked_by`,
        [r.studentId, date, periodCode, subjectId || null, r.status, req.user.id],
      );
    }
  });
  res.json({ success: true });
}));

router.get("/period", requirePermission("attendance", "view"), asyncHandler(async (req, res) => {
  const rows = (await query(
    "SELECT * FROM period_attendance WHERE attendance_date = $1 AND ($2::text IS NULL OR period_code = $2)",
    [req.query.date || new Date().toISOString().slice(0, 10), req.query.periodCode || null],
  )).rows;
  res.json({ success: true, data: keysToCamel(rows) });
}));

module.exports = router;
