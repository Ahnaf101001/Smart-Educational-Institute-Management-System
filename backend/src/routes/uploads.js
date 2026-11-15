// File uploads (INT-04, ST-05, NFR-12): type/size validation by magic bytes,
// random file names, public folder for photos/logos, private for documents.
const express = require("express");
const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const env = require("../config/env");
const { query } = require("../db/pool");
const asyncHandler = require("../utils/asyncHandler");
const httpError = require("../utils/httpError");
const { keysToCamel } = require("../utils/case");
const { hasPermission } = require("../middleware/auth");
const { writeAudit } = require("../services/audit");

const router = express.Router();

const SIGNATURES = [
  { mime: "image/jpeg", ext: "jpg", test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: "image/png", ext: "png", test: (b) => b.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { mime: "image/webp", ext: "webp", test: (b) => b.slice(0, 4).toString() === "RIFF" && b.slice(8, 12).toString() === "WEBP" },
  { mime: "application/pdf", ext: "pdf", test: (b) => b.slice(0, 5).toString() === "%PDF-" },
];
const PUBLIC_CATEGORIES = ["photo", "logo", "signature", "seal", "gallery", "attachment"];

router.post("/", express.json({ limit: "12mb" }), asyncHandler(async (req, res) => {
  const { data, fileName, category = "photo", ownerType, ownerId, documentType } = req.body || {};
  if (!data) throw httpError(422, "File data is required.");
  const base64 = String(data).replace(/^data:[^;]+;base64,/, "");
  const buffer = Buffer.from(base64, "base64");
  const maxBytes = env.maxUploadMb * 1024 * 1024;
  if (!buffer.length) throw httpError(422, "Empty file.");
  if (buffer.length > maxBytes) throw httpError(413, `File exceeds ${env.maxUploadMb} MB.`);
  const sig = SIGNATURES.find((s) => s.test(buffer));
  if (!sig) throw httpError(415, "Only JPG, PNG, WEBP images and PDF documents are allowed.");
  if (["photo", "logo", "signature", "seal", "gallery"].includes(category) && sig.mime === "application/pdf") {
    throw httpError(415, "Images are required for photos, logos and signatures.");
  }

  const isPublic = PUBLIC_CATEGORIES.includes(category);
  const dir = path.resolve(env.uploadDir, isPublic ? "public" : "private");
  await fs.mkdir(dir, { recursive: true });
  const name = `${crypto.randomUUID()}.${sig.ext}`;
  await fs.writeFile(path.join(dir, name), buffer);
  const url = isPublic ? `/api/backend/public/files/${name}` : `/api/backend/uploads/private/${name}`;

  let document = null;
  if (ownerId && documentType) {
    document = (await query(
      `INSERT INTO student_documents (owner_type, owner_id, document_type, file_name, file_url, mime_type, size_bytes, uploaded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [ownerType || "Student", ownerId, documentType, String(fileName || name).slice(0, 200), url, sig.mime, buffer.length, req.user.name],
    )).rows[0];
  }
  await writeAudit(req, { entity: "uploads", entityId: name, action: "UPLOAD", newValue: { category, ownerType, ownerId, documentType, size: buffer.length } });
  res.status(201).json({ success: true, data: keysToCamel({ url, mimeType: sig.mime, size: buffer.length, document }) });
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
