const express = require("express");
const { query, transaction } = require("../db/pool");
const asyncHandler = require("../utils/asyncHandler");
const httpError = require("../utils/httpError");
const { keysToCamel } = require("../utils/case");
const { requirePermission } = require("../middleware/auth");
const { writeAudit } = require("../services/audit");
const { createApproval } = require("../services/approvals");
const {
  upsertGuardian, linkGuardian, findSiblings, ensureGuardianAccount, upsertEnrollment, changeStatus, normalizeMobile,
} = require("../services/students");

const router = express.Router();

// 360° profile: enrollments, guardians, attendance %, dues, results, cards, documents.
router.get("/:id/profile", requirePermission("students", "view"), asyncHandler(async (req, res) => {
  const id = req.params.id;
  const student = (await query("SELECT * FROM students WHERE id = $1", [id])).rows[0];
  if (!student) throw httpError(404, "Student not found.");
  const [enrollments, guardians, attendance, dues, results, cards, documents, history, certificates] = await Promise.all([
    query("SELECT * FROM enrollments WHERE student_id = $1 ORDER BY effective_date DESC", [id]),
    query(`SELECT g.*, gs.relation, gs.is_primary, gs.access_status, gs.id AS link_id FROM guardian_students gs
           JOIN guardians g ON g.id = gs.guardian_id WHERE gs.student_id = $1 ORDER BY gs.is_primary DESC`, [id]),
    query(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status IN ('Present','Late'))::int AS present,
             COUNT(*) FILTER (WHERE status = 'Absent')::int AS absent, COUNT(*) FILTER (WHERE status = 'Late')::int AS late,
             COUNT(*) FILTER (WHERE status = 'Leave')::int AS leave
           FROM attendance WHERE student_id = $1`, [id]),
    query(`SELECT COALESCE(SUM(amount + late_fine - discount - paid_amount), 0) AS due, COUNT(*)::int AS open_invoices
           FROM fee_invoices WHERE student_id = $1 AND status NOT IN ('Paid','Cancelled')`, [id]),
    query(`SELECT r.*, e.name AS exam_name FROM results r JOIN exams e ON e.id = r.exam_id WHERE r.student_id = $1 ORDER BY r.created_at DESC`, [id]),
    query("SELECT * FROM id_cards WHERE holder_type = 'Student' AND holder_id = $1 ORDER BY created_at DESC", [id]),
    query("SELECT * FROM student_documents WHERE owner_type = 'Student' AND owner_id = $1 ORDER BY created_at DESC", [id]),
    query("SELECT * FROM student_status_history WHERE student_id = $1 ORDER BY created_at DESC", [id]),
    query("SELECT * FROM certificates WHERE holder_type = 'Student' AND holder_id = $1 ORDER BY created_at DESC", [id]),
  ]);
  const siblings = student.parent_contact ? await findSiblings({ query }, student.parent_contact, id) : [];
  const canSee = req.user.isAdmin || req.user.canViewSensitive;
  const mask = (v) => (v && !canSee ? `${String(v).slice(0, 3)}*****${String(v).slice(-2)}` : v);
  res.json({
    success: true,
    data: keysToCamel({
      student: { ...student, parent_contact: mask(student.parent_contact), birth_cert_no: mask(student.birth_cert_no) },
      enrollments: enrollments.rows,
      guardians: guardians.rows.map((g) => ({ ...g, mobile: mask(g.mobile), nid: mask(g.nid) })),
      attendance: attendance.rows[0],
      dues: dues.rows[0],
      results: results.rows.filter((r) => r.published || req.user.isAdmin || req.user.matrix?.results?.includes("view")),
      cards: cards.rows,
      documents: documents.rows,
      statusHistory: history.rows,
      certificates: certificates.rows,
      siblings: siblings.filter((s, i, arr) => arr.findIndex((x) => x.id === s.id) === i),
    }),
  });
}));

router.post("/:id/status", requirePermission("students", "edit"), asyncHandler(async (req, res) => {
  const { status, reason } = req.body || {};
  const allowed = ["Applicant", "Active", "Inactive", "Transferred", "Dropped", "Passed Out"];
  if (!allowed.includes(status)) throw httpError(422, `Status must be one of ${allowed.join(", ")}.`);
  if (status !== "Active" && !String(reason || "").trim()) throw httpError(422, "A reason is required.");
  const result = await transaction((client) => changeStatus(client, req, req.params.id, status, reason));
  res.json({ success: true, data: result });
}));

// Sibling detection (v1 GD-03): "This guardian already has students – link?"
router.get("/siblings/check", requirePermission("students", "view"), asyncHandler(async (req, res) => {
  const siblings = await findSiblings({ query }, req.query.mobile, req.query.excludeId || null);
  const guardian = (await query("SELECT id, name, relation_default FROM guardians WHERE mobile = $1", [normalizeMobile(req.query.mobile)])).rows[0];
  res.json({ success: true, data: keysToCamel({ guardian: guardian || null, siblings }) });
}));

// Link (or create) a guardian for a student, optionally creating portal access.
router.post("/:id/guardians", requirePermission("guardians", "create"), asyncHandler(async (req, res) => {
  const { guardianId, name, mobile, relation, email, nid, occupation, isPrimary, createPortal } = req.body || {};
  const result = await transaction(async (client) => {
    let guardian;
    if (guardianId) {
      guardian = (await client.query("SELECT * FROM guardians WHERE id = $1", [guardianId])).rows[0];
      if (!guardian) throw httpError(404, "Guardian not found.");
    } else {
      const up = await upsertGuardian(client, { name, mobile, relation, email, nid, occupation });
      if (!up) throw httpError(422, "A valid guardian mobile number is required.");
      guardian = up.guardian;
    }
    const link = await linkGuardian(client, { guardianId: guardian.id, studentId: req.params.id, relation: relation || guardian.relation_default, isPrimary: Boolean(isPrimary) });
    if (link.is_primary) {
      await client.query("UPDATE students SET parent_contact = $1, guardian_name = $2 WHERE id = $3", [guardian.mobile, guardian.name, req.params.id]);
    }
    let portal = null;
    if (createPortal) portal = await ensureGuardianAccount(client, guardian);
    await writeAudit(req, { entity: "guardian_students", entityId: link.id, action: "LINK", newValue: link }, client);
    return { guardian, link, portal };
  });
  res.status(201).json({ success: true, data: keysToCamel(result) });
}));

router.post("/:id/guardians/:linkId/primary", requirePermission("guardians", "edit"), asyncHandler(async (req, res) => {
  await transaction(async (client) => {
    const link = (await client.query("SELECT * FROM guardian_students WHERE id = $1 AND student_id = $2", [req.params.linkId, req.params.id])).rows[0];
    if (!link) throw httpError(404, "Link not found.");
    await client.query("UPDATE guardian_students SET is_primary = FALSE WHERE student_id = $1", [req.params.id]);
    await client.query("UPDATE guardian_students SET is_primary = TRUE WHERE id = $1", [link.id]);
    const g = (await client.query("SELECT * FROM guardians WHERE id = $1", [link.guardian_id])).rows[0];
    await client.query("UPDATE students SET parent_contact = $1, guardian_name = $2 WHERE id = $3", [g.mobile, g.name, req.params.id]);
    await writeAudit(req, { entity: "guardian_students", entityId: link.id, action: "SET_PRIMARY" }, client);
  });
  res.json({ success: true });
}));

router.delete("/:id/guardians/:linkId", requirePermission("guardians", "delete"), asyncHandler(async (req, res) => {
  const link = (await query("DELETE FROM guardian_students WHERE id = $1 AND student_id = $2 RETURNING *", [req.params.linkId, req.params.id])).rows[0];
  if (!link) throw httpError(404, "Link not found.");
  await writeAudit(req, { entity: "guardian_students", entityId: link.id, action: "UNLINK", oldValue: link });
  res.status(204).send();
}));

// Roll assignment (ST-04): manual, merit-based (latest result) or alphabetical.
router.post("/assign-rolls", requirePermission("students", "edit"), asyncHandler(async (req, res) => {
  const { classId, section, method = "alphabetical", examId, startFrom = 1 } = req.body || {};
  if (!classId) throw httpError(422, "classId is required.");
  const result = await transaction(async (client) => {
    let students;
    if (method === "merit" && examId) {
      students = (await client.query(
        `SELECT s.* FROM students s LEFT JOIN results r ON r.student_id = s.id AND r.exam_id = $3
         WHERE s.class_id = $1 AND ($2::text IS NULL OR s.section = $2) AND s.status = 'Active'
         ORDER BY r.class_position NULLS LAST, s.name`, [classId, section || null, examId],
      )).rows;
    } else {
      students = (await client.query(
        `SELECT * FROM students WHERE class_id = $1 AND ($2::text IS NULL OR section = $2) AND status = 'Active' ORDER BY name`,
        [classId, section || null],
      )).rows;
    }
    // Clear rolls first to avoid transient duplicate-roll conflicts.
    await client.query("UPDATE enrollments SET roll = NULL WHERE class_id = $1 AND ($2::text IS NULL OR section = $2) AND status = 'Active'", [classId, section || null]);
    let n = Number(startFrom) || 1;
    for (const s of students) {
      const roll = String(n).padStart(2, "0");
      await client.query("UPDATE students SET roll = $1 WHERE id = $2", [roll, s.id]);
      await upsertEnrollment(client, { ...s, roll });
      n += 1;
    }
    await writeAudit(req, { entity: "students", entityId: classId, action: "ASSIGN_ROLLS", newValue: { method, section, count: students.length } }, client);
    return { assigned: students.length };
  });
  res.json({ success: true, data: result });
}));

// Promotion preview (ACA-06): proposes next class using latest published result.
router.get("/promotion/preview", requirePermission("students", "view"), asyncHandler(async (req, res) => {
  const { classId, examId, section } = req.query;
  if (!classId) throw httpError(422, "classId is required.");
  const classes = (await query("SELECT id, name, sort_order FROM classes WHERE status <> 'Archived' ORDER BY sort_order, name")).rows;
  const idx = classes.findIndex((c) => c.id === classId);
  const nextClass = idx >= 0 ? classes[idx + 1] : null;
  const rows = (await query(
    `SELECT s.id, s.name, s.roll, s.section, s.class_name, r.status AS result_status, r.gpa, r.grade, r.class_position
     FROM students s LEFT JOIN results r ON r.student_id = s.id AND r.exam_id = $2
     WHERE s.class_id = $1 AND s.status = 'Active' AND ($3::text IS NULL OR s.section = $3)
     ORDER BY r.class_position NULLS LAST, s.roll`,
    [classId, examId || null, section || null],
  )).rows;
  res.json({
    success: true,
    data: keysToCamel({
      nextClass,
      students: rows.map((r) => ({
        ...r,
        decision: !examId ? "Promote" : r.result_status === "Fail" ? "Detain" : nextClass ? "Promote" : "Pass Out",
        next_class_id: nextClass?.id || null,
      })),
    }),
  });
}));

// Bulk promotion goes through approval (ACA-06, ST-07).
router.post("/promotion", requirePermission("students", "edit"), asyncHandler(async (req, res) => {
  const { promotions, targetYearId, title } = req.body || {};
  if (!Array.isArray(promotions) || !promotions.length) throw httpError(422, "No students selected for promotion.");
  const approval = await createApproval(req, {
    type: "student_promotion",
    title: title || `Promotion of ${promotions.length} students`,
    referenceTable: "students",
    payload: { promotions, targetYearId },
  });
  res.status(201).json({ success: true, data: keysToCamel(approval), message: "Promotion submitted for approval." });
}));

// Mid-session class/section transfer (scenario: effective date, history retained).
router.post("/:id/transfer-section", requirePermission("students", "edit"), asyncHandler(async (req, res) => {
  const { classId, section, effectiveDate, reason } = req.body || {};
  const data = await transaction(async (client) => {
    const s = (await client.query("SELECT * FROM students WHERE id = $1 FOR UPDATE", [req.params.id])).rows[0];
    if (!s) throw httpError(404, "Student not found.");
    const cls = (await client.query("SELECT * FROM classes WHERE id = $1", [classId || s.class_id])).rows[0];
    const className = `${cls?.name || String(s.class_name).split("-")[0]}${section ? `-${section}` : ""}`;
    await client.query("UPDATE enrollments SET status = 'Closed' WHERE student_id = $1 AND status = 'Active'", [s.id]);
    await client.query(
      `INSERT INTO enrollments (student_id, academic_year_id, session_name, class_id, class_name, section, shift, group_name, effective_date, status)
       SELECT $1, academic_year_id, session_name, $2, $3, $4, shift, group_name, COALESCE($5::date, CURRENT_DATE), 'Active'
       FROM enrollments WHERE student_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [s.id, cls?.id || s.class_id, className, section || s.section, effectiveDate || null],
    );
    await client.query("UPDATE students SET class_id = $1, class_name = $2, section = $3, roll = NULL WHERE id = $4", [cls?.id || s.class_id, className, section || s.section, s.id]);
    await writeAudit(req, { entity: "students", entityId: s.id, action: "SECTION_TRANSFER", oldValue: { class: s.class_name }, newValue: { class: className }, reason }, client);
    return { className };
  });
  res.json({ success: true, data });
}));

// Excel/CSV import with preview, duplicate detection & row-level errors (SYS-06, NFX-09).
router.post("/import", requirePermission("students", "create"), asyncHandler(async (req, res) => {
  const { rows = [], commit = false, mode = "valid-only" } = req.body || {};
  if (!Array.isArray(rows) || !rows.length) throw httpError(422, "No rows to import.");
  if (rows.length > 5000) throw httpError(422, "Import is limited to 5000 rows per batch.");

  const classes = new Map((await query("SELECT id, name, sections FROM classes")).rows.map((c) => [c.name.toLowerCase(), c]));
  const seenBirth = new Set();
  const report = [];
  for (const [i, raw] of rows.entries()) {
    const r = Object.fromEntries(Object.entries(raw).map(([k, v]) => [String(k).trim().toLowerCase().replace(/[^a-z0-9]/g, ""), typeof v === "string" ? v.trim() : v]));
    const errors = [];
    const name = r.name || r.studentname || r.nameen;
    const className = r.class || r.classname;
    const cls = className ? classes.get(String(className).toLowerCase()) : null;
    const mobile = normalizeMobile(r.guardianmobile || r.mobile || r.parentcontact || r.fatherphone);
    const birth = r.birthcertificate || r.birthcertno || r.birthcertificateno;
    if (!name) errors.push("Name is required");
    if (!cls) errors.push(`Unknown class "${className || ""}"`);
    if (mobile && !/^01[3-9]\d{8}$/.test(mobile)) errors.push("Invalid Bangladeshi mobile number");
    if (r.dob && Number.isNaN(Date.parse(r.dob))) errors.push("Invalid date of birth");
    if (birth) {
      if (seenBirth.has(birth)) errors.push("Duplicate birth certificate in file");
      seenBirth.add(birth);
      const dup = await query("SELECT id FROM students WHERE birth_cert_no = $1 AND status <> 'Archived'", [birth]);
      if (dup.rowCount) errors.push(`Birth certificate already exists (${dup.rows[0].id})`);
    }
    report.push({
      row: i + 2,
      valid: errors.length === 0,
      errors,
      data: {
        name, nameBn: r.namebn || null, gender: r.gender || null, classId: cls?.id, className: cls?.name,
        section: r.section || null, roll: r.roll || null, dob: r.dob || r.dateofbirth || null, bloodGroup: r.bloodgroup || null,
        birthCertNo: birth || null, guardianName: r.guardianname || r.fathername || null, guardianMobile: mobile || null,
        relation: r.relation || "Father", address: r.address || null, religion: r.religion || null, shift: r.shift || null,
        group: r.group || null,
      },
    });
  }
  const valid = report.filter((r) => r.valid);
  if (!commit) {
    return res.json({ success: true, data: { total: rows.length, valid: valid.length, invalid: rows.length - valid.length, report } });
  }
  if (mode === "all-or-nothing" && valid.length !== rows.length) {
    throw httpError(422, "Import rejected: fix invalid rows or choose valid-only import.", { report: report.filter((r) => !r.valid) });
  }
  const created = await transaction(async (client) => {
    const ids = [];
    for (const item of valid) {
      const d = item.data;
      const s = (await client.query(
        `INSERT INTO students (name, name_bn, gender, class_id, class_name, section, roll, date_of_birth, blood_group,
           birth_cert_no, guardian_name, parent_contact, address, religion, shift, group_name, admission_date, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,CURRENT_DATE,'Active') RETURNING *`,
        [d.name, d.nameBn, d.gender, d.classId, `${d.className}${d.section ? `-${d.section}` : ""}`, d.section, d.roll,
          d.dob, d.bloodGroup, d.birthCertNo, d.guardianName, d.guardianMobile, d.address, d.religion, d.shift, d.group],
      )).rows[0];
      await upsertEnrollment(client, s);
      if (d.guardianMobile) {
        const g = await upsertGuardian(client, { name: d.guardianName, mobile: d.guardianMobile, relation: d.relation });
        if (g) await linkGuardian(client, { guardianId: g.guardian.id, studentId: s.id, relation: d.relation, isPrimary: true });
      }
      ids.push(s.id);
    }
    await writeAudit(req, { entity: "students", action: "IMPORT", newValue: { count: ids.length } }, client);
    return ids;
  });
  res.status(201).json({ success: true, data: { imported: created.length, skipped: rows.length - created.length, report: report.filter((r) => !r.valid) } });
}));

// Certificate request (TC / testimonial / character / study) → approval (ST-09, OPS-03).
router.post("/:id/certificates", requirePermission("certificates", "create"), asyncHandler(async (req, res) => {
  const { certificateType, content } = req.body || {};
  const student = (await query("SELECT * FROM students WHERE id = $1", [req.params.id])).rows[0];
  if (!student) throw httpError(404, "Student not found.");
  const result = await transaction(async (client) => {
    const cert = (await client.query(
      `INSERT INTO certificates (certificate_type, holder_type, holder_id, holder_name, content, requested_by)
       VALUES ($1, 'Student', $2, $3, $4, $5) RETURNING *`,
      [certificateType, student.id, student.name, JSON.stringify({ className: student.class_name, roll: student.roll, ...content }), req.user.name],
    )).rows[0];
    const approval = await createApproval(req, {
      type: "certificate_issue", title: `${certificateType} – ${student.name}`, referenceTable: "certificates", referenceId: cert.id,
      payload: { certificateId: cert.id },
    }, client);
    return { certificate: cert, approval };
  });
  res.status(201).json({ success: true, data: keysToCamel(result) });
}));

module.exports = router;
