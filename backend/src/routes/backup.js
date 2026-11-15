const express = require("express");
const path = require("node:path");
const env = require("../config/env");
const asyncHandler = require("../utils/asyncHandler");
const httpError = require("../utils/httpError");
const { requirePermission } = require("../middleware/auth");
const { writeAudit } = require("../services/audit");
const { createBackup, listBackups, verifyBackup } = require("../services/backup");

const router = express.Router();
router.use(requirePermission("settings", "edit"));

router.get("/", asyncHandler(async (req, res) => res.json({ success: true, data: await listBackups() })));

router.post("/", asyncHandler(async (req, res) => {
  const result = await createBackup("manual");
  await writeAudit(req, { entity: "backups", entityId: result.file, action: "BACKUP", newValue: result });
  res.status(201).json({ success: true, data: result });
}));

// Restore drill: integrity + row count comparison, no data is overwritten.
router.post("/:file/verify", asyncHandler(async (req, res) => {
  const result = await verifyBackup(req.params.file).catch((e) => { throw httpError(400, `Backup could not be read: ${e.message}`); });
  await writeAudit(req, { entity: "backups", entityId: req.params.file, action: "RESTORE_DRILL", newValue: { checksumValid: result.checksumValid, rows: result.totalRows } });
  res.json({ success: true, data: result });
}));

router.get("/:file/download", asyncHandler(async (req, res) => {
  await writeAudit(req, { entity: "backups", entityId: req.params.file, action: "DOWNLOAD" });
  res.download(path.resolve(env.backupDir, path.basename(req.params.file)));
}));

module.exports = router;
