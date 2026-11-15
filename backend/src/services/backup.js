// Data backup & restore drill (SRS NFR-05, NFX-03). Produces a JSON snapshot of
// every table; the restore drill re-reads the file and verifies row counts and
// integrity without touching live data. Full binary backups should still be
// taken with pg_dump (see README).
const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const zlib = require("node:zlib");
const { promisify } = require("node:util");
const env = require("../config/env");
const { query } = require("../db/pool");

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

async function tables() {
  return (await query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name",
  )).rows.map((r) => r.table_name);
}

async function createBackup(label = "manual") {
  const dir = path.resolve(env.backupDir);
  await fs.mkdir(dir, { recursive: true });
  const snapshot = { createdAt: new Date().toISOString(), label, tables: {} };
  for (const t of await tables()) {
    snapshot.tables[t] = (await query(`SELECT * FROM "${t}"`)).rows;
  }
  const json = JSON.stringify(snapshot);
  const checksum = crypto.createHash("sha256").update(json).digest("hex");
  const file = `backup-${snapshot.createdAt.replace(/[:.]/g, "-")}-${label}.json.gz`;
  await fs.writeFile(path.join(dir, file), await gzip(Buffer.from(json)));
  await fs.writeFile(path.join(dir, `${file}.sha256`), checksum);
  return { file, checksum, tables: Object.keys(snapshot.tables).length, rows: Object.values(snapshot.tables).reduce((s, r) => s + r.length, 0) };
}

async function listBackups() {
  const dir = path.resolve(env.backupDir);
  try {
    const files = (await fs.readdir(dir)).filter((f) => f.endsWith(".json.gz"));
    const out = [];
    for (const f of files) {
      const st = await fs.stat(path.join(dir, f));
      out.push({ file: f, size: st.size, createdAt: st.mtime });
    }
    return out.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  } catch {
    return [];
  }
}

async function verifyBackup(file) {
  const dir = path.resolve(env.backupDir);
  const name = path.basename(file);
  const raw = (await gunzip(await fs.readFile(path.join(dir, name)))).toString();
  const expected = (await fs.readFile(path.join(dir, `${name}.sha256`), "utf8").catch(() => "")).trim();
  const actual = crypto.createHash("sha256").update(raw).digest("hex");
  const snapshot = JSON.parse(raw);
  const report = [];
  for (const [table, rows] of Object.entries(snapshot.tables)) {
    const live = await query(`SELECT COUNT(*)::int AS n FROM "${table}"`).then((r) => r.rows[0].n).catch(() => null);
    report.push({ table, backupRows: rows.length, liveRows: live });
  }
  return {
    file: name, createdAt: snapshot.createdAt, checksumValid: !expected || expected === actual, checksum: actual,
    tables: report.length, totalRows: report.reduce((s, r) => s + r.backupRows, 0), report,
  };
}

async function pruneBackups(retentionDays = 30) {
  const cutoff = Date.now() - retentionDays * 86400000;
  for (const b of await listBackups()) {
    if (new Date(b.createdAt).getTime() < cutoff) {
      await fs.unlink(path.resolve(env.backupDir, b.file)).catch(() => {});
      await fs.unlink(path.resolve(env.backupDir, `${b.file}.sha256`)).catch(() => {});
    }
  }
}

module.exports = { createBackup, listBackups, verifyBackup, pruneBackups };
