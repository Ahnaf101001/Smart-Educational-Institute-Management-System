const { query } = require("../src/db/pool");

async function run() {
  try {
    console.log("Testing dashboard API query parts...");

    // 1. Get counts
    const studentCount = await query("SELECT COUNT(*)::int AS count FROM students WHERE status = 'Active'");
    console.log("Students active count:", studentCount.rows[0].count);

    const teacherCount = await query("SELECT COUNT(*)::int AS count FROM teachers WHERE status = 'Active'");
    console.log("Teachers active count:", teacherCount.rows[0].count);

    const staffCount = await query("SELECT COUNT(*)::int AS count FROM staff WHERE status = 'Active'");
    console.log("Staff active count:", staffCount.rows[0].count);

    // 2. Get attendance (Latest date) from flat table
    const attRes = await query(`
      SELECT 
        COUNT(*)::int AS total,
        SUM(CASE WHEN status IN ('Present', 'Late') THEN 1 ELSE 0 END)::int AS present,
        MAX(attendance_date) AS latest_date
      FROM attendance
      WHERE attendance_date = (SELECT MAX(attendance_date) FROM attendance)
    `);
    
    console.log("Attendance result:", attRes.rows[0]);

    // 3. Finance stats
    const monthlyFinance = await query(`
      SELECT
        (SELECT COALESCE(SUM(amount), 0)::numeric FROM financial_transactions
         WHERE type = 'Income' AND DATE_TRUNC('month', transaction_date) = DATE_TRUNC('month', CURRENT_DATE)) AS monthly_income,
        (SELECT COALESCE(SUM(amount), 0)::numeric FROM financial_transactions
         WHERE type = 'Expense' AND DATE_TRUNC('month', transaction_date) = DATE_TRUNC('month', CURRENT_DATE)) AS monthly_expense
    `);
    console.log("Monthly finance query stats:", monthlyFinance.rows[0]);

    // Fee collection stats
    const feeInvoices = await query(`
      SELECT 
        COALESCE(SUM(amount), 0)::numeric AS total,
        COALESCE(SUM(paid_amount), 0)::numeric AS paid,
        COALESCE(SUM(discount), 0)::numeric AS discount
      FROM fee_invoices
      WHERE status <> 'Cancelled'
    `);
    console.log("Fee invoices query stats:", feeInvoices.rows[0]);

    // 4. Past 6 months income/expense for chart
    const revenueHistory = await query(`
      SELECT 
        TO_CHAR(month_date, 'Mon') AS month,
        SUM(income)::numeric AS income,
        SUM(expense)::numeric AS expense
      FROM (
        SELECT 
          DATE_TRUNC('month', transaction_date) AS month_date,
          CASE WHEN type = 'Income' THEN amount ELSE 0 END AS income,
          CASE WHEN type = 'Expense' THEN amount ELSE 0 END AS expense
        FROM financial_transactions
        WHERE transaction_date >= CURRENT_DATE - INTERVAL '6 months'
      ) sub
      GROUP BY month_date
      ORDER BY month_date ASC
    `);
    console.log("Revenue history count:", revenueHistory.rowCount);

    // 5. Upcoming Exams
    const examsRes = await query(`
      SELECT name, start_date AS date, status 
      FROM exams 
      ORDER BY start_date ASC 
      LIMIT 4
    `);
    console.log("Exams query count:", examsRes.rowCount);

    // 6. Recent Activities
    const recentAdmissions = await query(`
      SELECT name, class_name, created_at FROM admissions 
      ORDER BY created_at DESC LIMIT 3
    `);
    console.log("Recent admissions count:", recentAdmissions.rowCount);

    const recentTransactions = await query(`
      SELECT type, description, amount, created_at FROM financial_transactions 
      ORDER BY created_at DESC LIMIT 3
    `);
    console.log("Recent transactions count:", recentTransactions.rowCount);

    const recentNotices = await query(`
      SELECT title, created_at FROM notices 
      ORDER BY created_at DESC LIMIT 2
    `);
    console.log("Recent notices count:", recentNotices.rowCount);

    console.log("All dashboard API queries executed successfully without errors!");

  } catch (err) {
    console.error("Dashboard query failed with error:", err);
  } finally {
    process.exit();
  }
}

run();
