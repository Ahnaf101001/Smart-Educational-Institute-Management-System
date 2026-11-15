const express = require("express");
const { query } = require("../db/pool");
const asyncHandler = require("../utils/asyncHandler");
const { keysToCamel, objectToSnake } = require("../utils/case");
const httpError = require("../utils/httpError");
const { requirePermission } = require("../middleware/auth");

const router = express.Router();
const allowed = [
  "working_days", "start_time", "end_time", "periods_per_day",
  "period_duration", "break_after_periods", "break_duration_minutes",
  "grading_system", "pass_marks", "promotion_policy",
];

router.get("/", asyncHandler(async (req, res) => {
  const result = await query("SELECT * FROM academic_settings WHERE id = 1");
  res.json({ success: true, data: keysToCamel(result.rows[0] || {}) });
}));

router.patch("/", requirePermission("academic", "edit"), asyncHandler(async (req, res) => {
  const payload = objectToSnake(req.body);
  const fields = allowed.filter((field) => payload[field] !== undefined);
  if (!fields.length) throw httpError(422, "No valid settings were provided.");

  await query("INSERT INTO academic_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING");

  const values = fields.map((field) => (
    field === "break_after_periods" ? JSON.stringify(payload[field] || []) : payload[field]
  ));
  const assignments = fields.map((field, index) => `${field} = $${index + 1}`);
  const result = await query(
    `UPDATE academic_settings
     SET ${assignments.join(", ")}, updated_at = NOW()
     WHERE id = 1
     RETURNING *`,
    values,
  );
  res.json({ success: true, data: keysToCamel(result.rows[0]) });
}));

module.exports = router;
