const { query } = require("../src/db/pool");

async function run() {
  try {
    console.log("Testing new dashboard chart queries...");

    // 1. Weekly attendance query
    const weeklyAtt = await query(`
      SELECT 
        TO_CHAR(attendance_date, 'Dy') AS day,
        COUNT(*)::int AS total,
        SUM(CASE WHEN status IN ('Present', 'Late') THEN 1 ELSE 0 END)::int AS present,
        DATE_TRUNC('day', attendance_date) AS day_date
      FROM attendance
      WHERE attendance_date >= CURRENT_DATE - INTERVAL '7 days'
      GROUP BY TO_CHAR(attendance_date, 'Dy'), DATE_TRUNC('day', attendance_date)
      ORDER BY day_date ASC
    `);
    
    console.log("Weekly attendance count:", weeklyAtt.rowCount);
    console.log("Weekly attendance rows:", weeklyAtt.rows);

    // 2. Student growth trend query
    const growthTrend = await query(`
      SELECT 
        TO_CHAR(admission_date, 'Mon') AS month,
        COUNT(*)::int AS count,
        DATE_TRUNC('month', admission_date) AS month_date
      FROM students
      WHERE admission_date IS NOT NULL
      GROUP BY TO_CHAR(admission_date, 'Mon'), DATE_TRUNC('month', admission_date)
      ORDER BY month_date ASC
    `);
    
    console.log("Growth trend count:", growthTrend.rowCount);
    console.log("Growth trend rows:", growthTrend.rows);

    console.log("New queries validated!");

  } catch (err) {
    console.error("Failed:", err);
  } finally {
    process.exit();
  }
}

run();
