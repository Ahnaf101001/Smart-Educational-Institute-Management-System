// Scheduled report e-mails (v1 OM-11): e.g. daily collection summary to the owner.
const { query } = require("../db/pool");
const { queueMessage } = require("./notifications");

const money = (v) => `BDT ${Number(v || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

const REPORTS = {
  daily_collection: {
    label: "Daily collection summary",
    build: async () => {
      const r = (await query(
        `SELECT COUNT(*)::int AS n, COALESCE(SUM(amount), 0) AS total,
                COALESCE(json_agg(json_build_object('m', payment_method, 'a', amount)) FILTER (WHERE id IS NOT NULL), '[]') AS items
         FROM fee_payments WHERE paid_at::date = CURRENT_DATE AND COALESCE(status, 'Completed') <> 'Cancelled'`,
      )).rows[0];
      const byMethod = {};
      for (const i of r.items) byMethod[i.m || "Other"] = (byMethod[i.m || "Other"] || 0) + Number(i.a);
      return [`Fee collection today: ${money(r.total)} from ${r.n} receipts.`,
        ...Object.entries(byMethod).map(([m, a]) => ` • ${m}: ${money(a)}`)].join("\n");
    },
  },
  attendance_summary: {
    label: "Attendance summary",
    build: async () => {
      const r = (await query(
        `SELECT COUNT(*) FILTER (WHERE status = 'Present')::int AS p, COUNT(*) FILTER (WHERE status = 'Absent')::int AS a,
                COUNT(*) FILTER (WHERE status = 'Late')::int AS l, COUNT(*) FILTER (WHERE status = 'Leave')::int AS lv
         FROM attendance WHERE attendance_date = CURRENT_DATE`,
      )).rows[0];
      const s = (await query("SELECT COUNT(*) FILTER (WHERE status IN ('Present','Late'))::int AS p, COUNT(*)::int AS t FROM staff_attendance WHERE attendance_date = CURRENT_DATE")).rows[0];
      return `Students today – Present ${r.p}, Absent ${r.a}, Late ${r.l}, Leave ${r.lv}.\nStaff present: ${s.p}/${s.t}.`;
    },
  },
  fee_due: {
    label: "Fee due summary",
    build: async () => {
      const r = (await query(
        `SELECT COUNT(DISTINCT student_id)::int AS students, COALESCE(SUM(amount + COALESCE(late_fine, 0) - discount - paid_amount), 0) AS due,
                COUNT(*) FILTER (WHERE due_date < CURRENT_DATE)::int AS overdue
         FROM fee_invoices WHERE status NOT IN ('Paid', 'Cancelled')`,
      )).rows[0];
      return `Outstanding fees: ${money(r.due)} across ${r.students} students (${r.overdue} overdue invoices).`;
    },
  },
  income_expense: {
    label: "Income / expense (month to date)",
    build: async () => {
      const r = (await query(
        `SELECT COALESCE(SUM(amount) FILTER (WHERE LOWER(type) = 'income'), 0) AS income, COALESCE(SUM(amount) FILTER (WHERE LOWER(type) = 'expense'), 0) AS expense
         FROM financial_transactions WHERE date_trunc('month', transaction_date) = date_trunc('month', CURRENT_DATE) AND COALESCE(reversed, FALSE) = FALSE`,
      )).rows[0];
      return `Month to date – Income ${money(r.income)}, Expense ${money(r.expense)}, Net ${money(Number(r.income) - Number(r.expense))}.`;
    },
  },
  admissions: {
    label: "Admission pipeline",
    build: async () => {
      const rows = (await query("SELECT status, COUNT(*)::int AS n FROM admissions GROUP BY status ORDER BY n DESC")).rows;
      return rows.length ? `Applications by status:\n${rows.map((r) => ` • ${r.status}: ${r.n}`).join("\n")}` : "No admission applications.";
    },
  },
  pending_approvals: {
    label: "Pending approvals",
    build: async () => {
      const rows = (await query("SELECT request_type, COUNT(*)::int AS n FROM approval_requests WHERE status IN ('Pending','Clarification') GROUP BY 1")).rows;
      return rows.length ? `Pending approvals:\n${rows.map((r) => ` • ${r.request_type}: ${r.n}`).join("\n")}` : "No pending approvals.";
    },
  },
};

async function runSchedule(schedule) {
  const report = REPORTS[schedule.report_type];
  if (!report) throw new Error(`Unknown report type ${schedule.report_type}`);
  const profile = (await query("SELECT name FROM institute_profile WHERE id = 1")).rows[0] || {};
  const body = `${profile.name || "Institution"} – ${report.label} (${new Date().toISOString().slice(0, 10)})\n\n${await report.build()}`;
  let queued = 0;
  for (const to of schedule.recipients || []) {
    if (!String(to).trim()) continue;
    await queueMessage({
      channel: String(to).includes("@") ? "Email" : "SMS", eventType: "ScheduledReport", recipient: String(to).trim(),
      recipientType: "Report", subject: `${report.label} – ${profile.name || ""}`.trim(), body, relatedType: "report_schedules", relatedId: String(schedule.id),
    });
    queued += 1;
  }
  await query("UPDATE report_schedules SET last_run_at = NOW() WHERE id = $1", [schedule.id]);
  return { queued, preview: body };
}

// Worker hook: runs each active schedule once in its period after its send hour.
async function runDueSchedules() {
  const now = new Date();
  const rows = (await query("SELECT * FROM report_schedules WHERE status = 'Active'")).rows;
  for (const s of rows) {
    if (now.getHours() < Number(s.send_hour ?? 20)) continue;
    const last = s.last_run_at ? new Date(s.last_run_at) : null;
    const sameDay = last && last.toDateString() === now.toDateString();
    if (s.frequency === "Daily" && sameDay) continue;
    if (s.frequency === "Weekly" && (now.getDay() !== 0 || sameDay)) continue;
    if (s.frequency === "Monthly" && (now.getDate() !== 1 || sameDay)) continue;
    await runSchedule(s).catch((e) => console.error("[worker] report schedule failed:", e.message));
  }
}

module.exports = { REPORTS, runSchedule, runDueSchedules };
