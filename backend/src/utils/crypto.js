// Field-level encryption at rest for sensitive personal data (NF-41, NFX-05).
// Values are stored as "enc:v1:<iv>:<tag>:<ciphertext>" (base64). Plain legacy
// values pass through untouched so existing rows keep working.
const crypto = require("node:crypto");
const env = require("../config/env");

const PREFIX = "enc:v1:";
const key = () => (env.dataEncryptionKey ? crypto.createHash("sha256").update(env.dataEncryptionKey).digest() : null);

function encryptField(value) {
  if (value === null || value === undefined || value === "") return value;
  const text = String(value);
  if (text.startsWith(PREFIX) || !key()) return text;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  return `${PREFIX}${iv.toString("base64")}:${cipher.getAuthTag().toString("base64")}:${data.toString("base64")}`;
}

function decryptField(value) {
  if (typeof value !== "string" || !value.startsWith(PREFIX)) return value;
  if (!key()) return "[encrypted]";
  try {
    const [iv, tag, data] = value.slice(PREFIX.length).split(":");
    const decipher = crypto.createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
    decipher.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
  } catch {
    return "[unreadable]";
  }
}

module.exports = { encryptField, decryptField };
