// Admission confirmation (SRS AD-10, workflow §21.1): creates the student
// profile, guardian link + portal account, enrollment, initial invoices
// (via trigger) and the confirmation notification in one transaction.
const httpError = require("../utils/httpError");
const { writeAudit } = require("./audit");
const { queueMessage } = require("./notifications");
const { renderTemplate, defaultLanguage } = require("./templates");
const { upsertGuardian, linkGuardian, ensureGuardianAccount, upsertEnrollment, normalizeMobile } = require("./students");

async function findDuplicates(executor, { birthCertNo, name, dateOfBirth, guardianMobile, excludeId }) {
  const mobile = normalizeMobile(guardianMobile);
  const result = await executor.query(
    `SELECT 'Application' AS kind, id, name, class_name, status FROM admissions
     WHERE ($4::text IS NULL OR id <> $4) AND status NOT IN ('Rejected') AND (
       ($1::text IS NOT NULL AND birth_cert_no = $1)
       OR (LOWER(name) = LOWER($2) AND date_of_birth IS NOT DISTINCT FROM $3::date AND $3::date IS NOT NULL)
       OR (LOWER(name) = LOWER($2) AND $5::text <> '' AND guardian_mobile = $5))
     UNION ALL
     SELECT 'Student', id, name, class_name, status FROM students
     WHERE status <> 'Archived' AND (
       ($1::text IS NOT NULL AND birth_cert_no = $1)
       OR (LOWER(name) = LOWER($2) AND date_of_birth IS NOT DISTINCT FROM $3::date AND $3::date IS NOT NULL))`,
    [birthCertNo || null, name || "", dateOfBirth || null, excludeId || null, mobile],
  );
  return result.rows;
}

async function confirmAdmission(client, req, admissionId, { section, roll } = {}) {
  const app = (await client.query("SELECT * FROM admissions WHERE id = $1 FOR UPDATE", [admissionId])).rows[0];
  if (!app) throw httpError(404, "Admission application not found.");
  if (app.student_id) {
    return { student: (await client.query("SELECT * FROM students WHERE id = $1", [app.student_id])).rows[0], alreadyAdmitted: true };
  }
  if (app.duplicate_flag && !app.override_reason) {
    throw httpError(409, "Possible duplicate application. An authorised override with reason is required first.");
  }

  const d = app.details || {};
  const className = d.classApplied || app.class_name;
  const cls = className ? (await client.query("SELECT * FROM classes WHERE name = $1", [String(className).split("-")[0]])).rows[0] : null;
  const sec = section || d.section || (Array.isArray(cls?.sections) && cls.sections[0]) || null;

  const student = (await client.query(
    `INSERT INTO students (roll, name, name_bn, gender, class_name, class_id, section, shift, group_name, parent_contact,
       date_of_birth, admission_date, address, email, guardian_name, source_applicant_id, status, details, photo_url,
       blood_group, birth_cert_no, religion, previous_school)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,CURRENT_DATE,$12,$13,$14,$15,'Active',$16,$17,$18,$19,$20,$21)
     RETURNING *`,
    [
      roll || d.rollNumber || null, app.name, d.nameBn || null, app.gender,
      cls ? `${cls.name}${sec ? `-${sec}` : ""}` : `${className || ""}${sec ? `-${sec}` : ""}`,
      cls?.id || null, sec, d.shift || null, d.group || null,
      normalizeMobile(app.guardian_mobile || d.fatherPhone || d.guardianPhone || d.emergencyContact) || null,
      app.date_of_birth || d.dateOfBirth || null, d.presentAddress || d.address || null, d.email || null,
      d.fatherName || d.guardianName || null, app.id, JSON.stringify(d), d.photoUrl || null, d.bloodGroup || null,
      app.birth_cert_no || d.birthCertificateNo || null, d.religion || null, d.previousSchool || null,
    ],
  )).rows[0];

  await upsertEnrollment(client, student);

  // Guardians: father, mother, legal guardian (GD-01); primary = selected or first.
  const guardianInputs = [
    { name: d.fatherName, mobile: d.fatherPhone, relation: "Father", occupation: d.fatherOccupation, nid: d.fatherNid },
    { name: d.motherName, mobile: d.motherPhone, relation: "Mother", occupation: d.motherOccupation, nid: d.motherNid },
    { name: d.guardianName, mobile: d.guardianPhone || app.guardian_mobile, relation: d.guardianRelation || "Guardian" },
  ].filter((g) => g.mobile);
  let portal = null;
  for (const [i, g] of guardianInputs.entries()) {
    const res = await upsertGuardian(client, { ...g, address: d.presentAddress });
    if (!res) continue;
    const isPrimary = d.primaryGuardian ? d.primaryGuardian === g.relation : i === 0;
    await linkGuardian(client, { guardianId: res.guardian.id, studentId: student.id, relation: g.relation, isPrimary });
    if (isPrimary && res.guardian.portal_access) portal = await ensureGuardianAccount(client, res.guardian);
  }

  const history = [...(app.status_history || []), { at: new Date().toISOString(), status: "Admitted", by: req?.user?.name }];
  await client.query("UPDATE admissions SET status = 'Admitted', student_id = $1, status_history = $2 WHERE id = $3",
    [student.id, JSON.stringify(history), app.id]);
  await writeAudit(req, { entity: "admissions", entityId: app.id, action: "CONFIRM", newValue: { studentId: student.id } }, client);

  const mobile = student.parent_contact;
  if (mobile) {
    const lang = await defaultLanguage();
    let body = await renderTemplate("admission", lang, { student: student.name, studentId: student.id });
    if (portal?.tempPassword) body += ` Portal login: ${mobile} / ${portal.tempPassword}`;
    await queueMessage({ channel: "SMS", eventType: "Admission", recipient: mobile, recipientType: "Guardian", studentId: student.id, body, relatedType: "admissions", relatedId: app.id }, client);
  }
  return { student, portalCreated: Boolean(portal?.created), alreadyAdmitted: false };
}

module.exports = { findDuplicates, confirmAdmission };
