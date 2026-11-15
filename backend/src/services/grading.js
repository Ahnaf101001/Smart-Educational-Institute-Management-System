// Grading & result engine (SRS EX-09..16/20, PC-18..24, ACA-03/04).
const { query, transaction } = require("../db/pool");
const httpError = require("../utils/httpError");

const GRADE_TEMPLATES = {
  nctb_gpa5: {
    name: "NCTB GPA 5.0 (SSC/HSC/JSC)",
    institutionType: "Bangla Medium",
    scaleType: "GPA",
    maxPoint: 5,
    failGrade: "F",
    fourthSubjectThreshold: 2,
    bands: [
      { min: 80, max: 100, grade: "A+", point: 5.0, label: "Outstanding" },
      { min: 70, max: 79.99, grade: "A", point: 4.0, label: "Excellent" },
      { min: 60, max: 69.99, grade: "A-", point: 3.5, label: "Very Good" },
      { min: 50, max: 59.99, grade: "B", point: 3.0, label: "Good" },
      { min: 40, max: 49.99, grade: "C", point: 2.0, label: "Satisfactory" },
      { min: 33, max: 39.99, grade: "D", point: 1.0, label: "Pass" },
      { min: 0, max: 32.99, grade: "F", point: 0.0, label: "Fail" },
    ],
  },
  bmeb_gpa5: {
    name: "Alia Madrasa GPA 5.0 (BMEB: Dakhil/Alim)",
    institutionType: "Alia Madrasa",
    scaleType: "GPA",
    maxPoint: 5,
    failGrade: "F",
    fourthSubjectThreshold: 2,
    bands: [
      { min: 80, max: 100, grade: "A+", point: 5.0, label: "Mumtaz" },
      { min: 70, max: 79.99, grade: "A", point: 4.0, label: "Excellent" },
      { min: 60, max: 69.99, grade: "A-", point: 3.5, label: "Very Good" },
      { min: 50, max: 59.99, grade: "B", point: 3.0, label: "Good" },
      { min: 40, max: 49.99, grade: "C", point: 2.0, label: "Satisfactory" },
      { min: 33, max: 39.99, grade: "D", point: 1.0, label: "Pass" },
      { min: 0, max: 32.99, grade: "F", point: 0.0, label: "Fail" },
    ],
  },
  qawmi_division: {
    name: "Qawmi Madrasa Division (Befaq: Mumtaz–Rasib)",
    institutionType: "Qawmi Madrasa",
    scaleType: "Division",
    maxPoint: 4,
    failGrade: "Rasib",
    fourthSubjectThreshold: 0,
    bands: [
      { min: 80, max: 100, grade: "Mumtaz", point: 4, label: "ممتاز" },
      { min: 65, max: 79.99, grade: "Jayyid Jiddan", point: 3, label: "جيد جدا" },
      { min: 50, max: 64.99, grade: "Jayyid", point: 2, label: "جيد" },
      { min: 33, max: 49.99, grade: "Maqbul", point: 1, label: "مقبول" },
      { min: 0, max: 32.99, grade: "Rasib", point: 0, label: "راسب" },
    ],
  },
  cambridge_letter: {
    name: "Cambridge / Edexcel Letter (A*–U)",
    institutionType: "English Medium",
    scaleType: "Letter",
    maxPoint: 6,
    failGrade: "U",
    fourthSubjectThreshold: 0,
    bands: [
      { min: 90, max: 100, grade: "A*", point: 6, label: "Exceptional" },
      { min: 80, max: 89.99, grade: "A", point: 5, label: "Excellent" },
      { min: 70, max: 79.99, grade: "B", point: 4, label: "Very Good" },
      { min: 60, max: 69.99, grade: "C", point: 3, label: "Good" },
      { min: 50, max: 59.99, grade: "D", point: 2, label: "Satisfactory" },
      { min: 40, max: 49.99, grade: "E", point: 1, label: "Pass" },
      { min: 0, max: 39.99, grade: "U", point: 0, label: "Ungraded" },
    ],
  },
  kindergarten: {
    name: "Kindergarten / Pre-school",
    institutionType: "Kindergarten",
    scaleType: "Letter",
    maxPoint: 4,
    failGrade: "NI",
    fourthSubjectThreshold: 0,
    bands: [
      { min: 85, max: 100, grade: "Excellent", point: 4, label: "Star" },
      { min: 70, max: 84.99, grade: "Very Good", point: 3, label: "Shining" },
      { min: 55, max: 69.99, grade: "Good", point: 2, label: "Growing" },
      { min: 40, max: 54.99, grade: "Fair", point: 1, label: "Developing" },
      { min: 0, max: 39.99, grade: "NI", point: 0, label: "Needs Improvement" },
    ],
  },
};

function truncate2(value) {
  return Math.floor(Number(value) * 100 + 1e-9) / 100;
}

function bandFor(percentage, scale) {
  const bands = [...(scale.bands || [])].sort((a, b) => Number(b.min) - Number(a.min));
  return bands.find((b) => percentage >= Number(b.min)) || bands[bands.length - 1] || { grade: "F", point: 0 };
}

function gradeForGpa(gpa, scale) {
  const bands = [...(scale.bands || [])].sort((a, b) => Number(b.point) - Number(a.point));
  return bands.find((b) => gpa >= Number(b.point)) || bands[bands.length - 1];
}

function normalizeScale(row) {
  if (!row) return { ...GRADE_TEMPLATES.nctb_gpa5 };
  return {
    id: row.id,
    name: row.name,
    scaleType: row.scale_type || row.scaleType || "GPA",
    maxPoint: Number(row.max_point ?? row.maxPoint ?? 5),
    failGrade: row.fail_grade || row.failGrade || "F",
    fourthSubjectThreshold: Number(row.fourth_subject_threshold ?? row.fourthSubjectThreshold ?? 2),
    bands: row.bands || [],
  };
}

// Grades one subject. `subject` = { fullMarks, passMarks, components:[{key,label,fullMarks,passMarks}] }
function gradeSubject(mark, subject, scale) {
  const fullMarks = Number(subject.fullMarks || 100);
  const passMarks = Number(subject.passMarks ?? 33);
  const components = Array.isArray(subject.components) ? subject.components : [];
  const grace = Number(mark?.graceMarks || 0);

  if (!mark || mark.isExempt) {
    return { exempt: Boolean(mark?.isExempt), missing: !mark, obtained: 0, fullMarks, percentage: 0, grade: "-", point: 0, passed: true, counted: false };
  }
  if (mark.isAbsent) {
    return { absent: true, obtained: 0, fullMarks, percentage: 0, grade: scale.failGrade, point: 0, passed: false, counted: true, failReason: "Absent" };
  }

  let obtained;
  const componentResults = [];
  let componentFailed = false;
  const cm = mark.componentMarks || {};
  if (components.length && Object.keys(cm).length) {
    obtained = 0;
    for (const comp of components) {
      const value = Number(cm[comp.key] ?? 0);
      const passed = comp.passMarks === undefined || comp.passMarks === null || value >= Number(comp.passMarks);
      if (!passed) componentFailed = true;
      obtained += value;
      componentResults.push({ key: comp.key, label: comp.label, obtained: value, fullMarks: Number(comp.fullMarks), passMarks: comp.passMarks, passed });
    }
  } else {
    obtained = Number(mark.marksObtained || 0);
  }
  obtained = Math.min(fullMarks, obtained + grace);

  const percentage = fullMarks ? (obtained / fullMarks) * 100 : 0;
  const totalPassed = obtained >= passMarks;
  const passed = totalPassed && !componentFailed;
  const band = passed ? bandFor(percentage, scale) : { grade: scale.failGrade, point: 0 };
  return {
    obtained,
    fullMarks,
    percentage: Math.round(percentage * 100) / 100,
    grade: band.grade,
    point: Number(band.point),
    passed,
    counted: true,
    components: componentResults,
    failReason: passed ? null : componentFailed ? "Component pass mark not met" : "Below pass marks",
  };
}

// Combines subject grades into a final result (NCTB: 4th subject adds points above threshold).
function combineSubjects(subjectResults, scale, fourthSubjectId) {
  const counted = subjectResults.filter((s) => s.counted);
  const fourth = counted.find((s) => fourthSubjectId && s.subjectId === fourthSubjectId);
  const compulsory = counted.filter((s) => s !== fourth);

  const totalMarks = counted.reduce((sum, s) => sum + s.obtained, 0);
  const maxMarks = counted.reduce((sum, s) => sum + s.fullMarks, 0);
  const percentage = maxMarks ? (totalMarks / maxMarks) * 100 : 0;
  const failedSubjects = compulsory.filter((s) => !s.passed).length;
  const passed = failedSubjects === 0 && compulsory.length > 0;

  const basePoints = compulsory.reduce((sum, s) => sum + s.point, 0);
  const gpaWithoutFourth = compulsory.length ? truncate2(basePoints / compulsory.length) : 0;
  let gpa = gpaWithoutFourth;
  if (fourth && fourth.passed && scale.scaleType === "GPA") {
    const bonus = Math.max(0, fourth.point - Number(scale.fourthSubjectThreshold || 0));
    gpa = compulsory.length ? Math.min(scale.maxPoint, truncate2((basePoints + bonus) / compulsory.length)) : 0;
  }

  let grade;
  if (!passed) {
    grade = scale.failGrade;
    gpa = 0;
  } else if (scale.scaleType === "GPA") {
    grade = gradeForGpa(gpa, scale)?.grade;
  } else {
    grade = bandFor(percentage, scale).grade;
  }

  return {
    totalMarks: Math.round(totalMarks * 100) / 100,
    maxMarks,
    percentage: Math.round(percentage * 100) / 100,
    gpa: passed ? gpa : 0,
    gpaWithoutFourth: passed ? gpaWithoutFourth : 0,
    grade,
    division: scale.scaleType === "Division" ? grade : null,
    status: passed ? "Pass" : "Fail",
    failedSubjects,
  };
}

// Tie-break: comma separated list of total,gpa,percentage,roll (SRS EX-13).
function rankResults(rows, rule = "total,gpa,roll") {
  const keys = String(rule || "total,gpa,roll").split(",").map((k) => k.trim()).filter(Boolean);
  const cmp = (a, b) => {
    if (a.status !== b.status) return a.status === "Pass" ? -1 : 1;
    for (const key of keys) {
      if (key === "roll") {
        const diff = (Number(a.roll) || 1e9) - (Number(b.roll) || 1e9);
        if (diff) return diff;
      } else {
        const field = key === "total" ? "totalMarks" : key;
        const diff = Number(b[field] || 0) - Number(a[field] || 0);
        if (diff) return diff;
      }
    }
    return 0;
  };
  return [...rows].sort(cmp);
}

async function resolveScale(exam, classRow, executor) {
  const run = executor ? executor.query.bind(executor) : query;
  const id = exam?.grade_scale_id || classRow?.grade_scale_id;
  let result;
  if (id) result = await run("SELECT * FROM grade_scales WHERE id = $1", [id]);
  if (!result || !result.rowCount) result = await run("SELECT * FROM grade_scales WHERE is_default ORDER BY created_at LIMIT 1");
  return normalizeScale(result.rows[0]);
}

// Processes results for an exam (all classes, or one class). Published results are
// never silently overwritten; correction must go through the approval workflow.
async function processExamResults(examId, { classId, allowPublished = false, reason, userId } = {}) {
  return transaction(async (client) => {
    const examRes = await client.query("SELECT * FROM exams WHERE id = $1", [examId]);
    if (!examRes.rowCount) throw httpError(404, "Exam not found.");
    const exam = examRes.rows[0];
    if (exam.result_status === "Published" && !allowPublished) {
      throw httpError(409, "Results are already published. Use the result correction workflow.");
    }

    const classFilter = classId ? [classId] : null;
    const marksRes = await client.query(
      `SELECT m.*, s.class_id AS student_class_id, s.class_name AS student_class_name, s.section,
              s.roll, s.fourth_subject_id
       FROM marks m JOIN students s ON s.id = m.student_id
       WHERE (m.exam_id = $1 OR (m.exam_id IS NULL AND m.exam = $2))
         AND ($3::text[] IS NULL OR m.class_id = ANY($3) OR s.class_id = ANY($3))`,
      [examId, exam.name, classFilter],
    );

    const byClass = new Map();
    for (const row of marksRes.rows) {
      const cid = row.class_id || row.student_class_id;
      if (!byClass.has(cid)) byClass.set(cid, new Map());
      const students = byClass.get(cid);
      if (!students.has(row.student_id)) students.set(row.student_id, { info: row, marks: [] });
      students.get(row.student_id).marks.push(row);
    }

    const processed = [];
    for (const [cid, students] of byClass.entries()) {
      const classRes = await client.query("SELECT * FROM classes WHERE id = $1", [cid]);
      const classRow = classRes.rows[0];
      const scale = await resolveScale(exam, classRow, client);

      const schedRes = await client.query(
        `SELECT es.*, sub.name AS subject_name, sub.code AS subject_code, sub.components AS subject_components,
                sub.full_marks AS subject_full, sub.pass_marks AS subject_pass
         FROM exam_schedules es JOIN subjects sub ON sub.id = es.subject_id
         WHERE es.exam_id = $1 AND es.class_id = $2`,
        [examId, cid],
      );
      const scheduleBySubject = new Map(schedRes.rows.map((r) => [r.subject_id, r]));

      const classResults = [];
      for (const [studentId, entry] of students.entries()) {
        const subjectResults = [];
        for (const mark of entry.marks) {
          let subj = scheduleBySubject.get(mark.subject_id);
          if (!subj) {
            const s = await client.query("SELECT * FROM subjects WHERE id = $1", [mark.subject_id]);
            const sr = s.rows[0] || {};
            subj = { subject_name: sr.name, subject_code: sr.code, full_marks: mark.full_marks || sr.full_marks, pass_marks: mark.pass_marks ?? sr.pass_marks, components: sr.components };
          }
          const comps = (subj.components && subj.components.length ? subj.components : subj.subject_components) || [];
          const graded = gradeSubject(
            {
              marksObtained: mark.marks_obtained,
              componentMarks: mark.component_marks,
              isAbsent: mark.is_absent,
              isExempt: mark.is_exempt,
              graceMarks: mark.grace_marks,
            },
            { fullMarks: subj.full_marks ?? mark.full_marks, passMarks: subj.pass_marks ?? mark.pass_marks, components: comps },
            scale,
          );
          subjectResults.push({
            subjectId: mark.subject_id,
            subjectName: subj.subject_name,
            subjectCode: subj.subject_code,
            isFourth: mark.subject_id === entry.info.fourth_subject_id,
            ...graded,
          });
        }
        const combined = combineSubjects(subjectResults, scale, entry.info.fourth_subject_id);
        classResults.push({
          studentId,
          classId: cid,
          className: classRow?.name || entry.info.student_class_name,
          section: entry.info.section,
          roll: entry.info.roll,
          subjects: subjectResults,
          ...combined,
        });
      }

      const ranked = rankResults(classResults, exam.tie_break_rule);
      ranked.forEach((r, i) => { r.classPosition = i + 1; });
      const bySection = new Map();
      for (const r of ranked) {
        const key = r.section || "";
        bySection.set(key, (bySection.get(key) || 0) + 1);
        r.sectionPosition = bySection.get(key);
      }

      for (const r of ranked) {
        const existing = await client.query(
          "SELECT * FROM results WHERE exam_id = $1 AND student_id = $2",
          [examId, r.studentId],
        );
        const values = [
          examId, r.studentId, r.classId, r.className, r.section, r.roll, r.totalMarks, r.maxMarks,
          r.percentage, r.gpa, r.gpaWithoutFourth, r.grade, r.division, r.status, r.classPosition,
          r.sectionPosition, r.failedSubjects, JSON.stringify(r.subjects),
        ];
        if (!existing.rowCount) {
          await client.query(
            `INSERT INTO results (exam_id, student_id, class_id, class_name, section, roll, total_marks, max_marks,
               percentage, gpa, gpa_without_fourth, grade, division, status, class_position, section_position,
               failed_subjects, subjects)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
            values,
          );
        } else {
          const prev = existing.rows[0];
          const isPublished = prev.published;
          if (isPublished) {
            await client.query(
              "INSERT INTO result_versions (result_id, version, snapshot, reason, changed_by) VALUES ($1,$2,$3,$4,$5)",
              [prev.id, prev.version, JSON.stringify(prev), reason || "Result correction", userId || null],
            );
          }
          await client.query(
            `UPDATE results SET class_id=$3, class_name=$4, section=$5, roll=$6, total_marks=$7, max_marks=$8,
               percentage=$9, gpa=$10, gpa_without_fourth=$11, grade=$12, division=$13, status=$14,
               class_position=$15, section_position=$16, failed_subjects=$17, subjects=$18,
               version = version + $19
             WHERE exam_id = $1 AND student_id = $2`,
            [...values, isPublished ? 1 : 0],
          );
        }
        processed.push(r);
      }
    }

    if (exam.result_status === "Draft" || exam.result_status === "Marks Entry") {
      await client.query("UPDATE exams SET result_status = 'Processed' WHERE id = $1", [examId]);
    }
    return { exam: exam.name, processed: processed.length };
  });
}

module.exports = {
  GRADE_TEMPLATES,
  gradeSubject,
  combineSubjects,
  rankResults,
  normalizeScale,
  resolveScale,
  bandFor,
  processExamResults,
  truncate2,
};
