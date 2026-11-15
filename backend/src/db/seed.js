const bcrypt = require("bcryptjs");
const env = require("../config/env");
const { pool, transaction } = require("./pool");
const { ensureSystemData } = require("../services/bootstrap");

async function seed() {
  await transaction(async (client) => {
    const passwordHash = await bcrypt.hash(env.adminPassword, 12);
    await client.query(
      `INSERT INTO users (id, name, email, password_hash, role, roles, status)
       VALUES ('USR-1', 'Super Admin', $1, $2, 'admin', '["School Admin"]'::jsonb, 'Active')
       ON CONFLICT (email)
       DO UPDATE SET name = EXCLUDED.name, password_hash = EXCLUDED.password_hash, role = EXCLUDED.role, status = EXCLUDED.status`,
      [env.adminEmail, passwordHash],
    );
  });
  // Default roles, grading templates, fee heads, leave types, templates and the 10 ID card designs.
  await ensureSystemData();
  console.log("Admin account and system defaults initialized. No demo business data was inserted.");
}

if (require.main === module) {
  seed()
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}

module.exports = seed;
