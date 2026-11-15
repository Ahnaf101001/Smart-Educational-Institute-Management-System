const { query } = require("../src/db/pool");

async function clear() {
  try {
    const res = await query("DELETE FROM payroll_records WHERE status = 'Pending'");
    console.log(`Deleted ${res.rowCount} pending payroll records.`);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
}

clear();
