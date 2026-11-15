const { pool } = require("./backend/src/db/pool");

async function run() {
  const res = await pool.query("SELECT * FROM students");
  console.log("Students:", res.rows);
  pool.end();
}
run();
