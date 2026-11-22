// Shared upload pipeline (INT-04, ST-05, NFR-12) used by the signed-in /uploads route and the public
// admission photo endpoint: magic-byte type check, size limits, ID-photo dimension rules, random
// file names, public folder for photos/logos and private folder for documents.
const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const env = require("../config/env");
const { query, transaction } = require("../db/pool");
const httpError = require("../utils/httpError");
const { hasPermission } = require("../middleware/auth");
const { writeAudit } = require("./audit");

const SIGNATURES = [
  { mime: "image/jpeg", ext: "jpg", test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: "image/png", ext: "png", test: (b) => b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { mime: "image/webp", ext: "webp", test: (b) => b.length > 12 && b.subarray(0, 4).toString() === "RIFF" && b.subarray(8, 12).toString() === "WEBP" },
  { mime: "application/pdf", ext: "pdf", test: (b) => b.subarray(0, 5).toString() === "%PDF-" },
];
const PUBLIC_CATEGORIES = ["photo", "logo", "signature", "seal", "gallery", "attachment"];
const IMAGE_CATEGORIES = ["photo", "logo", "signature", "seal", "gallery"];

// ID-card photo rules (category "photo").
const PHOTO_MIN_BYTES = 2 * 1024;
const PHOTO_MAX_MB = () => Math.min(env.maxUploadMb, 2);
const PHOTO_MIN_PX = 200;

// Holder types whose photo can be set directly by an upload: table + permission module.
const OWNERS = {
  Student: { table: "students", module: "students" },
  Teacher: { table: "teachers", module: "teachers" },
  Staff: { table: "staff", module: "staff" },
};

/** Reads pixel dimensions from a JPEG (SOFn), PNG (IHDR) or WEBP (VP8 / VP8L / VP8X) header. */
function imageDimensions(buf, mime) {
  try {
    if (mime === "image/png") {
      if (buf.subarray(12, 16).toString() !== "IHDR") return null;
      return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
    }
    if (mime === "image/jpeg") {
      let i = 2;
      while (i + 9 < buf.length) {
        if (buf[i] !== 0xff) { i += 1; continue; }
        const marker = buf[i + 1];
        if (marker === 0xff) { i += 1; continue; } // fill byte
        if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; } // no length
        if (marker === 0xd9 || marker === 0xda) break; // end of image / start of scan before any SOF
        const isSof = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
        if (isSof) return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
        i += 2 + buf.readUInt16BE(i + 2);
      }
      return null;
    }
    if (mime === "image/webp") {
      const chunk = buf.subarray(12, 16).toString();
      if (chunk === "VP8 ") return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
      if (chunk === "VP8L") {
        const bits = buf.readUInt32LE(21);
        return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
      }
      if (chunk === "VP8X") return { width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) };
    }
  } catch {
    return null;
  }
  return null;
}

/** Decodes and validates an upload. Returns { buffer, sig, dimensions }; throws 4xx on bad input. */
function validateUpload({ data, category = "photo", maxMb }) {
  if (!data) throw httpError(422, "File data is required.");
  const buffer = Buffer.from(String(data).replace(/^data:[^;]+;base64,/, ""), "base64");
  if (!buffer.length) throw httpError(422, "Empty file.");
  const isPhoto = category === "photo";
  const limitMb = maxMb || (isPhoto ? PHOTO_MAX_MB() : env.maxUploadMb);
  if (buffer.length > limitMb * 1024 * 1024) throw httpError(413, `File exceeds ${limitMb} MB.`);
  const sig = SIGNATURES.find((s) => s.test(buffer));
  if (!sig) throw httpError(415, "Only JPG, PNG, WEBP images and PDF documents are allowed.");
  if (IMAGE_CATEGORIES.includes(category) && sig.mime === "application/pdf") {
    throw httpError(415, "Images are required for photos, logos and signatures.");
  }
  let dimensions = null;
  if (sig.mime !== "application/pdf") dimensions = imageDimensions(buffer, sig.mime);
  if (isPhoto) {
    if (buffer.length < PHOTO_MIN_BYTES) throw httpError(422, "This photo is too small (under 2 KB) and is probably damaged.");
    if (!dimensions) throw httpError(422, "Could not read the photo's size. Save it again as JPG or PNG and retry.");
    if (dimensions.width < PHOTO_MIN_PX || dimensions.height < PHOTO_MIN_PX) {
      throw httpError(422, `Photo must be at least ${PHOTO_MIN_PX}×${PHOTO_MIN_PX} px (this one is ${dimensions.width}×${dimensions.height}).`);
    }
  }
  return { buffer, sig, dimensions };
}

/** Writes the file with a random name. Returns { name, url, isPublic }. */
async function saveFile(buffer, sig, category) {
  const isPublic = PUBLIC_CATEGORIES.includes(category);
  const dir = path.resolve(env.uploadDir, isPublic ? "public" : "private");
  await fs.mkdir(dir, { recursive: true });
  const name = `${crypto.randomUUID()}.${sig.ext}`;
  await fs.writeFile(path.join(dir, name), buffer);
  const url = isPublic ? `/api/backend/public/files/${name}` : `/api/backend/uploads/private/${name}`;
  return { name, url, isPublic };
}

/** Checks the caller may change this holder's photo and that the holder exists (before any file is written). */
async function assertCanSetOwnerPhoto(req, ownerType, ownerId) {
  const owner = OWNERS[ownerType];
  if (!owner) throw httpError(422, "Photo owner must be Student, Teacher or Staff.");
  if (!hasPermission(req.user, owner.module, "edit")) {
    throw httpError(403, `You do not have permission to change ${ownerType.toLowerCase()} photos.`);
  }
  const row = (await query(`SELECT id, photo_url FROM ${owner.table} WHERE id::text = $1`, [String(ownerId)])).rows[0];
  if (!row) throw httpError(404, `${ownerType} not found.`);
  return owner;
}

const PUBLIC_FILE = /^\/api\/backend\/public\/files\/([A-Za-z0-9-]+\.(?:jpg|png|webp))$/;

/** Deletes a replaced public photo only when nothing (including issued ID-card snapshots) still uses it. */
async function removeIfUnreferenced(url) {
  const m = PUBLIC_FILE.exec(String(url || ""));
  if (!m) return false;
  const used = (await query(
    `SELECT 1 FROM students WHERE photo_url = $1
     UNION ALL SELECT 1 FROM teachers WHERE photo_url = $1
     UNION ALL SELECT 1 FROM staff WHERE photo_url = $1
     UNION ALL SELECT 1 FROM guardians WHERE photo_url = $1
     UNION ALL SELECT 1 FROM id_cards WHERE snapshot->>'photoUrl' = $1
     UNION ALL SELECT 1 FROM admissions WHERE details->>'photoUrl' = $1
     UNION ALL SELECT 1 FROM student_documents WHERE file_url = $1
     LIMIT 1`,
    [url],
  )).rowCount;
  if (used) return false;
  try {
    await fs.unlink(path.resolve(env.uploadDir, "public", m[1]));
    return true;
  } catch {
    return false;
  }
}

/** Sets a Student / Teacher / Staff photo_url, audits PHOTO_UPDATE and cleans up the old file. */
async function setOwnerPhoto(req, ownerType, ownerId, url) {
  const owner = OWNERS[ownerType];
  const old = await transaction(async (client) => {
    const current = (await client.query(`SELECT photo_url FROM ${owner.table} WHERE id::text = $1 FOR UPDATE`, [String(ownerId)])).rows[0];
    if (!current) throw httpError(404, `${ownerType} not found.`);
    await client.query(`UPDATE ${owner.table} SET photo_url = $1, updated_at = NOW() WHERE id::text = $2`, [url, String(ownerId)]);
    await writeAudit(req, { entity: owner.table, entityId: ownerId, action: "PHOTO_UPDATE", oldValue: { photo_url: current.photo_url }, newValue: { photo_url: url } }, client);
    return current.photo_url;
  });
  if (old && old !== url) await removeIfUnreferenced(old);
  return old;
}

module.exports = {
  SIGNATURES, PUBLIC_CATEGORIES, OWNERS, PHOTO_MIN_PX, PHOTO_MIN_BYTES,
  imageDimensions, validateUpload, saveFile, assertCanSetOwnerPhoto, setOwnerPhoto, removeIfUnreferenced,
};
