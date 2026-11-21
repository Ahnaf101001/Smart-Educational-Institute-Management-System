// Student / guardian helpers (SRS §6, GD-01..07, ST-02..08, v1 GD-03 sibling detection).
const crypto = require("node:crypto");
const bcrypt = require("bcryptjs");
const httpError = require("../utils/httpError");
const { writeAudit } = require("./audit");

function normalizeMobile(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("880")) return `0${digits.slice(3)}`;
  if (digits.length === 10 && digits.startsWith("1")) return `0${digits}`;
  return digits;
}

// Finds or creates a guardian by mobile (mobile is the unique identity, v1 PC-44).
async function upsertGuardian(client, { name, mobile, relation = "Father", email, nid, occupation, address, nameBn }) {
  const m = normalizeMobile(mobile);
  if (!m) return null;
  const existing = (await client.query("SELECT * FROM guardians WHERE mobile = $1", [m])).rows[0];
  if (existing) return { guardian: existing, created: false };
  const created = (await client.query(
    `INSERT INTO guardians (name, name_bn, relation_default, mobile, email, nid, occupation, address)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [name || "Guardian", nameBn || null, relation, m, email || null, nid ? require("../utils/crypto").encryptField(nid) : null, occupation || null, address || null],
  )).rows[0];
  return { guardian: created, created: true };
}

async function linkGuardian(client, { guardianId, studentId, relation = "Father", isPrimary = false }) {
  if (isPrimary) {
    await client.query("UPDATE guardian_students SET is_primary = FALSE WHERE student_id = $1", [studentId]);
  }
  const hasPrimary = (await client.query("SELECT 1 FROM guardian_students WHERE student_id = $1 AND is_primary", [studentId])).rowCount;
  const row = (await client.query(
    `INSERT INTO guardian_students (guardian_id, student_id, relation, is_primary)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (guardian_id, student_id) DO UPDATE SET relation = EXCLUDED.relation,
       is_primary = guardian_students.is_primary OR EXCLUDED.is_primary
     RETURNING *`,
    [guardianId, studentId, relation, isPrimary || !hasPrimary],
  )).rows[0];
  return row;
}

// Returns other students already linked to this guardian mobile (sibling detection).
async function findSiblings(executor, mobile, excludeStudentId = null) {
  const m = normalizeMobile(mobile);
  if (!m) return [];
  const result = await executor.query(
    `SELECT s.id, s.name, s.class_name, s.section, s.roll, s.status, g.id AS guardian_id, g.name AS guardian_name
     FROM guardians g JOIN guardian_students gs ON gs.guardian_id = g.id JOIN students s ON s.id = gs.student_id
     WHERE g.mobile = $1 AND ($2::text IS NULL OR s.id <> $2) AND s.status <> 'Archived'`,
    [m, excludeStudentId],
  );
  return result.rows;
}

// Creates the guardian portal login (GD-06, GA-01). Returns a one-time password.
async function ensureGuardianAccount(client, guardian) {
  if (guardian.user_id) {
    const u = (await client.query("SELECT id FROM users WHERE id = $1", [guardian.user_id])).rows[0];
    if (u) return { userId: u.id, created: false };
  }
  const existing = (await client.query("SELECT id FROM users WHERE phone = $1", [guardian.mobile])).rows[0];
  if (existing) {
    await client.query("UPDATE guardians SET user_id = $1 WHERE id = $2", [existing.id, guardian.id]);
    return { userId: existing.id, created: false };
  }
  const tempPassword = crypto.randomBytes(5).toString("base64url");
  const user = (await client.query(
    `INSERT INTO users (name, email, phone, password_hash, role, roles, status, linked_type, linked_id, must_change_password)
     VALUES ($1, $2, $3, $4, 'Guardian', '["Guardian"]'::jsonb, 'Active', 'Guardian', $5, TRUE) RETURNING id`,
    [guardian.name, `${guardian.mobile}@guardian.local`, guardian.mobile, await bcrypt.hash(tempPassword, 12), guardian.id],
  )).rows[0];
  await client.query("UPDATE guardians SET user_id = $1 WHERE id = $2", [user.id, guardian.id]);
  return { userId: user.id, created: true, tempPassword };
}

async function currentSession(executor) {
  const r = await executor.query("SELECT * FROM academic_years WHERE is_current OR status = 'Active' ORDER BY is_current DESC, start_date DESC LIMIT 1");
  return r.rows[0] || null;
}

// Creates or updates the active enrollment for the current session (ST-02, AC acceptance: no duplicate roll).
async function upsertEnrollment(client, student, overrides = {}) {
  const session = overrides.academicYearId
    ? (await client.query("SELECT * FROM academic_years WHERE id = $1", [overrides.academicYearId])).rows[0]
    : await currentSession(client);
  const classId = overrides.classId ?? student.class_id;
  const roll = overrides.roll ?? student.roll;
  const section = overrides.section ?? student.section;
  if (roll && classId) {
    const dup = await client.query(
      `SELECT student_id FROM enrollments WHERE status = 'Active' AND academic_year_id IS NOT DISTINCT FROM $1
         AND class_id = $2 AND COALESCE(section,'') = COALESCE($3,'') AND COALESCE(shift,'') = COALESCE($4,'')
         AND roll = $5 AND student_id <> $6`,
      [session?.id || null, classId, section, overrides.shift ?? student.shift, String(roll), student.id],
    );
    if (dup.rowCount) throw httpError(409, `Roll ${roll} is already assigned to ${dup.rows[0].student_id} in this class/section.`);
  }
  const existing = (await client.query(
    "SELECT * FROM enrollments WHERE student_id = $1 AND academic_year_id IS NOT DISTINCT FROM $2 AND status = 'Active'",
    [student.id, session?.id || null],
  )).rows[0];
  const values = [
    student.id, session?.id || null, session?.name || null, classId || null,
    overrides.className ?? student.class_name, section || null, overrides.shift ?? student.shift ?? null,
    overrides.groupName ?? student.group_name ?? null, roll ? String(roll) : null,
  ];
  if (existing) {
    await client.query(
      `UPDATE enrollments SET class_id = $1, class_name = $2, section = $3, shift = $4, group_name = $5, roll = $6
       WHERE id = $7`,
      [values[3], values[4], values[5], values[6], values[7], values[8], existing.id],
    );
    return existing.id;
  }
  const row = (await client.query(
    `INSERT INTO enrollments (student_id, academic_year_id, session_name, class_id, class_name, section, shift, group_name, roll)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
    values,
  )).rows[0];
  return row.id;
}

async function changeStatus(client, req, studentId, toStatus, reason) {
  const s = (await client.query("SELECT * FROM students WHERE id = $1 FOR UPDATE", [studentId])).rows[0];
  if (!s) throw httpError(404, "Student not found.");
  await client.query("UPDATE students SET status = $1 WHERE id = $2", [toStatus, studentId]);
  await client.query(
    "INSERT INTO student_status_history (student_id, from_status, to_status, reason, changed_by) VALUES ($1,$2,$3,$4,$5)",
    [studentId, s.status, toStatus, reason || null, req?.user?.name || null],
  );
  if (["Transferred", "Dropped", "Passed Out", "Inactive"].includes(toStatus)) {
    await client.query("UPDATE enrollments SET status = $1 WHERE student_id = $2 AND status = 'Active'",
      [toStatus === "Inactive" ? "Closed" : toStatus, studentId]);
    // Scenario "Student leaves school": stop future invoices, block active ID card.
    await client.query("UPDATE fee_invoices SET status = 'Cancelled', notes = COALESCE(notes,'') || ' [Auto-cancelled: student left]' WHERE student_id = $1 AND status = 'Due' AND paid_amount = 0 AND billing_month > CURRENT_DATE", [studentId]);
    await client.query("UPDATE id_cards SET status = 'Blocked', block_reason = $1 WHERE holder_type = 'Student' AND holder_id = $2 AND status = 'Active'", [`Student ${toStatus}`, studentId]);
  }
  await writeAudit(req, { entity: "students", entityId: studentId, action: "STATUS_CHANGE", oldValue: { status: s.status }, newValue: { status: toStatus }, reason }, client);
  return { from: s.status, to: toStatus };
}

module.exports = { normalizeMobile, upsertGuardian, linkGuardian, findSiblings, ensureGuardianAccount, upsertEnrollment, changeStatus, currentSession };
