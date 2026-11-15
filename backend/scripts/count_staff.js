const { query } = require("../src/db/pool");

async function check() {
  try {
    const teachers = await query("SELECT COUNT(*)::int AS count FROM teachers");
    const staff = await query("SELECT COUNT(*)::int AS count FROM staff");
    const payroll = await query("SELECT COUNT(*)::int AS count FROM payroll_records");
    console.log("Database Counts:");
    console.log("Teachers:", teachers.rows[0].count);
    console.log("Staff:", staff.rows[0].count);
    console.log("Payroll Records:", payroll.rows[0].count);

    const staffRows = await query("SELECT * FROM staff");
    console.log("Staff details:", staffRows.rows);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
}

check();
