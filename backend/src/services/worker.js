// Background jobs (SRS §3: notifications, invoices, reminders run in a queue).
// Runs inside the API process on a timer; each job is guarded so one failure
// never stops the others. Daily jobs run once per day after their hour.
const { query } = require("../db/pool");
const { processQueue } = require("./notifications");
const { createBackup, pruneBackups } = require("./backup");

const lastRun = {};
function dueToday(key, hour = 0) {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  if (lastRun[key] === today || now.getHours() < hour) return false;
  lastRun[key] = today;
  return true;
}

async function safe(name, fn) {
  try {
    await fn();
  } catch (error) {
    console.error(`[worker] ${name} failed:`, error.message);
  }
}

async function tick() {
  await safe("notifications", () => processQueue(100));

  // Scheduled notices whose time has come (CM-01 publish schedule).
  await safe("scheduled-notices", async () => {
    const due = (await query(
      "SELECT id FROM notices WHERE status = 'Scheduled' AND scheduled_at <= NOW() AND approval_status IN ('Not Required','Approved') LIMIT 20",
    )).rows;
    if (due.length) {
      const { dispatchNotice } = require("./notices");
      for (const n of due) await dispatchNotice(n.id);
    }
  });

  const settings = (await query("SELECT * FROM system_settings WHERE id = 1").catch(() => ({ rows: [{}] }))).rows[0] || {};
  const fees = require("../routes/fees");

  if (dueToday("late-fines", 1)) await safe("late-fines", () => fees.applyLateFines());
  if (new Date().getDate() === Number(settings.invoice_generation_day || 1) && dueToday("invoices", 2)) {
    await safe("invoices", () => fees.generateInvoices(new Date().toISOString().slice(0, 7)));
  }
  if (settings.notify_fee_reminder && new Date().getDate() === Number(settings.fee_reminder_day || 5) && dueToday("fee-reminders", 10)) {
    await safe("fee-reminders", () => fees.sendDueReminders({ minDue: 1 }));
  }

  // Auto-lock marks entry after the deadline (EX-10).
  if (dueToday("marks-lock", 0)) {
    await safe("marks-lock", () => query(
      `UPDATE marks_entry_status mes SET status = 'Locked', locked_at = NOW() FROM exams e
       WHERE e.id = mes.exam_id AND mes.status = 'Open' AND e.marks_entry_end < CURRENT_DATE`,
    ));
  }

  // Expire cards and discounts; mark overdue library issues.
  if (dueToday("expiry", 0)) {
    await safe("expire-cards", () => query("UPDATE id_cards SET status = 'Expired' WHERE status = 'Active' AND valid_until < CURRENT_DATE"));
    await safe("expire-discounts", () => query("UPDATE fee_discounts SET status = 'Expired' WHERE status = 'Approved' AND valid_to < CURRENT_DATE"));
    await safe("library-overdue", () => query("UPDATE library_issues SET status = 'Overdue' WHERE status = 'Issued' AND due_date < CURRENT_DATE"));
  }

  // Consecutive absence alerts to class teacher / principal (AT-07).
  if (dueToday("absence-alerts", 12)) {
    await safe("absence-alerts", async () => {
      const threshold = Number(settings.consecutive_absence_threshold || 3);
      const rows = (await query(
        `WITH r AS (SELECT student_id, status, ROW_NUMBER() OVER (PARTITION BY student_id ORDER BY attendance_date DESC) rn
                    FROM attendance WHERE attendance_date > CURRENT_DATE - 30)
         SELECT s.id, s.name, s.class_name FROM r JOIN students s ON s.id = r.student_id
         WHERE r.rn <= $1 AND r.status = 'Absent' GROUP BY s.id HAVING COUNT(*) >= $1`,
        [threshold],
      )).rows;
      const { queueMessage } = require("./notifications");
      for (const s of rows) {
        await queueMessage({ channel: "Portal", eventType: "ConsecutiveAbsence", recipientType: "Role", recipientId: "attendance",
          subject: "Consecutive absence", body: `${s.name} (${s.class_name}) has been absent ${threshold}+ consecutive days.`, studentId: s.id });
      }
    });
  }

  // Daily automated backup (NFR-05).
  if (dueToday("backup", 2)) {
    await safe("backup", async () => {
      await createBackup("daily");
      const days = parseInt(String(settings.backup_retention || "30"), 10) || 30;
      await pruneBackups(days);
    });
  }
}

let timer = null;
function startWorker(intervalMs = 60_000) {
  if (timer) return;
  setTimeout(() => tick().catch(() => {}), 5_000);
  timer = setInterval(() => tick().catch(() => {}), intervalMs);
  timer.unref();
  console.log("Background worker started.");
}

module.exports = { startWorker, tick };
