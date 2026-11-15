const express = require("express");
const { query } = require("../db/pool");
const asyncHandler = require("../utils/asyncHandler");
const { keysToCamel, objectToSnake } = require("../utils/case");
const httpError = require("../utils/httpError");
const { requirePermission } = require("../middleware/auth");
const { writeAudit } = require("../services/audit");

const router = express.Router();
// School profile & reusable branding assets (SYS-01, SYS-05, SYS-08).
const allowed = [
  "name", "name_bn", "name_ar", "type", "eiin", "phone", "email", "website", "established_year", "capacity", "address",
  "logo_url", "institution_types", "primary_type", "motto", "principal_name", "principal_title", "signature_url",
  "seal_url", "brand_color", "accent_color", "board", "emergency_contact",
];
const JSON_FIELDS = ["institution_types"];

router.get("/", asyncHandler(async (req, res) => {
  const result = await query("SELECT * FROM institute_profile WHERE id = 1");
  res.json({ success: true, data: keysToCamel(result.rows[0] || {}) });
}));

router.patch("/", requirePermission("settings", "edit"), asyncHandler(async (req, res) => {
  const payload = objectToSnake(req.body);
  const fields = allowed.filter((field) => payload[field] !== undefined);
  if (!fields.length) throw httpError(422, "No valid settings were provided.");
  await query("INSERT INTO institute_profile (id) VALUES (1) ON CONFLICT (id) DO NOTHING");
  const before = (await query("SELECT * FROM institute_profile WHERE id = 1")).rows[0];
  const values = fields.map((f) => (JSON_FIELDS.includes(f) ? JSON.stringify(payload[f] || []) : payload[f]));
  const result = await query(
    `UPDATE institute_profile SET ${fields.map((f, i) => `${f} = $${i + 1}`).join(", ")}, updated_at = NOW() WHERE id = 1 RETURNING *`,
    values,
  );
  await writeAudit(req, { entity: "institute_profile", entityId: "1", action: "UPDATE", oldValue: Object.fromEntries(fields.map((f) => [f, before?.[f]])), newValue: Object.fromEntries(fields.map((f) => [f, result.rows[0][f]])) });
  res.json({ success: true, data: keysToCamel(result.rows[0]) });
}));

module.exports = router;
