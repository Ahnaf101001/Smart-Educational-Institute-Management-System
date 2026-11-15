const { query } = require("../src/db/pool");

async function run() {
  try {
    // Delete all staff except Kabir
    const res = await query("DELETE FROM staff WHERE id <> 'STF-001'");
    console.log(`Deleted ${res.rowCount} seed staff records. Keeping only STF-001.`);

    // Reset sequence so that next staff is STF-002
    await query("SELECT SETVAL('staff_id_seq', 1)");
    console.log("Reset staff_id_seq to 1.");

    // Check staff table
    const checkStaff = await query("SELECT * FROM staff");
    console.log("Current staff in database:", checkStaff.rows);

  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
}

run();
