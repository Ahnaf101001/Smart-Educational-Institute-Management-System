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
const { gradeSubject, combineSubjects, resolveScale } = require("../services/grading");

const router = express.Router();

async function loadExam(examIdOrName) {
  const exam = (await query("SELECT * FROM exams WHERE id = $1 OR name = $1 ORDER BY created_at DESC LIMIT 1", [examIdOrName])).rows[0];
  return exam || null;
}

async function subjectSpec(examId, classId, subjectId) {
  const sched = examId ? (await query("SELECT * FROM exam_schedules WHERE exam_id = $1 AND class_id = $2 AND subject_id = $3", [examId, classId, subjectId])).rows[0] : null;
  const subject = (await query("SELECT * FROM subjects WHERE id = $1", [subjectId])).rows[0];
  if (!subject) throw httpError(404, `Subject ${subjectId} not found.`);
  const components = (sched?.components?.length ? sched.components : subject.components) || [];
  return {
    subject,
    fullMarks: Number(sched?.full_marks ?? subject.full_marks ?? 100),
    passMarks: Number(sched?.pass_marks ?? subject.pass_marks ?? 33),
    components,
  };
}

// Checks the teacher is assigned to this class/subject (EX-06, GDX-08).
async function assertCanEnter(req, classId, subjectId) {
  if (req.user.isAdmin || hasPermission(req.user, "marks", "approve") || hasPermission(req.user, "exams", "edit")) return;
  if (req.user.linkedType !== "Teacher") throw httpError(403, "Only assigned subject teachers can enter marks.");
  const assigned = await query(
    `SELECT 1 FROM class_assignments WHERE class_id = $1 AND subject_id = $2 AND teacher_id = $3
     UNION SELECT 1 FROM subjects WHERE id = $2 AND teacher_id = $3`,
    [classId, subjectId, req.user.linkedId],
  );
  if (!assigned.rowCount) throw httpError(403, "You are not assigned to this subject for this class.");
}

async function entryStatus(client, exam, classId, subjectId) {
  if (!exam) return { status: "Open" };
  let row = (await client.query("SELECT * FROM marks_entry_status WHERE exam_id = $1 AND class_id = $2 AND subject_id = $3", [exam.id, classId, subjectId])).rows[0];
  if (!row) {
    row = (await client.query(
      "INSERT INTO marks_entry_status (exam_id, class_id, subject_id) VALUES ($1,$2,$3) ON CONFLICT (exam_id, class_id, subject_id) DO UPDATE SET updated_at = NOW() RETURNING *",
      [exam.id, classId, subjectId],
    )).rows[0];
  }
  // EX-10: auto-lock after deadline.
  if (exam.marks_entry_end && new Date(exam.marks_entry_end) < new Date(new Date().toISOString().slice(0, 10)) && row.status === "Open") {
    row = (await client.query("UPDATE marks_entry_status SET status = 'Locked', locked_at = NOW() WHERE id = $1 RETURNING *", [row.id])).rows[0];
  }
  return row;
}

function validateRecord(spec, rec) {
  if (rec.isAbsent || rec.isExempt) return null;
  if (spec.components.length && rec.componentMarks && Object.keys(rec.componentMarks).length) {
    for (const comp of spec.components) {
      const v = rec.componentMarks[comp.key];
      if (v === undefined || v === null || v === "") continue;
      if (Number.isNaN(Number(v)) || Number(v) < 0) return `${comp.label}: invalid value`;
      if (Number(v) > Number(comp.fullMarks)) return `${comp.label}: ${v} exceeds full marks ${comp.fullMarks}`;
    }
    return null;
  }
  const v = rec.marksObtained;
  if (v === undefined || v === null || v === "") return null;
  if (Number.isNaN(Number(v)) || Number(v) < 0) return "Invalid marks";
  if (Number(v) > spec.fullMarks) return `${v} exceeds full marks ${spec.fullMarks}`;
  return null;
}

router.get("/", requirePermission("marks", "view"), asyncHandler(async (req, res) => {
  const { exam, classId, studentId, examId } = req.query;
  const values = [];
  const conditions = [];
  for (const [column, value] of [["exam", exam], ["exam_id", examId], ["class_id", classId], ["student_id", studentId]]) {
    if (value) { values.push(value); conditions.push(`m.${column} = $${values.length}`); }
  }
  const result = await query(
    `SELECT m.*, s.name AS student_name, s.roll, sub.name AS subject_name, sub.code AS subject_code
     FROM marks m JOIN students s ON s.id = m.student_id JOIN subjects sub ON sub.id = m.subject_id
     ${conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""} ORDER BY s.roll, sub.name`,
    values,
  );
  res.json({ success: true, data: keysToCamel(result.rows) });
}));

// Marks sheet for one exam/class/subject (roll-wise grid, EX-07).
router.get("/sheet", requirePermission("marks", "view"), asyncHandler(async (req, res) => {
  const { examId, classId, subjectId, section } = req.query;
  if (!examId || !classId || !subjectId) throw httpError(422, "examId, classId and subjectId are required.");
  const exam = await loadExam(examId);
  if (!exam) throw httpError(404, "Exam not found.");
  const spec = await subjectSpec(exam.id, classId, subjectId);
  const status = await entryStatus({ query }, exam, classId, subjectId);
  const students = (await query(
    `SELECT s.id, s.name, s.roll, s.section, m.marks_obtained, m.component_marks, m.is_absent, m.is_exempt, m.grace_marks
     FROM students s LEFT JOIN marks m ON m.student_id = s.id AND m.subject_id = $2 AND m.exam = $3
     WHERE s.class_id = $1 AND s.status = 'Active' AND ($4::text IS NULL OR s.section = $4)
     ORDER BY NULLIF(regexp_replace(COALESCE(s.roll,''), '\\D', '', 'g'), '')::int NULLS LAST, s.name`,
    [classId, subjectId, exam.name, section || null],
  )).rows;
  res.json({
    success: true,
    data: keysToCamel({
      exam: { id: exam.id, name: exam.name, marksEntryStart: exam.marks_entry_start, marksEntryEnd: exam.marks_entry_end, resultStatus: exam.result_status },
      subject: { id: spec.subject.id, name: spec.subject.name, code: spec.subject.code },
      fullMarks: spec.fullMarks, passMarks: spec.passMarks, components: spec.components,
      entryStatus: status.status, students,
    }),
  });
}));

const entrySchema = z.object({
  examId: z.string().min(1),
  classId: z.string().min(1),
  subjectId: z.string().min(1),
  submit: z.boolean().optional(),
  records: z.array(z.object({
    studentId: z.string().min(1),
    marksObtained: z.union([z.number(), z.string(), z.null()]).optional(),
    componentMarks: z.record(z.string(), z.union([z.number(), z.string(), z.null()])).optional().nullable(),
    isAbsent: z.boolean().optional(),
    isExempt: z.boolean().optional(),
  })).min(1),
});

// Save draft / submit marks for a subject (TA-04, EX-07..10).
router.put("/entry", requirePermission("marks", "create"), validate(entrySchema), asyncHandler(async (req, res) => {
  const { examId, classId, subjectId, records, submit } = req.body;
  await assertCanEnter(req, classId, subjectId);
  const exam = await loadExam(examId);
  if (!exam) throw httpError(404, "Exam not found.");
  if (exam.result_status === "Published") throw httpError(409, "Results are published. Use the result correction workflow.");
  if (exam.marks_entry_start && new Date(exam.marks_entry_start) > new Date()) throw httpError(409, `Marks entry opens on ${String(exam.marks_entry_start).slice(0, 10)}.`);
  const spec = await subjectSpec(exam.id, classId, subjectId);

  const errors = records.map((r) => ({ studentId: r.studentId, error: validateRecord(spec, r) })).filter((e) => e.error);
  if (errors.length) throw httpError(422, "Some marks are invalid.", { errors });

  const result = await transaction(async (client) => {
    const status = await entryStatus(client, exam, classId, subjectId);
    if (["Submitted", "Locked", "Unlock Requested"].includes(status.status) && !req.user.isAdmin) {
      throw httpError(409, "Marks are locked for this subject. Request an unlock from the Principal.");
    }
    let saved = 0;
    for (const r of records) {
      const compMarks = r.componentMarks ? Object.fromEntries(Object.entries(r.componentMarks).filter(([, v]) => v !== "" && v !== null).map(([k, v]) => [k, Number(v)])) : {};
      const hasComp = Object.keys(compMarks).length > 0;
      const obtained = r.isAbsent || r.isExempt ? 0 : hasComp ? Object.values(compMarks).reduce((s, v) => s + v, 0) : Number(r.marksObtained || 0);
      if (!hasComp && (r.marksObtained === "" || r.marksObtained === null || r.marksObtained === undefined) && !r.isAbsent && !r.isExempt) continue;
      await client.query(
        `INSERT INTO marks (exam_id, exam, class_id, student_id, subject_id, marks_obtained, full_marks, pass_marks, component_marks, is_absent, is_exempt, entered_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         ON CONFLICT (exam, student_id, subject_id) DO UPDATE SET exam_id = EXCLUDED.exam_id, class_id = EXCLUDED.class_id,
           marks_obtained = EXCLUDED.marks_obtained, full_marks = EXCLUDED.full_marks, pass_marks = EXCLUDED.pass_marks,
           component_marks = EXCLUDED.component_marks, is_absent = EXCLUDED.is_absent, is_exempt = EXCLUDED.is_exempt, entered_by = EXCLUDED.entered_by`,
        [exam.id, exam.name, classId, r.studentId, subjectId, obtained, spec.fullMarks, spec.passMarks, JSON.stringify(compMarks), Boolean(r.isAbsent), Boolean(r.isExempt), req.user.id],
      );
      saved += 1;
    }
    if (submit) {
      await client.query(
        "UPDATE marks_entry_status SET status = 'Submitted', submitted_by = $1, submitted_at = NOW(), locked_at = NOW(), teacher_id = COALESCE(teacher_id, $2) WHERE id = $3",
        [req.user.name, req.user.linkedId || null, status.id],
      );
    }
    if (exam.result_status === "Draft") await client.query("UPDATE exams SET result_status = 'Marks Entry' WHERE id = $1", [exam.id]);
    await writeAudit(req, { entity: "marks", entityId: `${exam.id}:${classId}:${subjectId}`, action: submit ? "SUBMIT" : "SAVE_DRAFT", newValue: { saved } }, client);
    return { saved, submitted: Boolean(submit) };
  });
  res.json({ success: true, data: result, message: submit ? "Marks submitted and locked." : "Draft saved." });
}));

// Legacy bulk endpoint used by the original marks grid; same validation rules.
const bulkSchema = z.object({
  exam: z.string().min(1),
  examId: z.string().optional().nullable(),
  classId: z.string().min(1),
  records: z.array(z.object({ studentId: z.string().min(1), marks: z.record(z.string(), z.coerce.number().min(0)) })).min(1),
});
router.put("/bulk", requirePermission("marks", "create"), validate(bulkSchema), asyncHandler(async (req, res) => {
  const { exam: examName, examId, classId, records } = req.body;
  const exam = await loadExam(examId || examName);
  if (exam?.result_status === "Published") throw httpError(409, "Results are published. Use the result correction workflow.");
  const subjects = [...new Set(records.flatMap((r) => Object.keys(r.marks)))];
  const specs = {};
  for (const sid of subjects) {
    await assertCanEnter(req, classId, sid);
    specs[sid] = await subjectSpec(exam?.id, classId, sid);
    const status = await entryStatus({ query }, exam, classId, sid);
    if (["Submitted", "Locked", "Unlock Requested"].includes(status.status) && !req.user.isAdmin) {
      throw httpError(409, `Marks for ${specs[sid].subject.name} are locked.`);
    }
  }
  const errors = [];
  for (const r of records) for (const [sid, v] of Object.entries(r.marks)) if (v > specs[sid].fullMarks) errors.push({ studentId: r.studentId, subjectId: sid, error: `${v} exceeds full marks ${specs[sid].fullMarks}` });
  if (errors.length) throw httpError(422, "Marks exceed full marks.", { errors });
  await transaction(async (client) => {
    for (const record of records) {
      for (const [subjectId, marksObtained] of Object.entries(record.marks)) {
        await client.query(
          `INSERT INTO marks (exam_id, exam, class_id, student_id, subject_id, marks_obtained, full_marks, pass_marks, entered_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           ON CONFLICT (exam, student_id, subject_id) DO UPDATE SET exam_id = EXCLUDED.exam_id, class_id = EXCLUDED.class_id,
             marks_obtained = EXCLUDED.marks_obtained, full_marks = EXCLUDED.full_marks, pass_marks = EXCLUDED.pass_marks, entered_by = EXCLUDED.entered_by`,
          [exam?.id || examId || null, exam?.name || examName, classId, record.studentId, subjectId, marksObtained, specs[subjectId].fullMarks, specs[subjectId].passMarks, req.user.id],
        );
      }
    }
    await writeAudit(req, { entity: "marks", entityId: `${examName}:${classId}`, action: "SAVE", newValue: { students: records.length } }, client);
  });
  res.json({ success: true, message: "Marks saved successfully." });
}));

router.post("/submit", requirePermission("marks", "create"), asyncHandler(async (req, res) => {
  const { examId, classId, subjectId } = req.body || {};
  await assertCanEnter(req, classId, subjectId);
  const exam = await loadExam(examId);
  const status = await entryStatus({ query }, exam, classId, subjectId);
  await query("UPDATE marks_entry_status SET status = 'Submitted', submitted_by = $1, submitted_at = NOW(), locked_at = NOW() WHERE id = $2", [req.user.name, status.id]);
  await writeAudit(req, { entity: "marks_entry_status", entityId: status.id, action: "SUBMIT_LOCK" });
  res.json({ success: true });
}));

// Unlock request → Principal approval (EX-10, EX-07 v3 §29).
router.post("/unlock-request", requirePermission("marks", "create"), asyncHandler(async (req, res) => {
  const { examId, classId, subjectId, reason } = req.body || {};
  if (!String(reason || "").trim()) throw httpError(422, "A reason is required for unlocking marks.");
  const exam = await loadExam(examId);
  if (!exam) throw httpError(404, "Exam not found.");
  const subject = (await query("SELECT name FROM subjects WHERE id = $1", [subjectId])).rows[0];
  const status = await entryStatus({ query }, exam, classId, subjectId);
  const approval = await transaction(async (client) => {
    await client.query("UPDATE marks_entry_status SET status = 'Unlock Requested' WHERE id = $1", [status.id]);
    return createApproval(req, {
      type: "marks_unlock", title: `Unlock ${subject?.name || subjectId} – ${exam.name} (${classId})`,
      referenceTable: "marks_entry_status", referenceId: status.id, payload: { examId: exam.id, classId, subjectId, reason },
    }, client);
  });
  res.status(201).json({ success: true, data: keysToCamel(approval) });
}));

// Marks entry progress dashboard (EX-11): submitted / pending / missing teacher list.
router.get("/progress", requirePermission("marks", "view"), asyncHandler(async (req, res) => {
  const exam = await loadExam(req.query.examId);
  if (!exam) throw httpError(404, "Exam not found.");
  const rows = (await query(
    `WITH pairs AS (
       SELECT DISTINCT es.class_id, es.subject_id FROM exam_schedules es WHERE es.exam_id = $1
       UNION SELECT DISTINCT cs.class_id, cs.subject_id FROM class_subjects cs
         WHERE (jsonb_array_length($2::jsonb) = 0 OR $2::jsonb ? cs.class_id)
           AND NOT EXISTS (SELECT 1 FROM exam_schedules x WHERE x.exam_id = $1))
     SELECT p.class_id, c.name AS class_name, p.subject_id, sub.name AS subject_name,
            COALESCE(mes.status, 'Open') AS status, mes.submitted_by, mes.submitted_at,
            t.name AS teacher_name,
            (SELECT COUNT(*)::int FROM marks m WHERE m.exam = $3 AND m.class_id = p.class_id AND m.subject_id = p.subject_id) AS entered,
            (SELECT COUNT(*)::int FROM students s WHERE s.class_id = p.class_id AND s.status = 'Active') AS students
     FROM pairs p JOIN classes c ON c.id = p.class_id JOIN subjects sub ON sub.id = p.subject_id
     LEFT JOIN marks_entry_status mes ON mes.exam_id = $1 AND mes.class_id = p.class_id AND mes.subject_id = p.subject_id
     LEFT JOIN LATERAL (SELECT teacher_id FROM class_assignments ca WHERE ca.class_id = p.class_id AND ca.subject_id = p.subject_id LIMIT 1) ca ON TRUE
     LEFT JOIN teachers t ON t.id = COALESCE(ca.teacher_id, sub.teacher_id)
     ORDER BY c.sort_order, c.name, sub.name`,
    [exam.id, JSON.stringify(exam.class_ids || []), exam.name],
  )).rows;
  const isOverdue = exam.marks_entry_end && new Date(exam.marks_entry_end) < new Date();
  const data = rows.map((r) => ({ ...r, overdue: Boolean(isOverdue && r.status === "Open") }));
  res.json({
    success: true,
    data: keysToCamel({
      exam: { id: exam.id, name: exam.name, marksEntryEnd: exam.marks_entry_end },
      summary: {
        total: data.length,
        submitted: data.filter((r) => ["Submitted", "Locked"].includes(r.status)).length,
        pending: data.filter((r) => r.status === "Open").length,
        overdue: data.filter((r) => r.overdue).length,
      },
      rows: data,
    }),
  });
}));

// Marksheet – uses processed results when available, otherwise computes live.
router.get("/marksheet/:studentId", requirePermission("results", "view"), asyncHandler(async (req, res) => {
  const examKey = req.query.exam || req.query.examId;
  if (!examKey) throw httpError(422, "The exam query parameter is required.");
  const exam = await loadExam(examKey);
  const student = (await query("SELECT * FROM students WHERE id = $1", [req.params.studentId])).rows[0];
  if (!student) throw httpError(404, "Student not found.");

  if (exam) {
    const r = (await query("SELECT * FROM results WHERE exam_id = $1 AND student_id = $2", [exam.id, student.id])).rows[0];
    if (r) {
      return res.json({
        success: true,
        data: keysToCamel({
          student, exam: exam.name, examId: exam.id, published: r.published, version: r.version,
          subjects: (r.subjects || []).map((s) => ({ ...s, subjectName: s.subjectName, marksObtained: s.obtained, status: s.passed ? "Pass" : "Fail" })),
          summary: {
            totalMarks: Number(r.total_marks), maximumMarks: Number(r.max_marks), percentage: Number(r.percentage),
            gpa: Number(r.gpa).toFixed(2), gpaWithoutFourth: Number(r.gpa_without_fourth).toFixed(2), finalGrade: r.grade,
            status: r.status === "Pass" ? "PASS" : "FAIL", classPosition: r.class_position, sectionPosition: r.section_position,
          },
        }),
      });
    }
  }
  const examName = exam?.name || examKey;
  const marks = (await query(
    `SELECT m.*, sub.name AS subject_name, sub.code AS subject_code, sub.components FROM marks m JOIN subjects sub ON sub.id = m.subject_id
     WHERE m.student_id = $1 AND m.exam = $2 ORDER BY sub.name`,
    [student.id, examName],
  )).rows;
  const cls = student.class_id ? (await query("SELECT * FROM classes WHERE id = $1", [student.class_id])).rows[0] : null;
  const scale = await resolveScale(exam, cls);
  const subjects = marks.map((m) => ({
    subjectId: m.subject_id, subjectName: m.subject_name, subjectCode: m.subject_code,
    ...gradeSubject({ marksObtained: m.marks_obtained, componentMarks: m.component_marks, isAbsent: m.is_absent, isExempt: m.is_exempt, graceMarks: m.grace_marks },
      { fullMarks: m.full_marks, passMarks: m.pass_marks, components: m.components }, scale),
  }));
  const summary = combineSubjects(subjects, scale, student.fourth_subject_id);
  res.json({
    success: true,
    data: keysToCamel({
      student, exam: examName, published: false,
      subjects: subjects.map((s) => ({ ...s, marksObtained: s.obtained, status: s.passed ? "Pass" : "Fail" })),
      summary: { totalMarks: summary.totalMarks, maximumMarks: summary.maxMarks, percentage: summary.percentage, gpa: summary.gpa.toFixed(2), finalGrade: summary.grade, status: summary.status === "Pass" ? "PASS" : "FAIL" },
    }),
  });
}));

module.exports = router;
