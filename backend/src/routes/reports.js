const express = require("express");
const { query } = require("../db/pool");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router();

const MONEY = "BDT";
const dash = "-";

const money = (value) => `${MONEY} ${Number(value || 0).toLocaleString("en-IN")}`;
const pct = (value) => `${Number(value || 0).toFixed(1)}%`;
const row = (...values) => values.reduce((acc, value, index) => ({ ...acc, [`col${index}`]: value }), {});

const reportCategories = [
  {
    title: "Student Report",
    icon: "users",
    color: "bg-blue-600",
    reports: ["Total Students by Class", "New Admissions", "Transfer Certificates", "Student Demographics"],
  },
  {
    title: "Attendance Report",
    icon: "clipboard-list",
    color: "bg-emerald-600",
    reports: ["Monthly Attendance", "Class-wise Attendance", "Teacher Attendance", "Absent Summary"],
  },
  {
    title: "Exam Report",
    icon: "file-text",
    color: "bg-purple-600",
    reports: ["Result Summary", "Grade Distribution", "Subject-wise Analysis", "Top Performers"],
  },
  {
    title: "Fee Report",
    icon: "dollar-sign",
    color: "bg-orange-500",
    reports: ["Collection Summary", "Due/Overdue List", "Monthly Fee Report", "Waiver Report"],
  },
  {
    title: "Financial Report",
    icon: "calculator",
    color: "bg-teal-600",
    reports: ["Income Statement", "Balance Sheet", "Cash Flow", "Profit & Loss"],
  },
  {
    title: "Payroll Report",
    icon: "credit-card",
    color: "bg-indigo-600",
    reports: ["Monthly Payroll", "Salary Slip", "Tax Report", "Provident Fund"],
  },
];

const handlers = {
  "Total Students by Class": async () => {
    const qRes = await query(`
      SELECT
        c.name AS class_name,
        COUNT(*) FILTER (WHERE COALESCE(s.section, SPLIT_PART(s.class_name, '-', 2)) = 'A')::int AS sec_a,
        COUNT(*) FILTER (WHERE COALESCE(s.section, SPLIT_PART(s.class_name, '-', 2)) = 'B')::int AS sec_b,
        COUNT(*) FILTER (WHERE COALESCE(s.section, SPLIT_PART(s.class_name, '-', 2)) = 'C')::int AS sec_c,
        COUNT(s.id)::int AS total
      FROM classes c
      LEFT JOIN students s
        ON (s.class_id = c.id OR SPLIT_PART(s.class_name, '-', 1) = c.name)
       AND s.status = 'Active'
      WHERE c.status = 'Active'
      GROUP BY c.id, c.name
      ORDER BY c.name
    `);

    let totalSecA = 0;
    let totalSecB = 0;
    let totalSecC = 0;
    let grandTotal = 0;
    const rows = qRes.rows.map((r) => {
      totalSecA += r.sec_a;
      totalSecB += r.sec_b;
      totalSecC += r.sec_c;
      grandTotal += r.total;
      return row(r.class_name, r.sec_a, r.sec_b, r.sec_c, r.total);
    });

    return {
      columns: ["CLASS", "SECTION A", "SECTION B", "SECTION C", "TOTAL"],
      rows,
      totals: ["Total", totalSecA, totalSecB, totalSecC, grandTotal],
    };
  },

  "New Admissions": async ({ fromDate, toDate }) => {
    const qRes = await query(`
      SELECT id, name, class_name, COALESCE(admission_date, created_at::date)::text AS admission_date, status
      FROM students
      WHERE COALESCE(admission_date, created_at::date) BETWEEN $1 AND $2
      ORDER BY admission_date DESC
    `, [fromDate, toDate]);

    return {
      columns: ["ID", "STUDENT NAME", "CLASS", "ADMISSION DATE", "STATUS"],
      rows: qRes.rows.map((r) => row(r.id, r.name, r.class_name || "N/A", r.admission_date, r.status)),
      totals: ["Total Students", dash, dash, dash, qRes.rowCount],
    };
  },

  "Transfer Certificates": async ({ fromDate, toDate }) => {
    const qRes = await query(`
      SELECT id, name, class_name, COALESCE(updated_at::date, created_at::date)::text AS inactive_date, status
      FROM students
      WHERE status <> 'Active' AND COALESCE(updated_at::date, created_at::date) BETWEEN $1 AND $2
      ORDER BY inactive_date DESC
    `, [fromDate, toDate]);

    return {
      columns: ["ID", "STUDENT NAME", "CLASS", "DATE", "STATUS"],
      rows: qRes.rows.map((r) => row(r.id, r.name, r.class_name || "N/A", r.inactive_date, r.status)),
      totals: ["Total Records", dash, dash, dash, qRes.rowCount],
    };
  },

  "Student Demographics": async () => {
    const qRes = await query(`
      SELECT COALESCE(gender, 'Not specified') AS gender, COUNT(*)::int AS total
      FROM students
      GROUP BY COALESCE(gender, 'Not specified')
      ORDER BY gender
    `);
    const total = qRes.rows.reduce((sum, r) => sum + r.total, 0);

    return {
      columns: ["GENDER", "STUDENTS", "SHARE"],
      rows: qRes.rows.map((r) => row(r.gender, r.total, total ? pct((r.total / total) * 100) : "0.0%")),
      totals: ["Total", total, "100.0%"],
    };
  },

  "Monthly Attendance": async ({ fromDate, toDate }) => {
    const qRes = await query(`
      SELECT attendance_date::text AS date,
             COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE status IN ('Present', 'Late'))::int AS present,
             COUNT(*) FILTER (WHERE status = 'Absent')::int AS absent
      FROM attendance
      WHERE attendance_date BETWEEN $1 AND $2
      GROUP BY attendance_date
      ORDER BY attendance_date DESC
    `, [fromDate, toDate]);

    let totalStudents = 0;
    let totalPresent = 0;
    let totalAbsent = 0;
    const rows = qRes.rows.map((r) => {
      totalStudents += r.total;
      totalPresent += r.present;
      totalAbsent += r.absent;
      return row(r.date, r.total, r.present, r.absent, r.total > 0 ? pct((r.present / r.total) * 100) : "0.0%");
    });

    return {
      columns: ["DATE", "TOTAL STUDENTS", "PRESENT", "ABSENT", "ATTENDANCE RATE"],
      rows,
      totals: ["Total / Average", totalStudents, totalPresent, totalAbsent, totalStudents > 0 ? pct((totalPresent / totalStudents) * 100) : "0.0%"],
    };
  },

  "Class-wise Attendance": async ({ fromDate, toDate }) => {
    const qRes = await query(`
      SELECT class_name,
             COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE status IN ('Present', 'Late'))::int AS present,
             COUNT(*) FILTER (WHERE status = 'Absent')::int AS absent
      FROM attendance
      WHERE attendance_date BETWEEN $1 AND $2
      GROUP BY class_name
      ORDER BY class_name
    `, [fromDate, toDate]);
    let total = 0;
    let present = 0;
    let absent = 0;
    const rows = qRes.rows.map((r) => {
      total += r.total;
      present += r.present;
      absent += r.absent;
      return row(r.class_name, r.total, r.present, r.absent, r.total ? pct((r.present / r.total) * 100) : "0.0%");
    });

    return {
      columns: ["CLASS", "TOTAL RECORDS", "PRESENT", "ABSENT", "RATE"],
      rows,
      totals: ["Total / Average", total, present, absent, total ? pct((present / total) * 100) : "0.0%"],
    };
  },

  "Teacher Attendance": async () => {
    const qRes = await query(`
      SELECT id, name, department, status, COALESCE(join_date::text, '-') AS join_date
      FROM teachers
      ORDER BY name
    `);

    return {
      columns: ["ID", "TEACHER NAME", "DEPARTMENT", "STATUS", "JOIN DATE"],
      rows: qRes.rows.map((r) => row(r.id, r.name, r.department || "N/A", r.status, r.join_date)),
      totals: ["Total Teachers", dash, dash, dash, qRes.rowCount],
    };
  },

  "Absent Summary": async ({ fromDate, toDate }) => {
    const qRes = await query(`
      SELECT s.id, s.name, s.class_name, COUNT(a.id)::int AS absent_days
      FROM attendance a
      JOIN students s ON s.id = a.student_id
      WHERE a.status = 'Absent' AND a.attendance_date BETWEEN $1 AND $2
      GROUP BY s.id, s.name, s.class_name
      ORDER BY absent_days DESC, s.name
    `, [fromDate, toDate]);
    const totalAbsent = qRes.rows.reduce((sum, r) => sum + r.absent_days, 0);

    return {
      columns: ["STUDENT ID", "STUDENT NAME", "CLASS", "ABSENT DAYS"],
      rows: qRes.rows.map((r) => row(r.id, r.name, r.class_name || "N/A", r.absent_days)),
      totals: ["Total Absences", dash, dash, totalAbsent],
    };
  },

  "Result Summary": async () => {
    const qRes = await query(`
      SELECT exam,
             COUNT(DISTINCT student_id)::int AS students,
             ROUND(AVG(marks_obtained), 2) AS average_marks,
             COUNT(*) FILTER (WHERE marks_obtained >= pass_marks)::int AS passed,
             COUNT(*) FILTER (WHERE marks_obtained < pass_marks)::int AS failed
      FROM marks
      GROUP BY exam
      ORDER BY exam
    `);

    return {
      columns: ["EXAM", "STUDENTS", "AVG MARKS", "PASSED PAPERS", "FAILED PAPERS"],
      rows: qRes.rows.map((r) => row(r.exam, r.students, Number(r.average_marks || 0), r.passed, r.failed)),
      totals: ["Total Exams", qRes.rowCount, dash, dash, dash],
    };
  },

  "Grade Distribution": async () => {
    const qRes = await query(`
      SELECT
        CASE
          WHEN (marks_obtained / NULLIF(full_marks, 0)) * 100 >= 80 THEN 'A+'
          WHEN (marks_obtained / NULLIF(full_marks, 0)) * 100 >= 70 THEN 'A'
          WHEN (marks_obtained / NULLIF(full_marks, 0)) * 100 >= 60 THEN 'A-'
          WHEN (marks_obtained / NULLIF(full_marks, 0)) * 100 >= 50 THEN 'B'
          WHEN (marks_obtained / NULLIF(full_marks, 0)) * 100 >= 40 THEN 'C'
          WHEN (marks_obtained / NULLIF(full_marks, 0)) * 100 >= 33 THEN 'D'
          ELSE 'F'
        END AS grade,
        COUNT(*)::int AS total
      FROM marks
      GROUP BY grade
      ORDER BY grade
    `);
    const total = qRes.rows.reduce((sum, r) => sum + r.total, 0);

    return {
      columns: ["GRADE", "COUNT", "SHARE"],
      rows: qRes.rows.map((r) => row(r.grade, r.total, total ? pct((r.total / total) * 100) : "0.0%")),
      totals: ["Total", total, "100.0%"],
    };
  },

  "Subject-wise Analysis": async () => {
    const qRes = await query(`
      SELECT sub.name AS subject_name,
             COUNT(m.id)::int AS entries,
             ROUND(AVG(m.marks_obtained), 2) AS average_marks,
             COUNT(*) FILTER (WHERE m.marks_obtained >= m.pass_marks)::int AS passed
      FROM marks m
      JOIN subjects sub ON sub.id = m.subject_id
      GROUP BY sub.name
      ORDER BY sub.name
    `);

    return {
      columns: ["SUBJECT", "ENTRIES", "AVG MARKS", "PASSED", "PASS RATE"],
      rows: qRes.rows.map((r) => row(r.subject_name, r.entries, Number(r.average_marks || 0), r.passed, r.entries ? pct((r.passed / r.entries) * 100) : "0.0%")),
      totals: ["Subjects", qRes.rowCount, dash, dash, dash],
    };
  },

  "Top Performers": async () => {
    const qRes = await query(`
      SELECT s.id, s.name, s.class_name, ROUND(AVG(m.marks_obtained), 2) AS average_marks
      FROM marks m
      JOIN students s ON s.id = m.student_id
      GROUP BY s.id, s.name, s.class_name
      ORDER BY average_marks DESC
      LIMIT 20
    `);

    return {
      columns: ["RANK", "STUDENT NAME", "CLASS", "AVG MARKS"],
      rows: qRes.rows.map((r, index) => row(index + 1, r.name, r.class_name || "N/A", Number(r.average_marks || 0))),
      totals: ["Top Listed", qRes.rowCount, dash, dash],
    };
  },

  "Collection Summary": async ({ fromDate, toDate }) => {
    const qRes = await query(`
      SELECT fi.id, s.name AS student_name, (fi.amount - fi.discount) AS total_amount,
             fi.paid_amount, (fi.amount - fi.discount - fi.paid_amount) AS due_amount
      FROM fee_invoices fi
      JOIN students s ON fi.student_id = s.id
      WHERE fi.created_at::date BETWEEN $1 AND $2
      ORDER BY fi.created_at DESC
    `, [fromDate, toDate]);

    let totalAmount = 0;
    let totalPaid = 0;
    let totalDue = 0;
    const rows = qRes.rows.map((r) => {
      totalAmount += Number(r.total_amount);
      totalPaid += Number(r.paid_amount);
      totalDue += Number(r.due_amount);
      return row(r.id, r.student_name, money(r.total_amount), money(r.paid_amount), money(r.due_amount));
    });

    return {
      columns: ["INVOICE ID", "STUDENT NAME", "NET AMOUNT", "PAID AMOUNT", "DUE AMOUNT"],
      rows,
      totals: ["Total Collection", dash, money(totalAmount), money(totalPaid), money(totalDue)],
    };
  },

  "Due/Overdue List": async () => {
    const qRes = await query(`
      SELECT fi.id, s.name AS student_name, s.class_name, fi.status,
             (fi.amount - fi.discount - fi.paid_amount) AS due_amount
      FROM fee_invoices fi
      JOIN students s ON s.id = fi.student_id
      WHERE fi.status IN ('Due', 'Overdue', 'Partial')
      ORDER BY fi.due_date NULLS LAST, fi.created_at DESC
    `);
    const totalDue = qRes.rows.reduce((sum, r) => sum + Number(r.due_amount), 0);

    return {
      columns: ["INVOICE ID", "STUDENT NAME", "CLASS", "STATUS", "DUE AMOUNT"],
      rows: qRes.rows.map((r) => row(r.id, r.student_name, r.class_name || "N/A", r.status, money(r.due_amount))),
      totals: ["Total Due", dash, dash, dash, money(totalDue)],
    };
  },

  "Monthly Fee Report": async ({ fromDate, toDate }) => {
    const qRes = await query(`
      SELECT TO_CHAR(COALESCE(billing_month, created_at::date), 'YYYY-MM') AS month,
             SUM(amount - discount) AS billed,
             SUM(paid_amount) AS paid,
             SUM(amount - discount - paid_amount) AS due
      FROM fee_invoices
      WHERE COALESCE(billing_month, created_at::date) BETWEEN $1 AND $2
      GROUP BY month
      ORDER BY month
    `, [fromDate, toDate]);
    const totals = qRes.rows.reduce((acc, r) => ({
      billed: acc.billed + Number(r.billed),
      paid: acc.paid + Number(r.paid),
      due: acc.due + Number(r.due),
    }), { billed: 0, paid: 0, due: 0 });

    return {
      columns: ["MONTH", "BILLED", "PAID", "DUE"],
      rows: qRes.rows.map((r) => row(r.month, money(r.billed), money(r.paid), money(r.due))),
      totals: ["Total", money(totals.billed), money(totals.paid), money(totals.due)],
    };
  },

  "Waiver Report": async ({ fromDate, toDate }) => {
    const qRes = await query(`
      SELECT fi.id, s.name AS student_name, s.class_name, fi.discount, fi.created_at::date::text AS date
      FROM fee_invoices fi
      JOIN students s ON s.id = fi.student_id
      WHERE fi.discount > 0 AND fi.created_at::date BETWEEN $1 AND $2
      ORDER BY fi.created_at DESC
    `, [fromDate, toDate]);
    const totalDiscount = qRes.rows.reduce((sum, r) => sum + Number(r.discount), 0);

    return {
      columns: ["INVOICE ID", "STUDENT NAME", "CLASS", "WAIVER", "DATE"],
      rows: qRes.rows.map((r) => row(r.id, r.student_name, r.class_name || "N/A", money(r.discount), r.date)),
      totals: ["Total Waiver", dash, dash, money(totalDiscount), dash],
    };
  },

  "Income Statement": async ({ fromDate, toDate }) => {
    const qRes = await query(`
      SELECT id, type, category, amount, transaction_date::text AS date
      FROM financial_transactions
      WHERE transaction_date BETWEEN $1 AND $2
      ORDER BY transaction_date DESC
    `, [fromDate, toDate]);

    let netIncome = 0;
    const rows = qRes.rows.map((r) => {
      const amt = Number(r.amount);
      netIncome += r.type === "Income" ? amt : -amt;
      return row(r.id, r.type, r.category, money(amt), r.date);
    });

    return {
      columns: ["TRANSACTION ID", "TYPE", "CATEGORY", "AMOUNT", "DATE"],
      rows,
      totals: ["Net Surplus / Deficit", dash, dash, money(netIncome), dash],
    };
  },

  "Balance Sheet": async ({ toDate }) => {
    const qRes = await query(`
      SELECT
        COALESCE(SUM(amount) FILTER (WHERE type = 'Income'), 0) AS total_income,
        COALESCE(SUM(amount) FILTER (WHERE type = 'Expense'), 0) AS total_expense
      FROM financial_transactions
      WHERE transaction_date <= $1
    `, [toDate]);
    const r = qRes.rows[0] || {};
    const income = Number(r.total_income);
    const expense = Number(r.total_expense);

    return {
      columns: ["ACCOUNT", "AMOUNT"],
      rows: [
        row("Total Income", money(income)),
        row("Total Expense", money(expense)),
        row("Net Balance", money(income - expense)),
      ],
      totals: ["Balance", money(income - expense)],
    };
  },

  "Cash Flow": async ({ fromDate, toDate }) => {
    const qRes = await query(`
      SELECT transaction_date::text AS date,
             COALESCE(SUM(amount) FILTER (WHERE type = 'Income'), 0) AS inflow,
             COALESCE(SUM(amount) FILTER (WHERE type = 'Expense'), 0) AS outflow
      FROM financial_transactions
      WHERE transaction_date BETWEEN $1 AND $2
      GROUP BY transaction_date
      ORDER BY transaction_date
    `, [fromDate, toDate]);
    let inflow = 0;
    let outflow = 0;
    const rows = qRes.rows.map((r) => {
      inflow += Number(r.inflow);
      outflow += Number(r.outflow);
      return row(r.date, money(r.inflow), money(r.outflow), money(Number(r.inflow) - Number(r.outflow)));
    });

    return {
      columns: ["DATE", "INFLOW", "OUTFLOW", "NET"],
      rows,
      totals: ["Total", money(inflow), money(outflow), money(inflow - outflow)],
    };
  },

  "Profit & Loss": async (params) => handlers["Income Statement"](params),

  "Monthly Payroll": async ({ fromDate, toDate }) => {
    const qRes = await query(`
      SELECT id, employee_name AS staff_name, role, net_pay, status
      FROM payroll_records
      WHERE payroll_month BETWEEN $1 AND $2
      ORDER BY id DESC
    `, [fromDate, toDate]);

    const totalNetPay = qRes.rows.reduce((sum, r) => sum + Number(r.net_pay), 0);

    return {
      columns: ["RECORD ID", "STAFF NAME", "ROLE", "NET PAY", "PAYMENT STATUS"],
      rows: qRes.rows.map((r) => row(r.id, r.staff_name, r.role || "Staff", money(r.net_pay), r.status)),
      totals: ["Total Payroll", dash, dash, money(totalNetPay), dash],
    };
  },

  "Salary Slip": async ({ fromDate, toDate }) => {
    const qRes = await query(`
      SELECT id, employee_name, payroll_month::text AS month, basic_salary, allowances, deductions, net_pay, status
      FROM payroll_records
      WHERE payroll_month BETWEEN $1 AND $2
      ORDER BY payroll_month DESC, employee_name
    `, [fromDate, toDate]);
    const totalNetPay = qRes.rows.reduce((sum, r) => sum + Number(r.net_pay), 0);

    return {
      columns: ["RECORD ID", "EMPLOYEE", "MONTH", "BASIC", "ALLOWANCES", "DEDUCTIONS", "NET PAY", "STATUS"],
      rows: qRes.rows.map((r) => row(r.id, r.employee_name, r.month, money(r.basic_salary), money(r.allowances), money(r.deductions), money(r.net_pay), r.status)),
      totals: ["Total", dash, dash, dash, dash, dash, money(totalNetPay), dash],
    };
  },

  "Tax Report": async ({ fromDate, toDate }) => {
    const qRes = await query(`
      SELECT employee_name, payroll_month::text AS month, deductions, net_pay
      FROM payroll_records
      WHERE payroll_month BETWEEN $1 AND $2
      ORDER BY payroll_month DESC, employee_name
    `, [fromDate, toDate]);
    const totalDeductions = qRes.rows.reduce((sum, r) => sum + Number(r.deductions), 0);

    return {
      columns: ["EMPLOYEE", "MONTH", "DEDUCTIONS", "NET PAY"],
      rows: qRes.rows.map((r) => row(r.employee_name, r.month, money(r.deductions), money(r.net_pay))),
      totals: ["Total Deductions", dash, money(totalDeductions), dash],
    };
  },

  "Provident Fund": async ({ fromDate, toDate }) => {
    const qRes = await query(`
      SELECT employee_name, payroll_month::text AS month, deductions, status
      FROM payroll_records
      WHERE payroll_month BETWEEN $1 AND $2
      ORDER BY payroll_month DESC, employee_name
    `, [fromDate, toDate]);
    const totalFund = qRes.rows.reduce((sum, r) => sum + Number(r.deductions), 0);

    return {
      columns: ["EMPLOYEE", "MONTH", "CONTRIBUTION", "STATUS"],
      rows: qRes.rows.map((r) => row(r.employee_name, r.month, money(r.deductions), r.status)),
      totals: ["Total Contribution", dash, money(totalFund), dash],
    };
  },
};

// ---------------------------------------------------------------- extended report library (RP-25)
reportCategories.push(
  { title: "Admission Report", icon: "user-plus", color: "bg-sky-600", module: "admission", reports: ["Applications by Status", "Seat Availability", "Merit List"] },
  { title: "Guardian Report", icon: "users", color: "bg-pink-600", module: "guardians", reports: ["Guardian List", "Siblings"] },
  { title: "ID Card Report", icon: "id-card", color: "bg-indigo-600", module: "idcards", reports: ["ID Card Print Logs", "Active Cards", "Card Replacements", "Students Without Card"] },
  { title: "HR Report", icon: "briefcase", color: "bg-slate-600", module: "staff", reports: ["Staff List", "Leave Report", "Staff Attendance Summary"] },
  { title: "Library & Transport", icon: "book", color: "bg-amber-600", module: "library", reports: ["Books Issued", "Overdue Books", "Transport Route Students"] },
  { title: "Madrasa Report", icon: "moon", color: "bg-green-700", module: "madrasa", reports: ["Hifz Progress", "Salah Summary", "Donations by Fund"] },
);
const CATEGORY_MODULE = {
  "Student Report": "students", "Attendance Report": "attendance", "Exam Report": "results", "Fee Report": "fees",
  "Financial Report": "accounts", "HR & Payroll Report": "payroll",
};
reportCategories.forEach((c) => { if (!c.module) c.module = CATEGORY_MODULE[c.title] || "reports"; });

Object.assign(handlers, {
  "Applications by Status": async ({ fromDate, toDate }) => {
    const r = await query(`SELECT class_name, status, COUNT(*)::int AS n FROM admissions WHERE application_date BETWEEN $1 AND $2 GROUP BY 1, 2 ORDER BY 1, 2`, [fromDate, toDate]);
    return { columns: ["CLASS", "STATUS", "APPLICATIONS"], rows: r.rows.map((x) => row(x.class_name || dash, x.status, x.n)), totals: ["Total", dash, r.rows.reduce((s, x) => s + x.n, 0)] };
  },
  "Seat Availability": async () => {
    const r = await query(`SELECT c.title, c.class_name, c.seats, (SELECT COUNT(*)::int FROM admissions a WHERE a.circular_id = c.id AND a.status = 'Admitted') AS admitted FROM admission_circulars c ORDER BY c.created_at DESC`);
    return { columns: ["CIRCULAR", "CLASS", "SEATS", "ADMITTED", "AVAILABLE"], rows: r.rows.map((x) => row(x.title, x.class_name, x.seats, x.admitted, Math.max(0, x.seats - x.admitted))), totals: [] };
  },
  "Merit List": async () => {
    const r = await query(`SELECT id, name, class_name, test_marks, merit_position, status FROM admissions WHERE merit_position IS NOT NULL ORDER BY class_name, merit_position`);
    return { columns: ["POSITION", "APPLICATION", "NAME", "CLASS", "TEST MARKS", "STATUS"], rows: r.rows.map((x) => row(x.merit_position, x.id, x.name, x.class_name, x.test_marks ?? dash, x.status)), totals: [] };
  },
  "Guardian List": async () => {
    const r = await query(`SELECT g.id, g.name, g.mobile, g.relation_default, COUNT(gs.id)::int AS children, g.portal_access FROM guardians g LEFT JOIN guardian_students gs ON gs.guardian_id = g.id GROUP BY g.id ORDER BY g.name`);
    return { columns: ["ID", "NAME", "MOBILE", "RELATION", "CHILDREN", "PORTAL"], rows: r.rows.map((x) => row(x.id, x.name, x.mobile, x.relation_default, x.children, x.portal_access ? "Enabled" : "Disabled")), totals: ["Total guardians", dash, dash, dash, r.rowCount, dash] };
  },
  Siblings: async () => {
    const r = await query(`SELECT g.name AS guardian, g.mobile, string_agg(s.name || ' (' || COALESCE(s.class_name,'') || ')', ', ' ORDER BY s.name) AS students, COUNT(*)::int AS n FROM guardians g JOIN guardian_students gs ON gs.guardian_id = g.id JOIN students s ON s.id = gs.student_id AND s.status = 'Active' GROUP BY g.id HAVING COUNT(*) > 1 ORDER BY n DESC`);
    return { columns: ["GUARDIAN", "MOBILE", "STUDENTS", "COUNT"], rows: r.rows.map((x) => row(x.guardian, x.mobile, x.students, x.n)), totals: [] };
  },
  "ID Card Print Logs": async ({ fromDate, toDate }) => {
    const r = await query(`SELECT id, created_at::date::text AS date, holder_type, job_type, template_name, template_version, card_count, status, created_by_name, reason FROM id_card_print_jobs WHERE created_at::date BETWEEN $1 AND $2 ORDER BY created_at DESC`, [fromDate, toDate]);
    return { columns: ["JOB", "DATE", "HOLDER", "TYPE", "TEMPLATE (VER)", "CARDS", "STATUS", "BY", "REASON"], rows: r.rows.map((x) => row(x.id, x.date, x.holder_type, x.job_type, `${x.template_name} (v${x.template_version})`, x.card_count, x.status, x.created_by_name, x.reason || dash)), totals: ["Total cards", dash, dash, dash, dash, r.rows.reduce((s, x) => s + x.card_count, 0), dash, dash, dash] };
  },
  "Active Cards": async () => {
    const r = await query(`SELECT card_number, holder_type, holder_id, holder_name, issue_date::text, valid_until::text, print_count FROM id_cards WHERE status = 'Active' ORDER BY holder_type, holder_name`);
    return { columns: ["CARD NO", "TYPE", "ID", "NAME", "ISSUED", "VALID UNTIL", "PRINTS"], rows: r.rows.map((x) => row(x.card_number, x.holder_type, x.holder_id, x.holder_name, x.issue_date, x.valid_until || dash, x.print_count)), totals: [] };
  },
  "Card Replacements": async ({ fromDate, toDate }) => {
    const r = await query(`SELECT n.card_number AS new_card, o.card_number AS old_card, n.holder_name, o.block_reason, n.created_at::date::text AS date FROM id_cards n JOIN id_cards o ON o.id = n.replaced_card_id WHERE n.created_at::date BETWEEN $1 AND $2 ORDER BY n.created_at DESC`, [fromDate, toDate]);
    return { columns: ["DATE", "HOLDER", "OLD CARD", "NEW CARD", "REASON"], rows: r.rows.map((x) => row(x.date, x.holder_name, x.old_card, x.new_card, x.block_reason || dash)), totals: [] };
  },
  "Students Without Card": async () => {
    const r = await query(`SELECT s.id, s.name, s.class_name, s.roll, CASE WHEN s.photo_url IS NULL OR s.photo_url = '' THEN 'Missing' ELSE 'OK' END AS photo FROM students s WHERE s.status = 'Active' AND NOT EXISTS (SELECT 1 FROM id_cards c WHERE c.holder_type = 'Student' AND c.holder_id = s.id AND c.status = 'Active') ORDER BY s.class_name, s.roll`);
    return { columns: ["ID", "NAME", "CLASS", "ROLL", "PHOTO"], rows: r.rows.map((x) => row(x.id, x.name, x.class_name, x.roll || dash, x.photo)), totals: ["Total", dash, dash, dash, r.rowCount] };
  },
  "Staff List": async () => {
    const r = await query(`SELECT 'Teacher' AS t, id, name, designation, department, employee_type, phone, status FROM teachers WHERE status <> 'Archived' UNION ALL SELECT 'Staff', id, name, designation, department, employee_type, phone, status FROM staff WHERE status <> 'Archived' ORDER BY 1, 3`);
    return { columns: ["TYPE", "ID", "NAME", "DESIGNATION", "DEPARTMENT", "EMPLOYMENT", "STATUS"], rows: r.rows.map((x) => row(x.t, x.id, x.name, x.designation || dash, x.department || dash, x.employee_type || dash, x.status)), totals: [] };
  },
  "Leave Report": async ({ fromDate, toDate }) => {
    const r = await query(`SELECT applicant_type, applicant_name, leave_type, from_date::text, to_date::text, days, status FROM leave_requests WHERE from_date BETWEEN $1 AND $2 ORDER BY from_date DESC`, [fromDate, toDate]);
    return { columns: ["TYPE", "NAME", "LEAVE", "FROM", "TO", "DAYS", "STATUS"], rows: r.rows.map((x) => row(x.applicant_type, x.applicant_name, x.leave_type, x.from_date, x.to_date, x.days, x.status)), totals: ["Approved days", dash, dash, dash, dash, r.rows.filter((x) => x.status === "Approved").reduce((s, x) => s + x.days, 0), dash] };
  },
  "Staff Attendance Summary": async ({ fromDate, toDate }) => {
    const r = await query(`SELECT employee_type, MAX(employee_name) AS name, COUNT(*) FILTER (WHERE status='Present')::int AS p, COUNT(*) FILTER (WHERE status='Late')::int AS l, COUNT(*) FILTER (WHERE status='Absent')::int AS a, COUNT(*) FILTER (WHERE status='Leave')::int AS lv FROM staff_attendance WHERE attendance_date BETWEEN $1 AND $2 GROUP BY employee_type, employee_id ORDER BY 1, 2`, [fromDate, toDate]);
    return { columns: ["TYPE", "NAME", "PRESENT", "LATE", "ABSENT", "LEAVE"], rows: r.rows.map((x) => row(x.employee_type, x.name, x.p, x.l, x.a, x.lv)), totals: [] };
  },
  "Books Issued": async ({ fromDate, toDate }) => {
    const r = await query(`SELECT li.issue_date::text, b.title, li.borrower_type, li.borrower_name, li.due_date::text, li.status, li.fine FROM library_issues li JOIN library_books b ON b.id = li.book_id WHERE li.issue_date BETWEEN $1 AND $2 ORDER BY li.issue_date DESC`, [fromDate, toDate]);
    return { columns: ["ISSUED", "BOOK", "BORROWER TYPE", "BORROWER", "DUE", "STATUS", "FINE"], rows: r.rows.map((x) => row(x.issue_date, x.title, x.borrower_type, x.borrower_name, x.due_date, x.status, money(x.fine))), totals: [] };
  },
  "Overdue Books": async () => {
    const r = await query(`SELECT b.title, li.borrower_name, li.due_date::text, (CURRENT_DATE - li.due_date) AS days FROM library_issues li JOIN library_books b ON b.id = li.book_id WHERE li.status IN ('Issued','Overdue') AND li.due_date < CURRENT_DATE ORDER BY li.due_date`);
    return { columns: ["BOOK", "BORROWER", "DUE", "DAYS OVERDUE"], rows: r.rows.map((x) => row(x.title, x.borrower_name, x.due_date, x.days)), totals: [] };
  },
  "Transport Route Students": async () => {
    const r = await query(`SELECT rt.name AS route, ta.stop_name, s.name, s.class_name, ta.monthly_fee FROM transport_assignments ta JOIN transport_routes rt ON rt.id = ta.route_id JOIN students s ON s.id = ta.student_id WHERE ta.status = 'Active' ORDER BY rt.name, ta.stop_name, s.name`);
    return { columns: ["ROUTE", "STOP", "STUDENT", "CLASS", "MONTHLY FEE"], rows: r.rows.map((x) => row(x.route, x.stop_name || dash, x.name, x.class_name, money(x.monthly_fee))), totals: ["Students", dash, r.rowCount, dash, dash] };
  },
  "Hifz Progress": async () => {
    const r = await query(`SELECT s.name, s.class_name, COUNT(hp.id) FILTER (WHERE hp.status IN ('Done','Revised'))::int AS done FROM students s JOIN hifz_progress hp ON hp.student_id = s.id GROUP BY s.id ORDER BY done DESC`);
    return { columns: ["STUDENT", "CLASS", "PARAS COMPLETED", "PROGRESS"], rows: r.rows.map((x) => row(x.name, x.class_name, `${x.done}/30`, pct((x.done / 30) * 100))), totals: [] };
  },
  "Salah Summary": async ({ fromDate, toDate }) => {
    const r = await query(`SELECT s.name, s.class_name, COUNT(*) FILTER (WHERE sa.status='Jamaat')::int AS j, COUNT(*) FILTER (WHERE sa.status='Missed')::int AS m, COUNT(*)::int AS t FROM salah_attendance sa JOIN students s ON s.id = sa.student_id WHERE sa.attendance_date BETWEEN $1 AND $2 GROUP BY s.id ORDER BY s.class_name, s.name`, [fromDate, toDate]);
    return { columns: ["STUDENT", "CLASS", "JAMAAT", "MISSED", "JAMAAT %"], rows: r.rows.map((x) => row(x.name, x.class_name, x.j, x.m, pct(x.t ? (x.j / x.t) * 100 : 0))), totals: [] };
  },
  "Donations by Fund": async ({ fromDate, toDate }) => {
    const r = await query(`SELECT fund, COUNT(*)::int AS n, COALESCE(SUM(amount),0) AS total FROM donations WHERE donation_date BETWEEN $1 AND $2 GROUP BY fund ORDER BY total DESC`, [fromDate, toDate]);
    return { columns: ["FUND", "DONATIONS", "AMOUNT"], rows: r.rows.map((x) => row(x.fund, x.n, money(x.total))), totals: ["Total", r.rows.reduce((s, x) => s + x.n, 0), money(r.rows.reduce((s, x) => s + Number(x.total), 0))] };
  },
});

function canSeeCategory(user, category) {
  if (!user || user.isAdmin) return true;
  const actions = user.matrix?.[category.module] || [];
  return actions.includes("view") && (user.matrix?.reports || []).includes("view");
}

router.get("/catalog", asyncHandler(async (req, res) => {
  const categories = reportCategories.filter((c) => canSeeCategory(req.user, c));
  res.json({
    success: true,
    data: {
      categories,
      defaultReport: categories[0]?.reports[0] || null,
    },
  });
}));

router.get("/", asyncHandler(async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const year = today.slice(0, 4);
  const type = req.query.type || reportCategories[0].reports[0];
  const fromDate = req.query.from || `${year}-01-01`;
  const toDate = req.query.to || today;
  const handler = handlers[type];

  if (!handler) {
    return res.status(404).json({
      success: false,
      message: "Report not found",
    });
  }
  const category = reportCategories.find((c) => c.reports.includes(type));
  if (category && !canSeeCategory(req.user, category)) {
    return res.status(403).json({ success: false, message: "You do not have access to this report." });
  }

  const reportData = await handler({ fromDate, toDate });
  res.json({
    success: true,
    data: {
      ...reportData,
      type,
      fromDate,
      toDate,
      generatedAt: new Date().toISOString(),
    },
  });
}));

module.exports = router;
