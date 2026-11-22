// File uploads (INT-04, ST-05, NFR-12). Validation and storage live in services/uploads.js
// (shared with the public admission photo endpoint).
const express = require("express");
const fs = require("node:fs/promises");
const path = require("node:path");
const env = require("../config/env");
const { query } = require("../db/pool");
const asyncHandler = require("../utils/asyncHandler");
const httpError = require("../utils/httpError");
const { keysToCamel } = require("../utils/case");
const { hasPermission } = require("../middleware/auth");
const { writeAudit } = require("../services/audit");
const uploads = require("../services/uploads");

const router = express.Router();

router.post("/", express.json({ limit: "12mb" }), asyncHandler(async (req, res) => {
  const { data, fileName, category = "photo", ownerType, ownerId, documentType } = req.body || {};
  const { buffer, sig, dimensions } = uploads.validateUpload({ data, category });

  // A photo upload naming a Student / Teacher / Staff also becomes that person's ID-card photo.
  // Permission and existence are checked before anything is written to disk.
  const setsOwnerPhoto = category === "photo" && ownerId && uploads.OWNERS[ownerType];
  if (setsOwnerPhoto) await uploads.assertCanSetOwnerPhoto(req, ownerType, ownerId);

  const { name, url } = await uploads.saveFile(buffer, sig, category);

  let document = null;
  if (ownerId && documentType) {
    document = (await query(
      `INSERT INTO student_documents (owner_type, owner_id, document_type, file_name, file_url, mime_type, size_bytes, uploaded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [ownerType || "Student", ownerId, documentType, String(fileName || name).slice(0, 200), url, sig.mime, buffer.length, req.user.name],
    )).rows[0];
  }
  await writeAudit(req, { entity: "uploads", entityId: name, action: "UPLOAD", newValue: { category, ownerType, ownerId, documentType, size: buffer.length, ...(dimensions || {}) } });
  let owner = null;
  if (setsOwnerPhoto) {
    await uploads.setOwnerPhoto(req, ownerType, ownerId, url);
    owner = { type: ownerType, id: ownerId };
  }
  res.status(201).json({
    success: true,
    data: keysToCamel({ url, mimeType: sig.mime, size: buffer.length, width: dimensions?.width ?? null, height: dimensions?.height ?? null, document, owner }),
  });
}));

// Private documents require permission on the owner module.
router.get("/private/:name", asyncHandler(async (req, res) => {
  if (!hasPermission(req.user, "students", "view") && !hasPermission(req.user, "staff", "view") && !hasPermission(req.user, "admission", "view")) {
    throw httpError(403, "You do not have permission to view documents.");
  }
  const name = path.basename(req.params.name);
  const file = path.resolve(env.uploadDir, "private", name);
  try { await fs.access(file); } catch { throw httpError(404, "File not found."); }
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", "private, no-store");
  res.sendFile(file);
}));

module.exports = router;
