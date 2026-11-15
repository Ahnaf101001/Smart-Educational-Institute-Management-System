const express = require("express");
const { query, transaction } = require("../db/pool");
const asyncHandler = require("../utils/asyncHandler");
const httpError = require("../utils/httpError");
const { keysToCamel } = require("../utils/case");
const { requirePermission } = require("../middleware/auth");
const { PRESETS, INSTITUTION_TYPES } = require("../data/presets");
const { applyPreset } = require("../services/bootstrap");
const { GRADE_TEMPLATES } = require("../services/grading");
const { writeAudit } = require("../services/audit");

const router = express.Router();

router.get("/institution-types", (req, res) => {
  res.json({
    success: true,
    data: INSTITUTION_TYPES.map((type) => ({
      type,
      label: PRESETS[type].label,
      classes: PRESETS[type].classes.map((c) => c.name),
      subjects: PRESETS[type].subjects.length,
      gradeTemplate: GRADE_TEMPLATES[PRESETS[type].gradeTemplate]?.name,
      modules: PRESETS[type].modules || [],
    })),
  });
});

// Applies one or more education-line presets (General / Madrasa / Bangla / English medium…).
router.post("/apply-preset", requirePermission("settings", "edit"), asyncHandler(async (req, res) => {
  const types = Array.isArray(req.body?.types) ? req.body.types : [req.body?.type].filter(Boolean);
  if (!types.length) throw httpError(422, "Select at least one institution type.");
  const results = [];
  for (const type of types) results.push(await applyPreset(type));
  await writeAudit(req, { entity: "institute_profile", entityId: "1", action: "APPLY_PRESET", newValue: results });
  res.json({ success: true, data: results });
}));

// Academic session lifecycle (SYS-02, AC-01): activate / close / archive.
router.post("/sessions/:id/:action", requirePermission("academic", "edit"), asyncHandler(async (req, res) => {
  const { id, action } = req.params;
  const result = await transaction(async (client) => {
    const year = (await client.query("SELECT * FROM academic_years WHERE id = $1 FOR UPDATE", [id])).rows[0];
    if (!year) throw httpError(404, "Session not found.");
    if (action === "activate") {
      await client.query("UPDATE academic_years SET is_current = FALSE, status = CASE WHEN status = 'Active' THEN 'Upcoming' ELSE status END WHERE id <> $1 AND status NOT IN ('Closed','Archived')", [id]);
      await client.query("UPDATE academic_years SET is_current = TRUE, status = 'Active' WHERE id = $1", [id]);
    } else if (action === "close") {
      await client.query("UPDATE academic_years SET status = 'Closed', is_current = FALSE, closed_at = NOW() WHERE id = $1", [id]);
      await client.query("UPDATE enrollments SET status = 'Closed' WHERE academic_year_id = $1 AND status = 'Active'", [id]);
    } else if (action === "archive") {
      if (year.status !== "Closed") throw httpError(409, "Close the session before archiving it.");
      await client.query("UPDATE academic_years SET status = 'Archived' WHERE id = $1", [id]);
    } else {
      throw httpError(422, "Action must be activate, close or archive.");
    }
    await writeAudit(req, { entity: "academic_years", entityId: id, action: `SESSION_${action.toUpperCase()}`, oldValue: { status: year.status } }, client);
    return (await client.query("SELECT * FROM academic_years WHERE id = $1", [id])).rows[0];
  });
  res.json({ success: true, data: keysToCamel(result) });
}));

router.get("/modules", asyncHandler(async (req, res) => {
  const s = (await query("SELECT enabled_modules FROM system_settings WHERE id = 1")).rows[0];
  const p = (await query("SELECT institution_types FROM institute_profile WHERE id = 1")).rows[0];
  res.json({ success: true, data: { enabledModules: s?.enabled_modules || [], institutionTypes: p?.institution_types || [] } });
}));

module.exports = router;
