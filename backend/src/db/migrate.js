const fs = require("node:fs/promises");
const path = require("node:path");
const { pool } = require("./pool");

async function migrate() {
  const migrationsPath = path.resolve(__dirname, "../../sql");
  const files = (await fs.readdir(migrationsPath))
    .filter((file) => file.endsWith(".sql"))
    .sort();

  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename TEXT PRIMARY KEY,
        executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    for (const filename of files) {
      const existing = await client.query(
        "SELECT 1 FROM schema_migrations WHERE filename = $1",
        [filename],
      );
      if (existing.rowCount) continue;

      const sql = await fs.readFile(path.join(migrationsPath, filename), "utf8");
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          "INSERT INTO schema_migrations (filename) VALUES ($1)",
          [filename],
        );
        await client.query("COMMIT");
        console.log(`Applied migration: ${filename}`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  migrate().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = migrate;
