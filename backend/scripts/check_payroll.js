const { query } = require("../src/db/pool");

async function check() {
  try {
    const res = await query("SELECT * FROM payroll_records");
    console.log("Payroll records in database:", res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
}

check();
