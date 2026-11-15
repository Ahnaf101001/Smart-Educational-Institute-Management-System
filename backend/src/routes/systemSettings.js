const express = require("express");
const { query } = require("../db/pool");
const asyncHandler = require("../utils/asyncHandler");
const { keysToCamel, objectToSnake } = require("../utils/case");
const httpError = require("../utils/httpError");
const { requirePermission } = require("../middleware/auth");
const { writeAudit } = require("../services/audit");

const router = express.Router();
// System-wide configuration (SYS-04, attendance/fee/notification/ID card policies).
const allowed = [
  "email_notif", "sms_notif", "system_alerts", "newsletter", "auto_backup", "backup_retention", "session_timeout",
  "two_factor_auth", "language", "digit_system", "date_format", "timezone", "currency", "calendar_type",
  "attendance_edit_window_days", "attendance_cutoff_time", "consecutive_absence_threshold", "notify_absent",
  "notify_late", "notify_entry_exit", "notify_result", "notify_fee_reminder", "fee_reminder_day",
  "invoice_generation_day", "sms_provider", "sms_sender_id", "sms_cost_per_part", "payment_gateways",
  "require_new_card_each_session", "card_print_requires_approval", "card_validity_months", "card_number_prefix",
  "staff_card_number_prefix", "student_id_format", "admit_card_block_on_due", "result_hide_on_due",
  "allow_self_approval", "expense_approval_threshold", "committee_approval_threshold", "session_timeout_minutes",
  "max_login_attempts", "enabled_modules", "public_admission_enabled", "public_result_enabled",
];
const JSON_FIELDS = ["payment_gateways", "enabled_modules"];

router.get("/", asyncHandler(async (req, res) => {
  const result = await query("SELECT * FROM system_settings WHERE id = 1");
  res.json({ success: true, data: keysToCamel(result.rows[0] || {}) });
}));

router.patch("/", requirePermission("settings", "edit"), asyncHandler(async (req, res) => {
  const payload = objectToSnake(req.body);
  const fields = allowed.filter((field) => payload[field] !== undefined);
  if (!fields.length) throw httpError(422, "No valid settings were provided.");
  await query("INSERT INTO system_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING");
  const before = (await query("SELECT * FROM system_settings WHERE id = 1")).rows[0];
  const values = fields.map((f) => (JSON_FIELDS.includes(f) ? JSON.stringify(payload[f]) : payload[f]));
  const result = await query(
    `UPDATE system_settings SET ${fields.map((f, i) => `${f} = $${i + 1}`).join(", ")}, updated_at = NOW() WHERE id = 1 RETURNING *`,
    values,
  );
  await writeAudit(req, { entity: "system_settings", entityId: "1", action: "UPDATE", oldValue: Object.fromEntries(fields.map((f) => [f, before?.[f]])), newValue: Object.fromEntries(fields.map((f) => [f, result.rows[0][f]])) });
  res.json({ success: true, data: keysToCamel(result.rows[0]) });
}));

module.exports = router;
