const express = require("express");
const { query } = require("../db/pool");
const asyncHandler = require("../utils/asyncHandler");
const { localMonth } = require("../utils/dates");

const router = express.Router();

router.get("/summary", asyncHandler(async (req, res) => {
  // 1. Get counts
  const studentCount = await query("SELECT COUNT(*)::int AS count FROM students WHERE status = 'Active'");
  const teacherCount = await query("SELECT COUNT(*)::int AS count FROM teachers WHERE status = 'Active'");
  const staffCount = await query("SELECT COUNT(*)::int AS count FROM staff WHERE status = 'Active'");

  // 2. Get attendance (Latest date)
  const attRes = await query(`
    SELECT 
      COUNT(*)::int AS total,
      SUM(CASE WHEN status IN ('Present', 'Late') THEN 1 ELSE 0 END)::int AS present
    FROM attendance
    WHERE attendance_date = (SELECT MAX(attendance_date) FROM attendance)
  `);
  let attendanceRate = "0.0%";
  let attendanceDetails = "No attendance recorded yet";
  
  if (attRes.rowCount > 0 && attRes.rows[0].total > 0) {
    const total = attRes.rows[0].total;
    const present = attRes.rows[0].present || 0;
    const rate = (present / total) * 100;
    attendanceRate = `${rate.toFixed(1)}%`;
    attendanceDetails = `${present} / ${total} present`;
  } else {
    const totalSt = studentCount.rows[0].count || 0;
    attendanceDetails = `0 / ${totalSt.toLocaleString()} present`;
  }

  // 3. Finance stats
  const monthlyFinance = await query(`
    SELECT
      (SELECT COALESCE(SUM(amount), 0)::numeric FROM financial_transactions
       WHERE type = 'Income' AND DATE_TRUNC('month', transaction_date) = DATE_TRUNC('month', CURRENT_DATE)) AS monthly_income,
      (SELECT COALESCE(SUM(amount), 0)::numeric FROM financial_transactions
       WHERE type = 'Expense' AND DATE_TRUNC('month', transaction_date) = DATE_TRUNC('month', CURRENT_DATE)) AS monthly_expense
  `);
  const fin = monthlyFinance.rows[0];

  // Fee collection stats
  const feeInvoices = await query(`
    SELECT 
      COALESCE(SUM(amount), 0)::numeric AS total,
      COALESCE(SUM(paid_amount), 0)::numeric AS paid,
      COALESCE(SUM(discount), 0)::numeric AS discount
    FROM fee_invoices
    WHERE status <> 'Cancelled'
  `);
  const fees = feeInvoices.rows[0];
  const feeTotalNet = Number(fees.total) - Number(fees.discount);
  const feeCollectionRate = feeTotalNet > 0 ? Math.round((Number(fees.paid) / feeTotalNet) * 100) : 0;

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
  
  // Generate last 6 months list dynamically with 0s
  const monthlyRevenue = [];
  const [cy, cm] = localMonth().split("-").map(Number);
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(cy, cm - 1 - i, 1));
    const mName = d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
    monthlyRevenue.push({ month: mName, income: 0, expense: 0 });
  }

  // Populate actuals from query
  revenueHistory.rows.forEach(r => {
    const match = monthlyRevenue.find(m => m.month.toLowerCase() === r.month.trim().toLowerCase());
    if (match) {
      match.income = Math.round(Number(r.income) / 1000);
      match.expense = Math.round(Number(r.expense) / 1000);
    }
  });

  // 5. Upcoming Exams
  const examsRes = await query(`
    SELECT name, start_date AS date, status 
    FROM exams 
    ORDER BY start_date ASC 
    LIMIT 4
  `);
  
  let exams = examsRes.rows.map(e => {
    let color = "blue";
    if (e.status === "Ongoing") color = "green";
    if (e.status === "Upcoming") color = "amber";
    
    // Format date nicely
    const dateStr = e.date ? String(e.date).slice(0, 10) : "";

    return {
      name: e.name,
      className: "All Classes",
      date: dateStr,
      status: e.status,
      color
    };
  });

  // No fallback for exams

  // 6. Recent Activities
  const recentAdmissions = await query(`
    SELECT name, class_name, created_at FROM admissions 
    ORDER BY created_at DESC LIMIT 3
  `);
  const recentTransactions = await query(`
    SELECT type, description, amount, created_at FROM financial_transactions 
    ORDER BY created_at DESC LIMIT 3
  `);
  const recentNotices = await query(`
    SELECT title, created_at FROM notices 
    ORDER BY created_at DESC LIMIT 2
  `);

  const activitiesList = [];
  recentAdmissions.rows.forEach(a => {
    activitiesList.push({
      text: `New student ${a.name} applied for admission in ${a.class_name}`,
      time: a.created_at,
      icon: "UserPlus",
      tone: "blue"
    });
  });
  recentTransactions.rows.forEach(t => {
    activitiesList.push({
      text: `${t.type === 'Income' ? 'Received' : 'Paid'} ৳${Number(t.amount).toLocaleString()} for ${t.description}`,
      time: t.created_at,
      icon: "DollarSign",
      tone: t.type === 'Income' ? "green" : "rose"
    });
  });
  recentNotices.rows.forEach(n => {
    activitiesList.push({
      text: `Notice published: ${n.title}`,
      time: n.created_at,
      icon: "Bell",
      tone: "amber"
    });
  });

  // Sort activities by time
  activitiesList.sort((a, b) => new Date(b.time) - new Date(a.time));
  
  // Format times to "X mins/hours ago"
  const now = new Date();
  const formattedActivities = activitiesList.slice(0, 6).map(act => {
    const diffMs = now - new Date(act.time);
    const diffMins = Math.round(diffMs / 60000);
    let timeLabel = "Just now";
    
    if (diffMins > 0) {
      if (diffMins < 60) {
        timeLabel = `${diffMins} min ago`;
      } else {
        const diffHrs = Math.round(diffMins / 60);
        if (diffHrs < 24) {
          timeLabel = `${diffHrs} hour${diffHrs > 1 ? 's' : ''} ago`;
        } else {
          timeLabel = `${Math.round(diffHrs / 24)} day${Math.round(diffHrs / 24) > 1 ? 's' : ''} ago`;
        }
      }
    }
    
    return {
      text: act.text,
      time: timeLabel,
      icon: act.icon,
      tone: act.tone
    };
  });

  // No fallback for activities

  // 4. Student growth data (Cumulative growth based on actual student admission_date or creation date)
  const studentCountRes = await query(`
    SELECT 
      CASE 
        WHEN COALESCE(admission_date, created_at) < DATE_TRUNC('year', CURRENT_DATE) THEN 1
        ELSE EXTRACT(MONTH FROM COALESCE(admission_date, created_at))::int
      END AS month_num,
      COUNT(*)::int AS count
    FROM students
    WHERE status = 'Active'
    GROUP BY 1
  `);

  const monthlyCounts = Array(12).fill(0);
  studentCountRes.rows.forEach(r => {
    const idx = r.month_num - 1;
    if (idx >= 0 && idx < 12) {
      monthlyCounts[idx] = r.count;
    }
  });

  const monthsList = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  let runningTotal = 0;
  const studentGrowth = monthsList.map((m, idx) => {
    runningTotal += monthlyCounts[idx];
    return [m, runningTotal];
  });

  // 5. Weekly attendance data
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
  
  let weeklyAttendance = [
    ["Mon", 0], ["Tue", 0], ["Wed", 0], ["Thu", 0], ["Fri", 0], ["Sat", 0]
  ];
  
  if (weeklyAtt.rowCount > 0) {
    const dbDays = {};
    weeklyAtt.rows.forEach(r => {
      const rate = r.total > 0 ? Math.round((r.present / r.total) * 100) : 0;
      dbDays[r.day] = rate;
    });
    
    weeklyAttendance = weeklyAttendance.map(([day]) => [
      day,
      dbDays[day] !== undefined ? dbDays[day] : 0
    ]);
  }

  // 7. Bottom Stats
  const newAdmissionsRes = await query(`
    SELECT COUNT(*)::int AS count FROM admissions
    WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)
  `);
  const feeDueRes = await query(`
    SELECT COALESCE(SUM(amount - discount - paid_amount), 0)::numeric AS count FROM fee_invoices
    WHERE status IN ('Due', 'Overdue', 'Partial')
  `);
  const payrollProcessedRes = await query(`
    SELECT COALESCE(SUM(net_pay), 0)::numeric AS count FROM payroll_records
    WHERE status = 'Paid' AND DATE_TRUNC('month', payroll_month) = DATE_TRUNC('month', CURRENT_DATE)
  `);
  const reportsGeneratedRes = await query("SELECT COUNT(*)::int AS count FROM marks");

  res.json({
    success: true,
    data: {
      counts: {
        students: studentCount.rows[0].count || 0,
        teachers: teacherCount.rows[0].count || 0,
        staff: staffCount.rows[0].count || 0,
        attendanceRate,
        attendanceDetails
      },
      finance: {
        monthlyIncome: Number(fin.monthly_income) || 0,
        monthlyExpense: Number(fin.monthly_expense) || 0,
        feeCollectionRate: feeCollectionRate || 0,
        feeCollected: Number(fees.paid) || 0,
        feePending: Number(fees.total) - Number(fees.discount) - Number(fees.paid) || 0,
        monthlyRevenue
      },
      studentGrowth,
      weeklyAttendance,
      exams,
      activities: formattedActivities,
      bottomStats: {
        newAdmissions: newAdmissionsRes.rows[0].count || 0,
        feeDue: Number(feeDueRes.rows[0].count) || 0,
        reportsGenerated: reportsGeneratedRes.rows[0].count || 0,
        payrollProcessed: Number(payrollProcessedRes.rows[0].count) || 0
      }
    }
  });
}));

module.exports = router;
