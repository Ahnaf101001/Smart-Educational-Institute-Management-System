// Endpoints added by the SRS gap audit (migration 007). Mounted at /api/v1/x.
const crypto = require("node:crypto");
const express = require("express");
const { query, transaction } = require("../db/pool");
const asyncHandler = require("../utils/asyncHandler");
const httpError = require("../utils/httpError");
const { keysToCamel } = require("../utils/case");
const { requirePermission, requireAny, hasPermission } = require("../middleware/auth");
const { writeAudit } = require("../services/audit");
const resources = require("../resources");
const { localDate, localMonth, localDay, localMinutes } = require("../utils/dates");

const router = express.Router();

const csvCell = (v) => {
  const t = v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
  return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};
const toCsv = (columns, rows) => [columns.map((c) => csvCell(c.label)).join(","), ...rows.map((r) => columns.map((c) => csvCell(r[c.key])).join(","))].join("\n");
function sendCsv(res, filename, columns, rows) {
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(`﻿${toCsv(columns, rows)}`);
}
const xmlEscape = (v) => String(v ?? "").replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c]));

// Guardian may act only for linked children; staff need the given permission.
async function assertStudentAccess(req, studentId, module = "students", action = "view") {
  if (req.user.linkedType === "Guardian") {
    const ok = await query(
      "SELECT 1 FROM guardian_students WHERE guardian_id = $1 AND student_id = $2 AND access_status = 'Enabled'",
      [req.user.linkedId, studentId],
    );
    if (!ok.rowCount) throw httpError(403, "This student is not linked to your account.");
    return;
  }
  if (req.user.linkedType === "Student") {
    if (req.user.linkedId !== studentId) throw httpError(403, "You can only access your own records.");
    return;
  }
  if (!hasPermission(req.user, module, action)) throw httpError(403, `You do not have '${action}' permission for ${module}.`);
}

// ======================================================================= branches (PC-12, PC-13)
router.get("/branches/summary", requirePermission("dashboard", "view"), asyncHandler(async (req, res) => {
  const month = localMonth();
  const rows = (await query(
    `SELECT b.id, b.name, b.code, b.is_main,
       (SELECT COUNT(*)::int FROM students s WHERE s.branch_id = b.id AND s.status = 'Active') AS students,
       (SELECT COUNT(*)::int FROM teachers t WHERE t.branch_id = b.id AND t.status = 'Active')
         + (SELECT COUNT(*)::int FROM staff st WHERE st.branch_id = b.id AND st.status = 'Active') AS staff,
       (SELECT COALESCE(SUM(p.amount), 0) FROM fee_payments p JOIN students s ON s.id = p.student_id
          WHERE s.branch_id = b.id AND to_char(p.paid_at, 'YYYY-MM') = $1 AND COALESCE(p.status, 'Completed') <> 'Cancelled') AS income_month,
       (SELECT COALESCE(SUM(i.amount + COALESCE(i.late_fine, 0) - i.discount - i.paid_amount), 0) FROM fee_invoices i JOIN students s ON s.id = i.student_id
          WHERE s.branch_id = b.id AND i.status NOT IN ('Paid', 'Cancelled')) AS due,
       (SELECT ROUND(100.0 * COUNT(*) FILTER (WHERE a.status IN ('Present', 'Late')) / NULLIF(COUNT(*), 0), 1)
          FROM attendance a JOIN students s ON s.id = a.student_id
          WHERE s.branch_id = b.id AND a.attendance_date > CURRENT_DATE - 30) AS attendance_pct,
       (SELECT ROUND(AVG(r.gpa), 2) FROM results r JOIN students s ON s.id = r.student_id WHERE s.branch_id = b.id AND r.published) AS avg_gpa
     FROM branches b WHERE b.status IS DISTINCT FROM 'Inactive' ORDER BY b.is_main DESC, b.name`,
    [month],
  )).rows;
  const unassigned = (await query("SELECT COUNT(*)::int AS n FROM students WHERE branch_id IS NULL AND status = 'Active'")).rows[0].n;
  res.json({ success: true, data: { branches: keysToCamel(rows), unassignedStudents: unassigned } });
}));

router.post("/branch-transfers", requirePermission("branches", "edit"), asyncHandler(async (req, res) => {
  const { personType, personId, toBranchId, effectiveDate, reason } = req.body || {};
  const table = { Student: "students", Teacher: "teachers", Staff: "staff" }[personType];
  if (!table || !personId || !toBranchId) throw httpError(422, "Person type, person and destination branch are required.");
  const out = await transaction(async (client) => {
    const person = (await client.query(`SELECT id, branch_id FROM ${table} WHERE id = $1 FOR UPDATE`, [personId])).rows[0];
    if (!person) throw httpError(404, `${personType} not found.`);
    if (!(await client.query("SELECT 1 FROM branches WHERE id = $1", [toBranchId])).rowCount) throw httpError(404, "Branch not found.");
    if (person.branch_id === toBranchId) throw httpError(409, "Already in this branch.");
    await client.query(`UPDATE ${table} SET branch_id = $1 WHERE id = $2`, [toBranchId, personId]);
    const row = (await client.query(
      `INSERT INTO branch_transfers (person_type, person_id, from_branch_id, to_branch_id, effective_date, reason, created_by)
       VALUES ($1,$2,$3,$4,COALESCE($5::date, CURRENT_DATE),$6,$7) RETURNING *`,
      [personType, personId, person.branch_id, toBranchId, effectiveDate || null, reason || null, req.user.name],
    )).rows[0];
    await writeAudit(req, { entity: table, entityId: personId, action: "BRANCH_TRANSFER", oldValue: { branchId: person.branch_id }, newValue: { branchId: toBranchId }, reason }, client);
    return row;
  });
  res.status(201).json({ success: true, data: keysToCamel(out) });
}));

// ======================================================================= exam seat plan (v3 EX-03, v1 EX-04)
router.post("/exams/:id/seat-plan", requirePermission("exams", "create"), asyncHandler(async (req, res) => {
  const { rooms = [], mixClasses = true, classIds = [] } = req.body || {};
  const cleanRooms = rooms.map((r) => ({ room: String(r.room || "").trim(), capacity: Number(r.capacity || 0) })).filter((r) => r.room && r.capacity > 0);
  if (!cleanRooms.length) throw httpError(422, "Add at least one room with capacity.");
  const exam = (await query("SELECT * FROM exams WHERE id = $1", [req.params.id])).rows[0];
  if (!exam) throw httpError(404, "Exam not found.");
  const targetClasses = classIds.length ? classIds : (Array.isArray(exam.class_ids) ? exam.class_ids : []);
  const students = (await query(
    `SELECT s.id, s.name, s.class_name, s.class_id, s.roll FROM students s
     WHERE s.status = 'Active' AND ($1::text[] = '{}' OR s.class_id = ANY($1::text[]))
     ORDER BY s.class_name, NULLIF(regexp_replace(COALESCE(s.roll, ''), '\\D', '', 'g'), '')::int NULLS LAST, s.name`,
    [targetClasses.map(String)],
  )).rows;
  const capacity = cleanRooms.reduce((s, r) => s + r.capacity, 0);
  if (students.length > capacity) throw httpError(422, `Not enough seats: ${students.length} students, ${capacity} seats.`);

  // Class mix: interleave classes so neighbours are from different classes.
  let ordered = students;
  if (mixClasses) {
    const groups = {};
    for (const s of students) (groups[s.class_name || "-"] ||= []).push(s);
    const queues = Object.values(groups);
    ordered = [];
    while (queues.some((q) => q.length)) for (const q of queues) if (q.length) ordered.push(q.shift());
  }
  const plan = [];
  let index = 0;
  for (const room of cleanRooms) {
    for (let seat = 1; seat <= room.capacity && index < ordered.length; seat += 1, index += 1) {
      const s = ordered[index];
      plan.push({ room: room.room, seat, student: s });
    }
  }
  await transaction(async (client) => {
    await client.query("DELETE FROM exam_seat_plans WHERE exam_id = $1", [exam.id]);
    for (const p of plan) {
      await client.query(
        "INSERT INTO exam_seat_plans (exam_id, room, seat_no, student_id, student_name, class_name, roll) VALUES ($1,$2,$3,$4,$5,$6,$7)",
        [exam.id, p.room, p.seat, p.student.id, p.student.name, p.student.class_name, p.student.roll],
      );
    }
    await writeAudit(req, { entity: "exam_seat_plans", entityId: exam.id, action: "GENERATE", newValue: { rooms: cleanRooms, students: plan.length } }, client);
  });
  res.status(201).json({ success: true, data: { seated: plan.length, rooms: cleanRooms.length } });
}));

router.get("/exams/:id/seat-plan", requireAny(["exams", "view"], ["exams", "print"]), asyncHandler(async (req, res) => {
  const rows = (await query("SELECT * FROM exam_seat_plans WHERE exam_id = $1 ORDER BY room, seat_no", [req.params.id])).rows;
  const invigilators = (await query(
    `SELECT es.room, es.exam_date, es.start_time, t.name AS invigilator, sub.name AS subject
     FROM exam_schedules es LEFT JOIN teachers t ON t.id = es.invigilator_id LEFT JOIN subjects sub ON sub.id = es.subject_id
     WHERE es.exam_id = $1 ORDER BY es.exam_date, es.start_time`,
    [req.params.id],
  )).rows;
  res.json({ success: true, data: { seats: keysToCamel(rows), invigilators: keysToCamel(invigilators) } });
}));

// ======================================================================= transcript & progress (EX-19/EX-25/EX-26)
router.get("/students/:id/transcript", asyncHandler(async (req, res) => {
  await assertStudentAccess(req, req.params.id, "results", "view");
  const guardianView = ["Guardian", "Student"].includes(req.user.linkedType);
  const student = (await query("SELECT id, name, name_bn, name_ar, class_name, section, roll, date_of_birth, admission_date, status FROM students WHERE id = $1", [req.params.id])).rows[0];
  if (!student) throw httpError(404, "Student not found.");
  const results = (await query(
    `SELECT r.exam_id, e.name AS exam_name, e.exam_type, e.start_date, ay.name AS session_name, r.class_name, r.section, r.roll,
            r.total_marks, r.max_marks, r.percentage, r.gpa, r.grade, r.division, r.status, r.class_position, r.subjects,
            r.version, r.published, r.teacher_comment, r.skill_ratings
     FROM results r JOIN exams e ON e.id = r.exam_id LEFT JOIN academic_years ay ON ay.id = e.academic_year_id
     WHERE r.student_id = $1 ${guardianView ? "AND r.published" : ""}
     ORDER BY COALESCE(e.start_date, e.created_at::date), e.name`,
    [req.params.id],
  )).rows;
  const enrollments = (await query("SELECT session_name, class_name, section, roll, status, result_summary FROM enrollments WHERE student_id = $1 ORDER BY created_at", [req.params.id])).rows;
  const board = (await query("SELECT * FROM board_results WHERE student_id = $1 ORDER BY passing_year", [req.params.id])).rows;
  const progress = results.map((r) => ({ exam: r.exam_name, session: r.session_name, gpa: r.gpa === null ? null : Number(r.gpa), percentage: r.percentage === null ? null : Number(r.percentage) }));
  res.json({ success: true, data: keysToCamel({ student, results, enrollments, boardResults: board, progress }) });
}));

// Narrative report: teacher comment + skill ratings on a result (EM-06).
router.patch("/results/:id/narrative", requirePermission("results", "edit"), asyncHandler(async (req, res) => {
  const old = (await query("SELECT * FROM results WHERE id::text = $1", [req.params.id])).rows[0];
  if (!old) throw httpError(404, "Result not found.");
  if (old.published) throw httpError(409, "Result is published. Use the correction workflow to change it.");
  const ratings = req.body?.skillRatings && typeof req.body.skillRatings === "object" ? req.body.skillRatings : old.skill_ratings;
  const row = (await query("UPDATE results SET teacher_comment = $1, skill_ratings = $2 WHERE id = $3 RETURNING *",
    [req.body?.teacherComment ?? old.teacher_comment, JSON.stringify(ratings || {}), old.id])).rows[0];
  await writeAudit(req, { entity: "results", entityId: old.id, action: "NARRATIVE", oldValue: { teacherComment: old.teacher_comment, skillRatings: old.skill_ratings }, newValue: { teacherComment: row.teacher_comment, skillRatings: row.skill_ratings } });
  res.json({ success: true, data: keysToCamel(row) });
}));

// ======================================================================= board / government (BM-05..09, AM-03, QM-04, EM-03)
const BOARD_FORMATS = {
  NCTB: { label: "Education Board SSC/HSC (Dhaka, Chattogram, Rajshahi, Cumilla, Jashore, Barishal, Sylhet, Dinajpur, Mymensingh)" },
  BMEB: { label: "Bangladesh Madrasah Education Board (Dakhil / Alim)" },
  IAU: { label: "Islamic Arabic University (Fazil / Kamil)" },
  Befaq: { label: "Befaq / Al-Haiatul Ulya (Qawmi marhala)" },
  CAIE: { label: "Cambridge International (candidate entries)" },
  Edexcel: { label: "Pearson Edexcel (candidate entries)" },
};
const EXPORT_COLUMNS = [
  { key: "registration_no", label: "Registration No" }, { key: "candidate_no", label: "Candidate/Roll No" },
  { key: "student_id", label: "Student ID" }, { key: "name", label: "Student Name (English)" }, { key: "name_bn", label: "Student Name (Bangla)" },
  { key: "name_ar", label: "Student Name (Arabic)" }, { key: "father_name", label: "Father's Name" }, { key: "mother_name", label: "Mother's Name" },
  { key: "date_of_birth", label: "Date of Birth" }, { key: "gender", label: "Gender" }, { key: "religion", label: "Religion" },
  { key: "birth_cert_no", label: "Birth Registration No" }, { key: "group_name", label: "Group" }, { key: "board", label: "Board" },
  { key: "exam_level", label: "Exam" }, { key: "exam_year", label: "Year" }, { key: "exam_session", label: "Session" },
  { key: "centre", label: "Centre" }, { key: "subject_codes", label: "Subjects" }, { key: "fourth_subject", label: "4th Subject" },
  { key: "entry_fee", label: "Entry Fee" }, { key: "predicted", label: "Predicted Grades" }, { key: "form_fillup_status", label: "Form Fill-up" },
];

router.get("/board/formats", requirePermission("students", "view"), (req, res) => res.json({ success: true, data: BOARD_FORMATS }));

router.get("/board/export", requirePermission("students", "export"), asyncHandler(async (req, res) => {
  const { board, level, year, format } = req.query;
  const rows = (await query(
    `SELECT br.*, s.name, s.name_bn, s.name_ar, s.date_of_birth, s.gender, s.religion, s.birth_cert_no, s.group_name,
            s.details->>'fatherName' AS father_name, s.details->>'motherName' AS mother_name,
            fs.code AS fourth_subject_code
     FROM board_registrations br JOIN students s ON s.id = br.student_id
     LEFT JOIN subjects fs ON fs.id = s.fourth_subject_id
     WHERE ($1::text IS NULL OR br.board = $1) AND ($2::text IS NULL OR br.exam_level = $2) AND ($3::text IS NULL OR br.exam_year = $3)
     ORDER BY br.exam_level, s.class_name, s.roll`,
    [board || null, level || null, year || null],
  )).rows.map((r) => ({
    ...r,
    subject_codes: (Array.isArray(r.subjects) ? r.subjects : []).map((x) => (typeof x === "object" ? x.code || x.name : x)).join(" "),
    fourth_subject: r.fourth_subject_code || "",
    predicted: Object.entries(r.predicted_grades || {}).map(([k, v]) => `${k}:${v}`).join(" "),
  }));
  await writeAudit(req, { entity: "board_registrations", action: "EXPORT", newValue: { board, level, year, rows: rows.length } });
  if (format === "json") return res.json({ success: true, data: keysToCamel(rows) });
  sendCsv(res, `board-registration-${board || "all"}-${level || "all"}-${year || "all"}.csv`, EXPORT_COLUMNS, rows);
}));

// Test/pre-test failure blocks board form fill-up unless overridden (BM-05).
router.get("/board/form-fillup", requirePermission("students", "view"), asyncHandler(async (req, res) => {
  const { examId, level, year } = req.query;
  if (!examId) throw httpError(422, "Choose the test exam.");
  const settings = (await query("SELECT form_fillup_block_on_test_fail FROM system_settings WHERE id = 1")).rows[0] || {};
  const rows = (await query(
    `SELECT br.id AS registration_id, br.student_id, s.name, s.class_name, s.roll, br.form_fillup_status, br.block_reason,
            r.status AS test_status, r.gpa, r.failed_subjects
     FROM board_registrations br JOIN students s ON s.id = br.student_id
     LEFT JOIN results r ON r.student_id = br.student_id AND r.exam_id = $1
     WHERE ($2::text IS NULL OR br.exam_level = $2) AND ($3::text IS NULL OR br.exam_year = $3)
     ORDER BY s.class_name, s.roll`,
    [examId, level || null, year || null],
  )).rows.map((r) => {
    const failed = r.test_status && /fail/i.test(r.test_status);
    const missing = !r.test_status;
    return { ...r, eligible: !(settings.form_fillup_block_on_test_fail && (failed || missing)), reason: failed ? "Failed in test exam" : missing ? "No test exam result" : null };
  });
  res.json({ success: true, data: keysToCamel(rows) });
}));

router.post("/board/form-fillup/apply", requirePermission("students", "edit"), asyncHandler(async (req, res) => {
  const { examId, level, year, overrides = [] } = req.body || {};
  if (!examId) throw httpError(422, "Choose the test exam.");
  const settings = (await query("SELECT form_fillup_block_on_test_fail FROM system_settings WHERE id = 1")).rows[0] || {};
  const regs = (await query(
    `SELECT br.id, br.student_id, r.status AS test_status FROM board_registrations br
     LEFT JOIN results r ON r.student_id = br.student_id AND r.exam_id = $1
     WHERE ($2::text IS NULL OR br.exam_level = $2) AND ($3::text IS NULL OR br.exam_year = $3)`,
    [examId, level || null, year || null],
  )).rows;
  let eligible = 0; let blocked = 0;
  for (const r of regs) {
    const fail = !r.test_status || /fail/i.test(r.test_status);
    const override = overrides.includes(r.student_id);
    const isBlocked = settings.form_fillup_block_on_test_fail && fail && !override;
    await query("UPDATE board_registrations SET form_fillup_status = $1, block_reason = $2 WHERE id = $3",
      [isBlocked ? "Blocked" : "Eligible", isBlocked ? (r.test_status ? "Failed in test exam" : "No test exam result") : override ? "Override by authorised user" : null, r.id]);
    if (isBlocked) blocked += 1; else eligible += 1;
  }
  await writeAudit(req, { entity: "board_registrations", action: "FORM_FILLUP_ELIGIBILITY", newValue: { examId, eligible, blocked, overrides }, reason: overrides.length ? "Override applied" : null });
  res.json({ success: true, data: { eligible, blocked } });
}));

// Board result import with row-level validation (BM-07, NFX-09).
router.post("/board/results/import", requirePermission("results", "create"), asyncHandler(async (req, res) => {
  const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
  const dryRun = req.body?.dryRun === true;
  if (!rows.length) throw httpError(422, "No rows to import.");
  const report = [];
  const valid = [];
  for (const [i, r] of rows.entries()) {
    const errors = [];
    let studentId = r.studentId || null;
    if (!studentId && (r.registrationNo || r.rollNo)) {
      const found = (await query("SELECT student_id FROM board_registrations WHERE registration_no = $1 OR candidate_no = $2 LIMIT 1", [r.registrationNo || "", r.rollNo || ""])).rows[0];
      studentId = found?.student_id || null;
    }
    if (!studentId) errors.push("Student not found (give studentId or a registered registration/roll no).");
    else if (!(await query("SELECT 1 FROM students WHERE id = $1", [studentId])).rowCount) errors.push(`Unknown student ${studentId}.`);
    if (!r.examLevel) errors.push("examLevel is required.");
    if (!r.passingYear) errors.push("passingYear is required.");
    if (r.gpa !== undefined && r.gpa !== "" && (Number.isNaN(Number(r.gpa)) || Number(r.gpa) < 0 || Number(r.gpa) > 5)) errors.push("gpa must be between 0 and 5.");
    report.push({ row: i + 1, studentId, ok: !errors.length, errors });
    if (!errors.length) valid.push({ ...r, studentId });
  }
  if (!dryRun && valid.length) {
    await transaction(async (client) => {
      for (const r of valid) {
        await client.query(
          `INSERT INTO board_results (student_id, board, exam_level, passing_year, roll_no, registration_no, gpa, grade, subjects)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           ON CONFLICT (student_id, exam_level, passing_year) DO UPDATE SET board = EXCLUDED.board, roll_no = EXCLUDED.roll_no,
             registration_no = EXCLUDED.registration_no, gpa = EXCLUDED.gpa, grade = EXCLUDED.grade, subjects = EXCLUDED.subjects, updated_at = NOW()`,
          [r.studentId, r.board || null, r.examLevel, String(r.passingYear), r.rollNo || null, r.registrationNo || null,
            r.gpa === "" || r.gpa === undefined ? null : Number(r.gpa), r.grade || null, JSON.stringify(r.subjects || [])],
        );
      }
      await writeAudit(req, { entity: "board_results", action: "IMPORT", newValue: { imported: valid.length, rejected: rows.length - valid.length } }, client);
    });
  }
  res.json({ success: true, data: { dryRun, total: rows.length, imported: dryRun ? 0 : valid.length, rejected: rows.length - valid.length, report } });
}));

// BANBEIS / EMIS annual data summary (BM-09).
router.get("/board/banbeis", requirePermission("reports", "view"), asyncHandler(async (req, res) => {
  const byClass = (await query(
    `SELECT COALESCE(class_name, '-') AS class_name, COUNT(*) FILTER (WHERE gender = 'Male')::int AS boys,
            COUNT(*) FILTER (WHERE gender = 'Female')::int AS girls, COUNT(*)::int AS total
     FROM students WHERE status = 'Active' GROUP BY class_name ORDER BY class_name`,
  )).rows;
  const religion = (await query("SELECT COALESCE(religion, 'Not set') AS religion, COUNT(*)::int AS n FROM students WHERE status = 'Active' GROUP BY 1 ORDER BY 2 DESC")).rows;
  const teachers = (await query(
    `SELECT COALESCE(employee_type, 'Not set') AS employee_type, COUNT(*) FILTER (WHERE gender = 'Male')::int AS male,
            COUNT(*) FILTER (WHERE gender = 'Female')::int AS female, COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE mpo_index IS NOT NULL AND mpo_index <> '')::int AS mpo
     FROM teachers WHERE status = 'Active' GROUP BY 1`,
  )).rows;
  const staff = (await query("SELECT COUNT(*)::int AS n FROM staff WHERE status = 'Active'")).rows[0].n;
  const stipend = (await query("SELECT program, COUNT(*)::int AS n, COALESCE(SUM(amount), 0) AS amount FROM stipend_beneficiaries WHERE status = 'Active' GROUP BY program")).rows;
  const profile = (await query("SELECT name, eiin, type, address, established_year FROM institute_profile WHERE id = 1")).rows[0] || {};
  const data = { institution: profile, year: req.query.year || Number(localDate().slice(0, 4)), studentsByClass: byClass, studentsByReligion: religion, teachers, staff, stipend };
  if (req.query.format === "csv") {
    return sendCsv(res, `banbeis-${data.year}.csv`, [{ key: "class_name", label: "Class" }, { key: "boys", label: "Boys" }, { key: "girls", label: "Girls" }, { key: "total", label: "Total" }], byClass);
  }
  res.json({ success: true, data: keysToCamel(data) });
}));

router.get("/board/stipend/export", requirePermission("students", "export"), asyncHandler(async (req, res) => {
  const rows = (await query(
    `SELECT sb.*, s.name, s.class_name, s.roll, s.gender FROM stipend_beneficiaries sb JOIN students s ON s.id = sb.student_id
     WHERE sb.status = 'Active' AND ($1::text IS NULL OR sb.program = $1) ORDER BY s.class_name, s.roll`,
    [req.query.program || null],
  )).rows;
  await writeAudit(req, { entity: "stipend_beneficiaries", action: "EXPORT", newValue: { rows: rows.length } });
  sendCsv(res, "stipend-beneficiaries.csv", [
    { key: "student_id", label: "Student ID" }, { key: "name", label: "Name" }, { key: "class_name", label: "Class" }, { key: "roll", label: "Roll" },
    { key: "gender", label: "Gender" }, { key: "program", label: "Program" }, { key: "mobile_banking_provider", label: "MFS" },
    { key: "mobile_banking_number", label: "MFS Number" }, { key: "account_holder", label: "Account Holder" }, { key: "amount", label: "Amount" },
  ], rows);
}));

// ======================================================================= accounting & payroll exports (FE-26/FIN-18, HR-08)
router.get("/accounts/export/tally", requirePermission("accounts", "export"), asyncHandler(async (req, res) => {
  const from = req.query.from || `${localDate().slice(0, 4)}-01-01`;
  const to = req.query.to || localDate();
  const tx = (await query(
    `SELECT ft.*, ah.name AS head_name FROM financial_transactions ft LEFT JOIN account_heads ah ON ah.id = ft.account_head_id
     WHERE ft.transaction_date BETWEEN $1 AND $2 AND COALESCE(ft.reversed, FALSE) = FALSE AND COALESCE(ft.approval_status, 'Approved') IN ('Approved', 'Not Required')
     ORDER BY ft.transaction_date, ft.id`,
    [from, to],
  )).rows;
  await writeAudit(req, { entity: "financial_transactions", action: "EXPORT", newValue: { format: req.query.format || "tally", from, to, rows: tx.length } });
  if (req.query.format === "csv") {
    return sendCsv(res, `accounts-${from}-to-${to}.csv`, [
      { key: "transaction_date", label: "Date" }, { key: "id", label: "Voucher No" }, { key: "type", label: "Type" },
      { key: "head_name", label: "Ledger" }, { key: "category", label: "Category" }, { key: "fund", label: "Fund" },
      { key: "payment_method", label: "Mode" }, { key: "amount", label: "Amount" }, { key: "description", label: "Narration" },
    ], tx.map((t) => ({ ...t, head_name: t.head_name || t.category, transaction_date: String(t.transaction_date).slice(0, 10) })));
  }
  const cashLedger = (m) => (/bank|cheque|transfer/i.test(m || "") ? "Bank Account" : "Cash");
  const vouchers = tx.map((t) => {
    const income = String(t.type).toLowerCase() === "income";
    const date = String(t.transaction_date).slice(0, 10).replace(/-/g, "");
    const ledger = xmlEscape(t.head_name || t.category || (income ? "Income" : "Expense"));
    const amount = Number(t.amount).toFixed(2);
    return `<TALLYMESSAGE xmlns:UDF="TallyUDF"><VOUCHER VCHTYPE="${income ? "Receipt" : "Payment"}" ACTION="Create">
<DATE>${date}</DATE><VOUCHERTYPENAME>${income ? "Receipt" : "Payment"}</VOUCHERTYPENAME><VOUCHERNUMBER>${xmlEscape(t.id)}</VOUCHERNUMBER>
<NARRATION>${xmlEscape(t.description || "")}</NARRATION>
<ALLLEDGERENTRIES.LIST><LEDGERNAME>${ledger}</LEDGERNAME><ISDEEMEDPOSITIVE>${income ? "No" : "Yes"}</ISDEEMEDPOSITIVE><AMOUNT>${income ? amount : `-${amount}`}</AMOUNT></ALLLEDGERENTRIES.LIST>
<ALLLEDGERENTRIES.LIST><LEDGERNAME>${cashLedger(t.payment_method)}</LEDGERNAME><ISDEEMEDPOSITIVE>${income ? "Yes" : "No"}</ISDEEMEDPOSITIVE><AMOUNT>${income ? `-${amount}` : amount}</AMOUNT></ALLLEDGERENTRIES.LIST>
</VOUCHER></TALLYMESSAGE>`;
  });
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE><HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER><BODY><IMPORTDATA>
<REQUESTDESC><REPORTNAME>Vouchers</REPORTNAME></REQUESTDESC><REQUESTDATA>
${vouchers.join("\n")}
</REQUESTDATA></IMPORTDATA></BODY></ENVELOPE>`;
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="tally-vouchers-${from}-to-${to}.xml"`);
  res.send(xml);
}));

router.get("/payroll/bank-advice", requirePermission("payroll", "export"), asyncHandler(async (req, res) => {
  const month = req.query.month || localMonth();
  const rows = (await query(
    `SELECT pr.employee_id, pr.employee_name, pr.employee_type, pr.role, pr.net_pay, pr.status, ss.bank_account
     FROM payroll_records pr LEFT JOIN salary_structures ss ON ss.employee_type = pr.employee_type AND ss.employee_id = pr.employee_id
     WHERE to_char(pr.payroll_month, 'YYYY-MM') = $1 AND pr.status IN ('Approved', 'Paid', 'Processed', 'Pending')
     ORDER BY pr.employee_name`,
    [month],
  )).rows;
  const missing = rows.filter((r) => !r.bank_account).map((r) => r.employee_name);
  await writeAudit(req, { entity: "payroll_records", action: "EXPORT", newValue: { report: "bank_advice", month, rows: rows.length } });
  if (req.query.format === "json") return res.json({ success: true, data: { month, rows: keysToCamel(rows), missingBankAccount: missing } });
  const withSerial = rows.map((r, i) => ({ ...r, serial: i + 1, net_pay: Number(r.net_pay).toFixed(2), bank_account: r.bank_account || "CASH (no bank account)" }));
  sendCsv(res, `bank-advice-${month}.csv`, [
    { key: "serial", label: "SL" }, { key: "employee_id", label: "Employee ID" }, { key: "employee_name", label: "Name" },
    { key: "role", label: "Designation" }, { key: "bank_account", label: "Bank Account" }, { key: "net_pay", label: "Net Amount (BDT)" },
  ], withSerial);
}));

// ======================================================================= homework submissions (AC-12)
router.get("/homework/:id/submissions", requireAny(["homework", "view"]), asyncHandler(async (req, res) => {
  const hw = (await query("SELECT * FROM homework WHERE id::text = $1", [req.params.id])).rows[0];
  if (!hw) throw httpError(404, "Homework not found.");
  const rows = (await query(
    `SELECT s.id AS student_id, s.name, s.roll, hs.status, hs.marks, hs.remarks, hs.submitted_at
     FROM students s LEFT JOIN homework_submissions hs ON hs.student_id = s.id AND hs.homework_id = $1
     WHERE s.status = 'Active' AND (($2::text IS NOT NULL AND s.class_id = $2) OR ($2::text IS NULL AND s.class_name ILIKE $3))
       AND ($4::text IS NULL OR s.section = $4)
     ORDER BY NULLIF(regexp_replace(COALESCE(s.roll, ''), '\\D', '', 'g'), '')::int NULLS LAST, s.name`,
    [String(hw.id), hw.class_id || null, `${hw.class_name || ""}%`, hw.section || null],
  )).rows;
  res.json({ success: true, data: { homework: keysToCamel(hw), roster: keysToCamel(rows) } });
}));

router.post("/homework/:id/submissions", requirePermission("homework", "edit"), asyncHandler(async (req, res) => {
  const entries = Array.isArray(req.body?.entries) ? req.body.entries : [];
  const hw = (await query("SELECT id, due_date FROM homework WHERE id::text = $1", [req.params.id])).rows[0];
  if (!hw) throw httpError(404, "Homework not found.");
  let saved = 0;
  await transaction(async (client) => {
    for (const e of entries) {
      if (!e.studentId || !e.status) continue;
      await client.query(
        `INSERT INTO homework_submissions (homework_id, student_id, status, marks, remarks, marked_by)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (homework_id, student_id) DO UPDATE SET status = EXCLUDED.status, marks = EXCLUDED.marks,
           remarks = EXCLUDED.remarks, marked_by = EXCLUDED.marked_by, updated_at = NOW()`,
        [String(hw.id), e.studentId, e.status, e.marks === "" || e.marks === undefined ? null : Number(e.marks), e.remarks || null, req.user.name],
      );
      saved += 1;
    }
  });
  res.json({ success: true, data: { saved } });
}));

// ======================================================================= quizzes (ONL-03, OC-05)
function publicQuestions(questions) {
  return (Array.isArray(questions) ? questions : []).map((q, i) => ({ index: i, q: q.q, options: q.options || [], marks: Number(q.marks || 1) }));
}

router.get("/quizzes/for-student/:studentId", asyncHandler(async (req, res) => {
  await assertStudentAccess(req, req.params.studentId, "online_classes", "view");
  const s = (await query("SELECT id, class_id, section FROM students WHERE id = $1", [req.params.studentId])).rows[0];
  if (!s) throw httpError(404, "Student not found.");
  const rows = (await query(
    `SELECT q.*, sub.name AS subject_name, qa.score, qa.max_score, qa.submitted_at
     FROM quizzes q LEFT JOIN subjects sub ON sub.id = q.subject_id
     LEFT JOIN quiz_attempts qa ON qa.quiz_id = q.id::text AND qa.student_id = $1
     WHERE q.status IN ('Published', 'Closed') AND (q.class_id IS NULL OR q.class_id = $2) AND (q.section IS NULL OR q.section = '' OR q.section = $3)
     ORDER BY COALESCE(q.opens_at, q.created_at) DESC`,
    [s.id, s.class_id, s.section],
  )).rows.map((q) => {
    const now = new Date();
    const open = q.status === "Published" && (!q.opens_at || new Date(q.opens_at) <= now) && (!q.closes_at || new Date(q.closes_at) >= now);
    return {
      id: q.id, title: q.title, subjectName: q.subject_name, durationMinutes: q.duration_minutes, opensAt: q.opens_at, closesAt: q.closes_at,
      open: open && !q.submitted_at, attempted: Boolean(q.submitted_at), score: q.score, maxScore: q.max_score,
      questions: open && !q.submitted_at ? publicQuestions(q.questions) : [],
    };
  });
  res.json({ success: true, data: rows });
}));

router.post("/quizzes/:id/attempt", asyncHandler(async (req, res) => {
  const { studentId, answers = [] } = req.body || {};
  if (!studentId) throw httpError(422, "Student is required.");
  await assertStudentAccess(req, studentId, "online_classes", "create");
  const quiz = (await query("SELECT * FROM quizzes WHERE id::text = $1", [req.params.id])).rows[0];
  if (!quiz) throw httpError(404, "Quiz not found.");
  const now = new Date();
  if (quiz.status !== "Published" || (quiz.opens_at && new Date(quiz.opens_at) > now) || (quiz.closes_at && new Date(quiz.closes_at) < now)) {
    throw httpError(409, "This quiz is not open.");
  }
  const student = (await query("SELECT class_id FROM students WHERE id = $1", [studentId])).rows[0];
  if (quiz.class_id && student?.class_id !== quiz.class_id) throw httpError(403, "This quiz is not for this student's class.");
  // Auto marking (ONL-03): one point value per question, answer = index of the correct option.
  const questions = Array.isArray(quiz.questions) ? quiz.questions : [];
  let score = 0; let max = 0;
  const marked = questions.map((q, i) => {
    const marks = Number(q.marks || 1);
    max += marks;
    const given = answers[i] === undefined || answers[i] === null || answers[i] === "" ? null : Number(answers[i]);
    const correct = given !== null && given === Number(q.answer);
    if (correct) score += marks;
    return { index: i, given, correct };
  });
  try {
    const row = (await query(
      "INSERT INTO quiz_attempts (quiz_id, student_id, answers, score, max_score, submitted_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *",
      [String(quiz.id), studentId, JSON.stringify(marked), score, max, req.user.name],
    )).rows[0];
    res.status(201).json({ success: true, data: { score: Number(row.score), maxScore: Number(row.max_score), answers: marked } });
  } catch (error) {
    if (error.code === "23505") throw httpError(409, "This quiz was already submitted.");
    throw error;
  }
}));

// ======================================================================= live class attendance (OC-02)
router.post("/online-classes/:id/join", asyncHandler(async (req, res) => {
  const { studentId } = req.body || {};
  if (!studentId) throw httpError(422, "Student is required.");
  await assertStudentAccess(req, studentId, "online_classes", "view");
  const cls = (await query("SELECT * FROM online_classes WHERE id::text = $1", [req.params.id])).rows[0];
  if (!cls) throw httpError(404, "Class not found.");
  if (cls.status === "Cancelled") throw httpError(409, "This class was cancelled.");
  await query(
    "INSERT INTO online_class_attendance (online_class_id, student_id, joined_by) VALUES ($1,$2,$3) ON CONFLICT (online_class_id, student_id) DO NOTHING",
    [String(cls.id), studentId, req.user.name],
  );
  res.json({ success: true, data: { meetingUrl: cls.meeting_url, recordingUrl: cls.recording_url } });
}));

router.get("/online-classes/:id/attendance", requirePermission("online_classes", "view"), asyncHandler(async (req, res) => {
  const rows = (await query(
    `SELECT oca.student_id, s.name, s.roll, oca.joined_at FROM online_class_attendance oca JOIN students s ON s.id = oca.student_id
     WHERE oca.online_class_id = $1 ORDER BY oca.joined_at`,
    [req.params.id],
  )).rows;
  res.json({ success: true, data: keysToCamel(rows) });
}));

// ======================================================================= Hijri holiday suggestions (QM-07)
const { hijriSuggestions } = require("../services/hijri");

async function suggestionsWithStatus(year) {
  const list = hijriSuggestions(year);
  const labels = list.map((s) => s.hijriLabel);
  const existing = labels.length
    ? new Set((await query("SELECT hijri_label FROM academic_events WHERE hijri_label = ANY($1::text[])", [labels])).rows.map((r) => r.hijri_label))
    : new Set();
  return list.map((s) => ({ ...s, added: existing.has(s.hijriLabel) }));
}

router.get("/calendar/hijri-suggestions", requirePermission("academic", "view"), asyncHandler(async (req, res) => {
  const year = Number(req.query.year || localDate().slice(0, 4));
  if (!Number.isInteger(year) || year < 2000 || year > 2100) throw httpError(422, "Year must be between 2000 and 2100.");
  res.json({ success: true, data: await suggestionsWithStatus(year) });
}));

router.post("/calendar/hijri-suggestions/apply", requirePermission("academic", "create"), asyncHandler(async (req, res) => {
  const year = Number(req.body?.year);
  const keys = Array.isArray(req.body?.keys) ? req.body.keys.map(String) : [];
  if (!Number.isInteger(year) || year < 2000 || year > 2100) throw httpError(422, "Year must be between 2000 and 2100.");
  const picked = (await suggestionsWithStatus(year)).filter((s) => keys.includes(s.key) && !s.added);
  const created = await transaction(async (client) => {
    const rows = [];
    for (const s of picked) {
      rows.push((await client.query(
        `INSERT INTO academic_events (title, type, start_date, end_date, audience, hijri_label, description, is_public)
         VALUES ($1,$2,$3,$4,'All',$5,$6,TRUE) RETURNING *`,
        [`${s.title} / ${s.titleBn}`, s.type, s.startDate, s.endDate, s.hijriLabel,
          "Estimated from the Umm al-Qura calendar; confirm the date after the moon-sighting announcement."],
      )).rows[0]);
    }
    return rows;
  });
  await writeAudit(req, { entity: "academic_events", entityId: String(year), action: "HIJRI_HOLIDAYS_ADDED", newValue: { count: created.length, keys: picked.map((s) => s.key) } });
  res.status(201).json({ success: true, data: keysToCamel(created) });
}));

// ======================================================================= portal extras (guardian: GA-10..22, EM-10, CM-09)
router.get("/portal/children/:studentId/extras", asyncHandler(async (req, res) => {
  await assertStudentAccess(req, req.params.studentId, "students", "view");
  const id = req.params.studentId;
  const [dailyLogs, coursework, homework, houses, onlineClasses] = await Promise.all([
    query("SELECT log_date, meal, nap, activity, mood, photo_url, note FROM daily_logs WHERE student_id = $1 ORDER BY log_date DESC LIMIT 14", [id]),
    query(
      `SELECT c.title, c.kind, c.deadline, c.max_marks, sub.name AS subject_name, cs.status, cs.marks, cs.grade, cs.feedback
       FROM coursework c JOIN students s ON s.id = $1 AND (c.class_id IS NULL OR c.class_id = s.class_id)
       LEFT JOIN subjects sub ON sub.id = c.subject_id
       LEFT JOIN coursework_submissions cs ON cs.coursework_id = c.id::text AND cs.student_id = $1
       ORDER BY c.deadline DESC NULLS LAST LIMIT 30`, [id]),
    query(
      `SELECT h.title, h.due_date, hs.status, hs.marks, hs.remarks FROM homework_submissions hs
       JOIN homework h ON h.id::text = hs.homework_id WHERE hs.student_id = $1 ORDER BY h.due_date DESC NULLS LAST LIMIT 30`, [id]),
    query(
      `SELECT c.name, c.kind, c.points, (SELECT COALESCE(SUM(hp.points), 0) FROM house_points hp WHERE hp.club_id = c.id::text AND hp.student_id = $1) AS my_points
       FROM clubs c WHERE c.members @> to_jsonb(ARRAY[$1]::text[])`, [id]),
    query(
      `SELECT oc.id, oc.title, oc.provider, oc.scheduled_at, oc.duration_minutes, oc.status, oc.recording_url,
              (oc.meeting_url IS NOT NULL) AS has_link, sub.name AS subject_name,
              EXISTS (SELECT 1 FROM online_class_attendance a WHERE a.online_class_id = oc.id::text AND a.student_id = $1) AS attended
       FROM online_classes oc JOIN students s ON s.id = $1 AND (oc.class_id IS NULL OR oc.class_id = s.class_id)
       LEFT JOIN subjects sub ON sub.id = oc.subject_id
       WHERE oc.status <> 'Cancelled' ORDER BY oc.scheduled_at DESC NULLS LAST LIMIT 20`, [id]),
  ]);
  res.json({
    success: true,
    data: keysToCamel({
      dailyLogs: dailyLogs.rows, coursework: coursework.rows, homeworkStatus: homework.rows, houses: houses.rows, onlineClasses: onlineClasses.rows,
    }),
  });
}));

router.get("/portal/preferences", asyncHandler(async (req, res) => {
  if (req.user.linkedType !== "Guardian") throw httpError(403, "Guardian account required.");
  const g = (await query("SELECT notification_prefs FROM guardians WHERE id = $1", [req.user.linkedId])).rows[0];
  res.json({ success: true, data: g?.notification_prefs || {} });
}));

router.patch("/portal/preferences", asyncHandler(async (req, res) => {
  if (req.user.linkedType !== "Guardian") throw httpError(403, "Guardian account required.");
  const allowedChannels = ["sms", "email", "push", "whatsapp"];
  const allowedEvents = ["Absent", "Late", "EntryExit", "Result", "FeeReminder", "Payment", "Notice", "Homework"];
  const prefs = {};
  for (const c of allowedChannels) if (typeof req.body?.[c] === "boolean") prefs[c] = req.body[c];
  prefs.events = {};
  for (const e of allowedEvents) if (typeof req.body?.events?.[e] === "boolean") prefs.events[e] = req.body.events[e];
  await query("UPDATE guardians SET notification_prefs = $1 WHERE id = $2", [JSON.stringify(prefs), req.user.linkedId]);
  await writeAudit(req, { entity: "guardians", entityId: req.user.linkedId, action: "NOTIFICATION_PREFERENCES", newValue: prefs });
  res.json({ success: true, data: prefs });
}));

// Teacher "mute outside school hours" for guardian messages (v1 CM-05).
router.patch("/me/quiet-hours", asyncHandler(async (req, res) => {
  const { enabled, start, end } = req.body || {};
  const valid = (t) => /^\d{2}:\d{2}$/.test(String(t || ""));
  if (enabled && (!valid(start) || !valid(end))) throw httpError(422, "Start and end must be HH:MM.");
  const value = { enabled: Boolean(enabled), start: start || "18:00", end: end || "08:00" };
  await query("UPDATE users SET quiet_hours = $1 WHERE id = $2", [JSON.stringify(value), req.user.id]);
  res.json({ success: true, data: value });
}));
router.get("/me/quiet-hours", asyncHandler(async (req, res) => {
  const u = (await query("SELECT quiet_hours FROM users WHERE id = $1", [req.user.id])).rows[0];
  res.json({ success: true, data: u?.quiet_hours || {} });
}));

// ======================================================================= messaging moderation (v1 CM-06)
router.get("/conversations/all", requirePermission("communication", "approve"), asyncHandler(async (req, res) => {
  const rows = (await query(
    `SELECT DISTINCT ON (thread_key) thread_key, sender_type, sender_id, sender_name, recipient_type, recipient_id, student_id, body, created_at,
            (SELECT COUNT(*)::int FROM messages m2 WHERE m2.thread_key = m.thread_key) AS message_count
     FROM messages m ORDER BY thread_key, created_at DESC`,
  )).rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  await writeAudit(req, { entity: "messages", action: "MODERATION_VIEW", newValue: { threads: rows.length } });
  res.json({ success: true, data: keysToCamel(rows) });
}));

// ======================================================================= hifz targets (QM-16, QM-20)
const pagesOf = (from, to) => {
  const a = parseFloat(from); const b = parseFloat(to);
  return Number.isFinite(a) && Number.isFinite(b) ? Math.abs(b - a) + 1 : 0;
};
async function hifzTargetReport(month) {
  const targets = (await query(
    `SELECT ht.*, s.name, s.class_name, h.name AS halaqa FROM hifz_targets ht JOIN students s ON s.id = ht.student_id
     LEFT JOIN halaqa_members hm ON hm.student_id = s.id LEFT JOIN halaqas h ON h.id::text = hm.halaqa_id::text
     WHERE ht.target_month = $1 ORDER BY s.name`,
    [month],
  )).rows;
  const logs = (await query(
    "SELECT student_id, sabak_from, sabak_to FROM hifz_logs WHERE to_char(log_date, 'YYYY-MM') = $1 AND COALESCE(log_type, 'Sabak') IN ('Sabak', 'Hifz', 'Nazera')",
    [month],
  )).rows;
  const actual = {};
  for (const l of logs) actual[l.student_id] = (actual[l.student_id] || 0) + pagesOf(l.sabak_from, l.sabak_to);
  const day = localDay();
  const isCurrent = month === localMonth();
  const expectedShare = isCurrent ? Math.min(1, day / 30) : 1;
  return targets.map((t) => {
    const done = actual[t.student_id] || 0;
    const target = Number(t.target_pages);
    const pct = target ? Math.round((done / target) * 100) : 0;
    return { ...t, actual_pages: done, percent: pct, behind: target > 0 && done < target * expectedShare * 0.8 };
  });
}
router.get("/hifz/targets-report", requirePermission("madrasa", "view"), asyncHandler(async (req, res) => {
  const month = req.query.month || localMonth();
  res.json({ success: true, data: keysToCamel(await hifzTargetReport(month)) });
}));

// ======================================================================= staff self check-in with location (AT-10)
router.post("/staff-attendance/check-in", asyncHandler(async (req, res) => {
  if (!["Teacher", "Staff"].includes(req.user.linkedType)) throw httpError(403, "Only teacher/staff accounts can self check-in.");
  const { latitude, longitude, type = "in" } = req.body || {};
  const settings = (await query("SELECT attendance_cutoff_time FROM system_settings WHERE id = 1")).rows[0] || {};
  const person = (await query(`SELECT name FROM ${req.user.linkedType === "Teacher" ? "teachers" : "staff"} WHERE id = $1`, [req.user.linkedId])).rows[0];
  const now = new Date();
  const cutoff = String(settings.attendance_cutoff_time || "09:00").slice(0, 5);
  const [ch, cm] = cutoff.split(":").map(Number);
  const lateMinutes = Math.max(0, localMinutes(now) - (ch * 60 + cm));
  const existing = (await query("SELECT * FROM staff_attendance WHERE employee_type = $1 AND employee_id = $2 AND attendance_date = CURRENT_DATE", [req.user.linkedType, req.user.linkedId])).rows[0];
  let row;
  if (type === "out") {
    if (!existing) throw httpError(409, "Check in first.");
    row = (await query("UPDATE staff_attendance SET out_time = NOW() WHERE id = $1 RETURNING *", [existing.id])).rows[0];
  } else if (existing) {
    throw httpError(409, "Already checked in today.");
  } else {
    row = (await query(
      `INSERT INTO staff_attendance (employee_type, employee_id, employee_name, attendance_date, status, in_time, source, latitude, longitude, late_minutes, marked_by)
       VALUES ($1,$2,$3,CURRENT_DATE,$4,NOW(),'Mobile',$5,$6,$7,$8) RETURNING *`,
      [req.user.linkedType, req.user.linkedId, person?.name || req.user.name, lateMinutes > 0 ? "Late" : "Present",
        latitude ?? null, longitude ?? null, lateMinutes, req.user.name],
    )).rows[0];
  }
  res.json({ success: true, data: keysToCamel(row) });
}));

// ======================================================================= special schedules (v1 AC-10)
router.get("/special-schedules/active", asyncHandler(async (req, res) => {
  const date = req.query.date || localDate();
  const rows = (await query("SELECT * FROM special_schedules WHERE status = 'Active' AND $1::date BETWEEN from_date AND to_date ORDER BY from_date DESC", [date])).rows;
  res.json({ success: true, data: keysToCamel(rows) });
}));

// ======================================================================= API keys, webhooks, docs (NF-22, NFR-16)
router.get("/api-keys", requirePermission("settings", "view"), asyncHandler(async (req, res) => {
  const rows = (await query("SELECT id, name, key_prefix, role, can_write, expires_at, last_used_at, status, created_by, created_at FROM api_keys ORDER BY created_at DESC")).rows;
  res.json({ success: true, data: keysToCamel(rows) });
}));
router.post("/api-keys", requirePermission("settings", "edit"), asyncHandler(async (req, res) => {
  const { name, role = "Principal", canWrite = false, expiresAt } = req.body || {};
  if (!name) throw httpError(422, "Name is required.");
  if (/admin/i.test(role)) throw httpError(422, "API keys cannot use an administrator role.");
  const key = `sk_${crypto.randomBytes(24).toString("hex")}`;
  const prefix = key.slice(0, 12);
  const hash = crypto.createHash("sha256").update(key).digest("hex");
  const row = (await query(
    "INSERT INTO api_keys (name, key_prefix, api_key_hash, role, can_write, expires_at, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, name, key_prefix, role, can_write, expires_at",
    [name, prefix, hash, role, Boolean(canWrite), expiresAt || null, req.user.name],
  )).rows[0];
  await writeAudit(req, { entity: "api_keys", entityId: row.id, action: "CREATE", newValue: { name, role, canWrite } });
  res.status(201).json({ success: true, data: { ...keysToCamel(row), key, notice: "Copy this key now. It is not shown again." } });
}));
router.post("/api-keys/:id/revoke", requirePermission("settings", "edit"), asyncHandler(async (req, res) => {
  const r = await query("UPDATE api_keys SET status = 'Revoked' WHERE id::text = $1 RETURNING id", [req.params.id]);
  if (!r.rowCount) throw httpError(404, "API key not found.");
  await writeAudit(req, { entity: "api_keys", entityId: req.params.id, action: "REVOKE" });
  res.json({ success: true });
}));

router.post("/webhooks/:id/test", requirePermission("settings", "edit"), asyncHandler(async (req, res) => {
  const hook = (await query("SELECT * FROM webhooks WHERE id::text = $1", [req.params.id])).rows[0];
  if (!hook) throw httpError(404, "Webhook not found.");
  const webhooks = require("../services/webhooks");
  webhooks.invalidate();
  const result = await webhooks.deliver(hook, "system.test", { message: "Test event from Smart Educational Institute Management System" });
  res.json({ success: true, data: result });
}));

router.get("/api-docs", asyncHandler(async (req, res) => {
  const index = require("fs").readFileSync(require("path").join(__dirname, "index.js"), "utf8");
  const mounts = [...index.matchAll(/\["([a-z0-9-]+)", "([a-zA-Z]+)"\]/g)].map(([, path, key]) => {
    const c = resources[key];
    return c && {
      path: `/api/v1/${path}`, resource: c.label, permissionModule: c.module,
      methods: ["GET (list: ?page&limit&search&from&to + filters)", "GET /:id", ...(c.writable.length ? ["POST", "PATCH /:id"] : []), ...(c.noDelete ? [] : [c.softDelete ? "DELETE /:id (archives)" : "DELETE /:id"])],
      filters: c.filters, writableFields: c.writable,
    };
  }).filter(Boolean);
  res.json({
    success: true,
    data: {
      authentication: [
        "Authorization: Bearer <JWT from POST /api/v1/auth/login>",
        "X-API-Key: <key from Settings → Integrations> (role-based, read-only unless write enabled)",
      ],
      webhooks: "Subscribe in Settings → Integrations. Events are '<table>.<action>' (e.g. fee_payments.create, results.publish) or '*'. Each POST carries X-Signature: sha256=HMAC_SHA256(secret, body).",
      resources: mounts,
    },
  });
}));

// ======================================================================= report schedules (OM-11)
router.post("/report-schedules/:id/run", requirePermission("reports", "view"), asyncHandler(async (req, res) => {
  const { runSchedule } = require("../services/reportDigest");
  const schedule = (await query("SELECT * FROM report_schedules WHERE id::text = $1", [req.params.id])).rows[0];
  if (!schedule) throw httpError(404, "Schedule not found.");
  const result = await runSchedule(schedule);
  res.json({ success: true, data: result });
}));

// Export / print / bulk download actions are audited (NFX-10).
router.post("/audit/export", asyncHandler(async (req, res) => {
  const { resource, format, count, filters } = req.body || {};
  await writeAudit(req, { entity: String(resource || "unknown").slice(0, 80), action: `EXPORT_${String(format || "file").toUpperCase()}`.slice(0, 40), newValue: { count, filters } });
  res.json({ success: true });
}));

module.exports = router;
module.exports.hifzTargetReport = hifzTargetReport;
