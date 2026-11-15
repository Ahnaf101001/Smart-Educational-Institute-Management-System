const express = require("express");
const crypto = require("node:crypto");
const bcrypt = require("bcryptjs");
const { query, transaction } = require("../db/pool");
const asyncHandler = require("../utils/asyncHandler");
const httpError = require("../utils/httpError");
const { keysToCamel } = require("../utils/case");
const { requirePermission } = require("../middleware/auth");
const { writeAudit } = require("../services/audit");
const { ensureGuardianAccount, normalizeMobile } = require("../services/students");
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
      await client.query("UPDATE users SET password_hash = $1, status = 'Active', token_version = token_version + 1 WHERE id = $2",
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
