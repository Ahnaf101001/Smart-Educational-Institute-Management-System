const { query } = require("../src/db/pool");

async function testGenerate() {
  try {
    const tList = await query("SELECT * FROM teachers");
    const sList = await query("SELECT * FROM staff");

    const allActiveStaff = [
      ...tList.rows.map(t => ({ ...t, employeeType: "Teacher", designation: "Teacher" })),
      ...sList.rows.map(s => ({ ...s, employeeType: "Staff" }))
    ].filter(emp => emp.status === "Active" || !emp.status);

    console.log(`Found ${allActiveStaff.length} active employees to generate payroll.`);

    const month = "2026-06-01";
    for (const emp of allActiveStaff) {
      const basic = Number(emp.salary || 25000);
      const allowance = Math.round(basic * 0.15);
      const deduction = Math.round(basic * 0.02);
      const net = basic + allowance - deduction;

      await query(
        `INSERT INTO payroll_records (employee_type, employee_id, employee_name, role, department, payroll_month, basic_salary, allowances, deductions, net_pay, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'Pending')
         ON CONFLICT (employee_type, employee_id, payroll_month) DO NOTHING`,
        [
          emp.employeeType,
          emp.id,
          emp.name,
          emp.designation || (emp.employeeType === "Teacher" ? "Teacher" : "Staff"),
          emp.department || "General",
          month,
          basic,
          allowance,
          deduction,
          net
        ]
      );
    }

    const checkRecords = await query("SELECT COUNT(*)::int AS count FROM payroll_records WHERE payroll_month = $1", [month]);
    console.log(`Generated successfully. Current pending payroll records count for ${month}:`, checkRecords.rows[0].count);

  } catch (err) {
    console.error("Error generating draft:", err);
  } finally {
    process.exit();
  }
}

testGenerate();
