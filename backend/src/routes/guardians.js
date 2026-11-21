const express = require("express");
const crypto = require("node:crypto");
const bcrypt = require("bcryptjs");
const { query, transaction } = require("../db/pool");
const asyncHandler = require("../utils/asyncHandler");
const httpError = require("../utils/httpError");
const { keysToCamel } = require("../utils/case");
const { requirePermission } = require("../middleware/auth");
const { writeAudit } = require("../services/audit");
const { ensureGuardianAccount, normalizeMobile, linkGuardian } = require("../services/students");
const { queueMessage } = require("../services/notifications");

const router = express.Router();

router.get("/:id/students", requirePermission("guardians", "view"), asyncHandler(async (req, res) => {
  const rows = (await query(
    `SELECT s.id, s.name, s.class_name, s.section, s.roll, s.status, s.photo_url, gs.relation, gs.is_primary, gs.access_status, gs.id AS link_id
     FROM guardian_students gs JOIN students s ON s.id = gs.student_id WHERE gs.guardian_id = $1 ORDER BY s.name`,
    [req.params.id],
  )).rows;
  res.json({ success: true, data: keysToCamel(rows) });
}));

// Enable/disable portal access and (re)create credentials (GD-06).
router.post("/:id/portal", requirePermission("guardians", "edit"), asyncHandler(async (req, res) => {
  const { enabled = true, resetPassword = false } = req.body || {};
  const result = await transaction(async (client) => {
    const g = (await client.query("SELECT * FROM guardians WHERE id = $1 FOR UPDATE", [req.params.id])).rows[0];
    if (!g) throw httpError(404, "Guardian not found.");
    await client.query("UPDATE guardians SET portal_access = $1 WHERE id = $2", [Boolean(enabled), g.id]);
    if (!enabled) {
      if (g.user_id) await client.query("UPDATE users SET status = 'Inactive', token_version = token_version + 1 WHERE id = $1", [g.user_id]);
      await writeAudit(req, { entity: "guardians", entityId: g.id, action: "PORTAL_DISABLE" }, client);
      return { enabled: false };
    }
    const account = await ensureGuardianAccount(client, { ...g, portal_access: true });
    let tempPassword = account.tempPassword;
    if (resetPassword && !tempPassword) {
      tempPassword = crypto.randomBytes(5).toString("base64url");
      await client.query("UPDATE users SET password_hash = $1, status = 'Active', must_change_password = TRUE, token_version = token_version + 1 WHERE id = $2",
        [await bcrypt.hash(tempPassword, 12), account.userId]);
    } else {
      await client.query("UPDATE users SET status = 'Active' WHERE id = $1", [account.userId]);
    }
    if (tempPassword) {
      await queueMessage({
        channel: "SMS", eventType: "PortalAccess", recipient: g.mobile, recipientType: "Guardian", recipientId: g.id,
        body: `Guardian portal login – mobile: ${g.mobile}, password: ${tempPassword}. Please change it after login.`,
      }, client);
    }
    await writeAudit(req, { entity: "guardians", entityId: g.id, action: resetPassword ? "PORTAL_RESET" : "PORTAL_ENABLE" }, client);
    return { enabled: true, userId: account.userId, credentialsSent: Boolean(tempPassword) };
  });
  res.json({ success: true, data: result });
}));

// ---------------------------------------------------------------- Guardian Mobile App accounts
// Admin-controlled account creation: guardians cannot sign up themselves. The admin sets a
// unique login email and either types a temporary password or lets the system generate one.
// The guardian must change it on first sign-in. Credentials are emailed (and returned once so
// the admin can hand them over directly).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post("/:id/account", requirePermission("guardians", "edit"), asyncHandler(async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const typed = req.body?.password ? String(req.body.password) : "";
  const sendEmail = req.body?.sendEmail !== false;
  if (!EMAIL_RE.test(email) || email.endsWith(".local")) throw httpError(422, "Enter a valid login email address.");
  if (typed && typed.length < 8) throw httpError(422, "Temporary password must be at least 8 characters.");
  const tempPassword = typed || `${crypto.randomBytes(6).toString("base64url")}9a`;

  const result = await transaction(async (client) => {
    const g = (await client.query("SELECT * FROM guardians WHERE id = $1 FOR UPDATE", [req.params.id])).rows[0];
    if (!g) throw httpError(404, "Guardian not found.");
    const taken = (await client.query("SELECT id, linked_id FROM users WHERE LOWER(email) = $1 AND id IS DISTINCT FROM $2", [email, g.user_id])).rows[0];
    if (taken) throw httpError(409, "This email is already used by another account.");
    const hash = await bcrypt.hash(tempPassword, 12);
    let userId = g.user_id;
    const existing = userId ? (await client.query("SELECT id FROM users WHERE id = $1", [userId])).rows[0] : null;
    if (existing) {
      await client.query(
        `UPDATE users SET email = $1, password_hash = $2, status = 'Active', must_change_password = TRUE,
           token_version = token_version + 1, failed_attempts = 0, locked_until = NULL, name = $3 WHERE id = $4`,
        [email, hash, g.name, userId],
      );
    } else {
      const byPhone = (await client.query("SELECT id, linked_type, linked_id FROM users WHERE phone = $1", [g.mobile])).rows[0];
      if (byPhone && !(byPhone.linked_type === "Guardian" && byPhone.linked_id === g.id)) {
        throw httpError(409, "This guardian's mobile number already belongs to another user account.");
      }
      if (byPhone) {
        userId = byPhone.id;
        await client.query(
          "UPDATE users SET email = $1, password_hash = $2, status = 'Active', must_change_password = TRUE, token_version = token_version + 1 WHERE id = $3",
          [email, hash, userId],
        );
      } else {
        userId = (await client.query(
          `INSERT INTO users (name, email, phone, password_hash, role, roles, status, linked_type, linked_id, must_change_password)
           VALUES ($1, $2, $3, $4, 'Guardian', '["Guardian"]'::jsonb, 'Active', 'Guardian', $5, TRUE) RETURNING id`,
          [g.name, email, g.mobile, hash, g.id],
        )).rows[0].id;
      }
    }
    await client.query("UPDATE guardians SET user_id = $1, portal_access = TRUE, email = COALESCE(email, $2) WHERE id = $3", [userId, email, g.id]);

    if (sendEmail) {
      const profile = (await client.query("SELECT name, phone, email FROM institute_profile WHERE id = 1")).rows[0] || {};
      const appLink = process.env.GUARDIAN_APP_URL || "";
      await queueMessage({
        channel: "Email", eventType: "GuardianAccount", recipient: email, recipientType: "Guardian", recipientId: g.id,
        subject: `${profile.name || "School"} – AeroSchool Guardian App login`,
        body: [
          `Dear ${g.name},`, "",
          `Your AeroSchool Guardian Mobile App account for ${profile.name || "the school"} is ready.`,
          appLink ? `Download the app: ${appLink}` : null,
          `Login email: ${email}`, `Temporary password: ${tempPassword}`, "",
          "You will be asked to change this password the first time you sign in.",
          `Support: ${[profile.phone, profile.email].filter(Boolean).join(" / ") || "contact the school office"}`,
        ].filter((l) => l !== null).join("\n"),
      }, client);
    }
    await writeAudit(req, { entity: "guardians", entityId: g.id, action: existing ? "APP_ACCOUNT_RESET" : "APP_ACCOUNT_CREATE", newValue: { email, userId } }, client);
    return { userId, email, emailQueued: sendEmail };
  });
  // The temporary password is returned once so the admin can share it directly; it is never stored in plain text.
  res.status(201).json({ success: true, data: { ...result, tempPassword } });
}));

// Account status / login information for the admin Guardian Management screen.
router.get("/:id/account", requirePermission("guardians", "view"), asyncHandler(async (req, res) => {
  const g = (await query("SELECT id, user_id, portal_access FROM guardians WHERE id = $1", [req.params.id])).rows[0];
  if (!g) throw httpError(404, "Guardian not found.");
  const user = g.user_id
    ? (await query("SELECT id, email, phone, status, must_change_password, last_login_at, created_at, password_changed_at FROM users WHERE id = $1", [g.user_id])).rows[0]
    : null;
  res.json({ success: true, data: keysToCamel({ portalAccess: g.portal_access, account: user || null }) });
}));

router.get("/:id/login-history", requirePermission("guardians", "view"), asyncHandler(async (req, res) => {
  const g = (await query("SELECT user_id FROM guardians WHERE id = $1", [req.params.id])).rows[0];
  if (!g) throw httpError(404, "Guardian not found.");
  if (!g.user_id) return res.json({ success: true, data: [] });
  const rows = (await query(
    `SELECT action, created_at, ip, user_agent FROM audit_logs
     WHERE entity = 'users' AND entity_id = $1 AND action IN ('LOGIN','LOGIN_FAILED','PASSWORD_CHANGE','PASSWORD_RESET','LOGOUT_ALL')
     ORDER BY created_at DESC LIMIT 100`,
    [g.user_id],
  )).rows;
  res.json({ success: true, data: keysToCamel(rows) });
}));

router.get("/:id/notification-history", requirePermission("guardians", "view"), asyncHandler(async (req, res) => {
  const rows = (await query(
    `SELECT m.id, m.channel, m.event_type, m.subject, m.body, m.status, m.student_id, s.name AS student_name, m.created_at, m.sent_at, m.read_at
     FROM message_logs m LEFT JOIN students s ON s.id = m.student_id
     WHERE m.recipient_type = 'Guardian' AND m.recipient_id = $1 AND m.event_type <> 'GuardianAccount'
     ORDER BY m.created_at DESC LIMIT 200`,
    [req.params.id],
  )).rows;
  res.json({ success: true, data: keysToCamel(rows) });
}));

// Guardian-centric link / unlink (only authorised school admins: guardians "edit" permission).
router.post("/:id/students", requirePermission("guardians", "edit"), asyncHandler(async (req, res) => {
  const { studentId, relation, isPrimary, canViewResults, canViewFees } = req.body || {};
  if (!studentId) throw httpError(422, "Select a student to link.");
  const result = await transaction(async (client) => {
    const g = (await client.query("SELECT * FROM guardians WHERE id = $1", [req.params.id])).rows[0];
    if (!g) throw httpError(404, "Guardian not found.");
    const s = (await client.query("SELECT id, status FROM students WHERE id = $1", [studentId])).rows[0];
    if (!s) throw httpError(404, "Student not found.");
    const link = await linkGuardian(client, { guardianId: g.id, studentId, relation: relation || g.relation_default, isPrimary: Boolean(isPrimary) });
    await client.query(
      "UPDATE guardian_students SET can_view_results = $1, can_view_fees = $2, access_status = 'Enabled' WHERE id = $3",
      [canViewResults !== false, canViewFees !== false, link.id],
    );
    if (link.is_primary) await client.query("UPDATE students SET parent_contact = $1, guardian_name = $2 WHERE id = $3", [g.mobile, g.name, studentId]);
    await writeAudit(req, { entity: "guardian_students", entityId: link.id, action: "LINK", newValue: link }, client);
    return link;
  });
  res.status(201).json({ success: true, data: keysToCamel(result) });
}));

router.patch("/:id/students/:studentId", requirePermission("guardians", "edit"), asyncHandler(async (req, res) => {
  const { relation, canViewResults, canViewFees, accessStatus, receivesNotifications } = req.body || {};
  if (accessStatus !== undefined && !["Enabled", "Disabled"].includes(accessStatus)) throw httpError(422, "Access status must be Enabled or Disabled.");
  const row = (await query(
    `UPDATE guardian_students SET relation = COALESCE($1, relation), can_view_results = COALESCE($2, can_view_results),
       can_view_fees = COALESCE($3, can_view_fees), access_status = COALESCE($4, access_status),
       receives_notifications = COALESCE($5, receives_notifications)
     WHERE guardian_id = $6 AND student_id = $7 RETURNING *`,
    [relation ?? null, canViewResults ?? null, canViewFees ?? null, accessStatus ?? null, receivesNotifications ?? null, req.params.id, req.params.studentId],
  )).rows[0];
  if (!row) throw httpError(404, "Link not found.");
  await writeAudit(req, { entity: "guardian_students", entityId: row.id, action: "UPDATE", newValue: row });
  res.json({ success: true, data: keysToCamel(row) });
}));

router.delete("/:id/students/:studentId", requirePermission("guardians", "delete"), asyncHandler(async (req, res) => {
  const link = (await query("DELETE FROM guardian_students WHERE guardian_id = $1 AND student_id = $2 RETURNING *", [req.params.id, req.params.studentId])).rows[0];
  if (!link) throw httpError(404, "Link not found.");
  await writeAudit(req, { entity: "guardian_students", entityId: link.id, action: "UNLINK", oldValue: link });
  res.status(204).send();
}));

// Mobile change with verification + audit (GD-04 / v1 GD-08).
router.post("/:id/change-mobile", requirePermission("guardians", "edit"), asyncHandler(async (req, res) => {
  const mobile = normalizeMobile(req.body?.mobile);
  if (!/^01[3-9]\d{8}$/.test(mobile)) throw httpError(422, "Enter a valid Bangladeshi mobile number.");
  if (!String(req.body?.reason || "").trim()) throw httpError(422, "A reason is required for changing the mobile number.");
  const result = await transaction(async (client) => {
    const g = (await client.query("SELECT * FROM guardians WHERE id = $1 FOR UPDATE", [req.params.id])).rows[0];
    if (!g) throw httpError(404, "Guardian not found.");
    const taken = await client.query("SELECT id FROM guardians WHERE mobile = $1 AND id <> $2", [mobile, g.id]);
    if (taken.rowCount) throw httpError(409, `This mobile already belongs to guardian ${taken.rows[0].id}.`);
    await client.query("UPDATE guardians SET mobile = $1 WHERE id = $2", [mobile, g.id]);
    if (g.user_id) await client.query("UPDATE users SET phone = $1, email = $2, token_version = token_version + 1 WHERE id = $3", [mobile, `${mobile}@guardian.local`, g.user_id]);
    await client.query(
      `UPDATE students SET parent_contact = $1 WHERE id IN (SELECT student_id FROM guardian_students WHERE guardian_id = $2 AND is_primary)`,
      [mobile, g.id],
    );
    await writeAudit(req, { entity: "guardians", entityId: g.id, action: "MOBILE_CHANGE", oldValue: { mobile: g.mobile }, newValue: { mobile }, reason: req.body.reason }, client);
    await queueMessage({ channel: "SMS", eventType: "MobileChanged", recipient: g.mobile, recipientType: "Guardian", recipientId: g.id, body: "Your registered mobile number was changed by the institution. Contact the office if this was not requested." }, client);
    return { mobile };
  });
  res.json({ success: true, data: result });
}));

module.exports = router;
