// Quick check that the database is reachable and lists students.
// Prints only ID, name, class and status, never personal details such as phone numbers or NID.
const { pool } = require("./backend/src/db/pool");

async function run() {
  try {
    const res = await pool.query("SELECT id, name, class_name, status FROM students ORDER BY id");
    console.log(`Students: ${res.rowCount}`);
    console.table(res.rows);
  } catch (e) {
    console.error("Could not read students:", e.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
run();
