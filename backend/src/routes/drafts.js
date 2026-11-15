const express = require("express");
const { query } = require("../db/pool");
const asyncHandler = require("../utils/asyncHandler");
const httpError = require("../utils/httpError");
const { keysToCamel } = require("../utils/case");
const { requirePermission } = require("../middleware/auth");

const router = express.Router();
router.use(requirePermission("admission", "create"));

router.get("/:key", asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT * FROM application_drafts
     WHERE draft_key = $1 AND (expires_at IS NULL OR expires_at > NOW())`,
    [req.params.key],
  );
  if (!result.rowCount) throw httpError(404, "Draft not found.");
  res.json({ success: true, data: keysToCamel(result.rows[0]) });
}));

router.put("/:key", asyncHandler(async (req, res) => {
  const result = await query(
    `INSERT INTO application_drafts (draft_key, data, expires_at)
     VALUES ($1, $2, $3)
     ON CONFLICT (draft_key)
     DO UPDATE SET data = EXCLUDED.data, expires_at = EXCLUDED.expires_at
     RETURNING *`,
    [req.params.key, JSON.stringify(req.body.data || req.body), req.body.expiresAt || null],
  );
  res.json({ success: true, data: keysToCamel(result.rows[0]) });
}));

router.delete("/:key", asyncHandler(async (req, res) => {
  await query("DELETE FROM application_drafts WHERE draft_key = $1", [req.params.key]);
  res.status(204).send();
}));

module.exports = router;
