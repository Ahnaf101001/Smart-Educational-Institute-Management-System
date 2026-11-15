const express = require("express");
const { query, transaction } = require("../db/pool");
const asyncHandler = require("../utils/asyncHandler");
const httpError = require("../utils/httpError");
const { keysToCamel } = require("../utils/case");
const { requirePermission } = require("../middleware/auth");
const { writeAudit } = require("../services/audit");
const { createApproval } = require("../services/approvals");
const { processExamResults } = require("../services/grading");

const router = express.Router();

async function getExam(id) {
  const exam = (await query("SELECT * FROM exams WHERE id = $1", [id])).rows[0];
  if (!exam) throw httpError(404, "Exam not found.");
  return exam;
}

// Creates routine rows for every mapped subject of the selected classes (EX-04).
router.post("/:id/schedule/generate", requirePermission("exams", "edit"), asyncHandler(async (req, res) => {
  const exam = await getExam(req.params.id);
  const classIds = req.body?.classIds?.length ? req.body.classIds : exam.class_ids || [];
  if (!classIds.length) throw httpError(422, "Select classes for this exam first.");
  const created = await transaction(async (client) => {
    let n = 0;
    for (const classId of classIds) {
      const subjects = (await client.query(
        `SELECT s.* FROM class_subjects cs JOIN subjects s ON s.id = cs.subject_id WHERE cs.class_id = $1 ORDER BY cs.sort_order`,
        [classId],
      )).rows;
      for (const s of subjects) {
        const r = await client.query(
          `INSERT INTO exam_schedules (exam_id, class_id, subject_id, full_marks, pass_marks, components)
           VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (exam_id, class_id, subject_id) DO NOTHING`,
          [exam.id, classId, s.id, s.full_marks || 100, s.pass_marks ?? 33, JSON.stringify(s.components || [])],
        );
        n += r.rowCount;
      }
    }
    await client.query("UPDATE exams SET class_ids = $1 WHERE id = $2", [JSON.stringify(classIds), exam.id]);
    return n;
  });
  res.json({ success: true, data: { created } });
}));

router.get("/:id/routine", requirePermission("exams", "view"), asyncHandler(async (req, res) => {
  const rows = (await query(
    `SELECT es.*, c.name AS class_name, s.name AS subject_name, s.code AS subject_code, t.name AS invigilator_name
     FROM exam_schedules es JOIN classes c ON c.id = es.class_id JOIN subjects s ON s.id = es.subject_id
     LEFT JOIN teachers t ON t.id = es.invigilator_id
     WHERE es.exam_id = $1 AND ($2::text IS NULL OR es.class_id = $2)
     ORDER BY es.exam_date NULLS LAST, es.start_time, c.sort_order`,
    [req.params.id, req.query.classId || null],
  )).rows;
  res.json({ success: true, data: keysToCamel(rows) });
}));

// Admit cards (EX-05); optional block when fees are due (configurable).
router.get("/:id/admit-cards", requirePermission("exams", "print"), asyncHandler(async (req, res) => {
  const exam = await getExam(req.params.id);
  const settings = (await query("SELECT admit_card_block_on_due FROM system_settings WHERE id = 1")).rows[0] || {};
  const students = (await query(
    `SELECT s.id, s.name, s.name_bn, s.roll, s.class_name, s.section, s.photo_url, s.shift,
            COALESCE((SELECT SUM(amount + late_fine - discount - paid_amount) FROM fee_invoices i
                      WHERE i.student_id = s.id AND i.status NOT IN ('Paid','Cancelled')), 0) AS due
     FROM students s WHERE s.class_id = $1 AND s.status = 'Active' AND ($2::text IS NULL OR s.section = $2)
     ORDER BY NULLIF(regexp_replace(COALESCE(s.roll,''), '\\D', '', 'g'), '')::int NULLS LAST`,
    [req.query.classId, req.query.section || null],
  )).rows;
  const routine = (await query(
    `SELECT es.exam_date, es.start_time, es.end_time, es.room, s.name AS subject_name FROM exam_schedules es
     JOIN subjects s ON s.id = es.subject_id WHERE es.exam_id = $1 AND es.class_id = $2 ORDER BY es.exam_date NULLS LAST, es.start_time`,
    [exam.id, req.query.classId],
  )).rows;
  res.json({
    success: true,
    data: keysToCamel({
      exam: { id: exam.id, name: exam.name, startDate: exam.start_date, endDate: exam.end_date },
      blockOnDue: Boolean(settings.admit_card_block_on_due),
      routine,
      students: students.map((s) => ({ ...s, blocked: Boolean(settings.admit_card_block_on_due && Number(s.due) > 0) })),
    }),
  });
}));

// Result processing (EX-12/13, EX-14 "Result preview").
router.post("/:id/process", requirePermission("results", "create"), asyncHandler(async (req, res) => {
  const exam = await getExam(req.params.id);
  if (exam.exam_type === "Combined" && (exam.combined_from || []).length) {
    await buildCombinedMarks(exam, req);
  }
  const result = await processExamResults(exam.id, { classId: req.body?.classId || null });
  await writeAudit(req, { entity: "exams", entityId: exam.id, action: "PROCESS_RESULTS", newValue: result });
  res.json({ success: true, data: result });
}));

// Exam Controller review step (EX-14).
router.post("/:id/review", requirePermission("results", "edit"), asyncHandler(async (req, res) => {
  const exam = await getExam(req.params.id);
  if (!["Processed", "Reviewed"].includes(exam.result_status)) throw httpError(409, "Process the results before review.");
  await query("UPDATE exams SET result_status = 'Reviewed' WHERE id = $1", [exam.id]);
  await writeAudit(req, { entity: "exams", entityId: exam.id, action: "REVIEW", reason: req.body?.note });
  res.json({ success: true });
}));

// Principal approval → publish (EX-14/15, APR-08).
router.post("/:id/request-publish", requirePermission("results", "edit"), asyncHandler(async (req, res) => {
  const exam = await getExam(req.params.id);
  if (exam.result_status !== "Reviewed") throw httpError(409, "Results must be reviewed by the Exam Controller first.");
  const count = (await query("SELECT COUNT(*)::int AS n FROM results WHERE exam_id = $1", [exam.id])).rows[0].n;
  const approval = await createApproval(req, {
    type: "result_publish", title: `Publish ${exam.name} results (${count} students)`, referenceTable: "exams",
    referenceId: exam.id, payload: { examId: exam.id }, urgency: "High",
  });
  await query("UPDATE exams SET result_status = 'Pending Approval' WHERE id = $1", [exam.id]);
  res.status(201).json({ success: true, data: keysToCamel(approval) });
}));

// Published result correction / grace marks → approval + version history (EX-16, EX-12 v3 §29).
router.post("/:id/correction", requirePermission("results", "edit"), asyncHandler(async (req, res) => {
  const exam = await getExam(req.params.id);
  const { studentId, subjectId, marksObtained, componentMarks, graceMarks, reason, kind = "correction" } = req.body || {};
  if (!studentId || !subjectId || !String(reason || "").trim()) throw httpError(422, "Student, subject and reason are required.");
  const student = (await query("SELECT name FROM students WHERE id = $1", [studentId])).rows[0];
  const subject = (await query("SELECT name FROM subjects WHERE id = $1", [subjectId])).rows[0];
  const approval = await createApproval(req, {
    type: kind === "grace" ? "grace_marks" : "result_correction",
    title: `${kind === "grace" ? "Grace marks" : "Correction"}: ${student?.name} – ${subject?.name} (${exam.name})`,
    referenceTable: "results", referenceId: `${exam.id}:${studentId}:${subjectId}`,
    payload: { examId: exam.id, studentId, subjectId, marksObtained, componentMarks, graceMarks, reason },
  });
  res.status(201).json({ success: true, data: keysToCamel(approval) });
}));

router.get("/:id/results", requirePermission("results", "view"), asyncHandler(async (req, res) => {
  const rows = (await query(
    `SELECT r.*, s.name AS student_name, s.name_bn, s.photo_url FROM results r JOIN students s ON s.id = r.student_id
     WHERE r.exam_id = $1 AND ($2::text IS NULL OR r.class_id = $2) AND ($3::text IS NULL OR r.section = $3)
     ORDER BY r.class_name, r.class_position NULLS LAST`,
    [req.params.id, req.query.classId || null, req.query.section || null],
  )).rows;
  res.json({ success: true, data: keysToCamel(rows) });
}));

// Tabulation sheet (EX-17): student x subject grid.
router.get("/:id/tabulation", requirePermission("results", "view"), asyncHandler(async (req, res) => {
  if (!req.query.classId) throw httpError(422, "classId is required.");
  const rows = (await query(
    `SELECT r.*, s.name AS student_name FROM results r JOIN students s ON s.id = r.student_id
     WHERE r.exam_id = $1 AND r.class_id = $2 ORDER BY NULLIF(regexp_replace(COALESCE(r.roll,''), '\\D', '', 'g'), '')::int NULLS LAST`,
    [req.params.id, req.query.classId],
  )).rows;
  const subjects = [];
  const seen = new Set();
  for (const r of rows) for (const s of r.subjects || []) if (!seen.has(s.subjectId)) { seen.add(s.subjectId); subjects.push({ id: s.subjectId, name: s.subjectName, code: s.subjectCode }); }
  res.json({ success: true, data: keysToCamel({ subjects, rows }) });
}));

// Analytics (EX-18): subject-wise performance, failed list, class comparison, teacher-wise.
router.get("/:id/analytics", requirePermission("results", "view"), asyncHandler(async (req, res) => {
  const exam = await getExam(req.params.id);
  const results = (await query(
    `SELECT r.*, s.name AS student_name FROM results r JOIN students s ON s.id = r.student_id WHERE r.exam_id = $1`,
    [exam.id],
  )).rows;
  const subjectStats = new Map();
  const classStats = new Map();
  const failed = [];
  const gradeDist = {};
  for (const r of results) {
    gradeDist[r.grade] = (gradeDist[r.grade] || 0) + 1;
    const c = classStats.get(r.class_name) || { className: r.class_name, students: 0, passed: 0, gpaSum: 0, aplus: 0 };
    c.students += 1; if (r.status === "Pass") c.passed += 1; c.gpaSum += Number(r.gpa); if (r.grade === "A+" || r.grade === "A*" || r.grade === "Mumtaz") c.aplus += 1;
    classStats.set(r.class_name, c);
    if (r.status === "Fail") failed.push({ studentId: r.student_id, name: r.student_name, className: r.class_name, roll: r.roll, failedSubjects: (r.subjects || []).filter((s) => !s.passed).map((s) => s.subjectName) });
    for (const s of r.subjects || []) {
      if (!s.counted) continue;
      const key = `${r.class_id}:${s.subjectId}`;
      const st = subjectStats.get(key) || { classId: r.class_id, className: r.class_name, subjectId: s.subjectId, subjectName: s.subjectName, students: 0, passed: 0, totalPct: 0, highest: 0 };
      st.students += 1; if (s.passed) st.passed += 1; st.totalPct += Number(s.percentage); st.highest = Math.max(st.highest, Number(s.obtained));
      subjectStats.set(key, st);
    }
  }
  const teacherMap = new Map((await query(
    `SELECT ca.class_id, ca.subject_id, t.name FROM class_assignments ca JOIN teachers t ON t.id = ca.teacher_id`,
  )).rows.map((r) => [`${r.class_id}:${r.subject_id}`, r.name]));
  res.json({
    success: true,
    data: {
      exam: exam.name,
      totals: { students: results.length, passed: results.filter((r) => r.status === "Pass").length, failed: failed.length },
      gradeDistribution: gradeDist,
      classes: [...classStats.values()].map((c) => ({ ...c, passRate: c.students ? Math.round((c.passed / c.students) * 1000) / 10 : 0, avgGpa: c.students ? Math.round((c.gpaSum / c.students) * 100) / 100 : 0 })),
      subjects: [...subjectStats.entries()].map(([k, s]) => ({ ...s, teacher: teacherMap.get(k) || null, passRate: s.students ? Math.round((s.passed / s.students) * 1000) / 10 : 0, avgPercent: s.students ? Math.round((s.totalPct / s.students) * 10) / 10 : 0 })),
      failed,
    },
  });
}));

// Combined/weighted result (EX-10 v3 §29, v1 EX-15): marks = Σ weight × percentage.
async function buildCombinedMarks(exam, req) {
  const parts = exam.combined_from || [];
  const totalWeight = parts.reduce((s, p) => s + Number(p.weight || 0), 0);
  if (Math.abs(totalWeight - 100) > 0.01) throw httpError(422, "Combined exam weights must add up to 100%.");
  await transaction(async (client) => {
    const source = (await client.query(
      `SELECT m.*, e.id AS src_exam FROM marks m JOIN exams e ON e.name = m.exam WHERE e.id = ANY($1)`,
      [parts.map((p) => p.examId)],
    )).rows;
    const agg = new Map();
    for (const m of source) {
      const w = Number(parts.find((p) => p.examId === m.src_exam)?.weight || 0) / 100;
      const key = `${m.student_id}:${m.subject_id}`;
      const a = agg.get(key) || { student_id: m.student_id, subject_id: m.subject_id, class_id: m.class_id, pct: 0, absentAll: true, full: Number(m.full_marks), pass: Number(m.pass_marks) };
      a.pct += w * (Number(m.marks_obtained) / Number(m.full_marks || 100)) * 100;
      if (!m.is_absent) a.absentAll = false;
      agg.set(key, a);
    }
    for (const a of agg.values()) {
      await client.query(
        `INSERT INTO marks (exam_id, exam, class_id, student_id, subject_id, marks_obtained, full_marks, pass_marks, is_absent, entered_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (exam, student_id, subject_id) DO UPDATE SET marks_obtained = EXCLUDED.marks_obtained, is_absent = EXCLUDED.is_absent`,
        [exam.id, exam.name, a.class_id, a.student_id, a.subject_id, Math.round((a.pct / 100) * a.full * 100) / 100, a.full, a.pass, a.absentAll, req.user.id],
      );
    }
  });
}

module.exports = router;
