// Notification queue for SMS / Email / Push / Portal (SRS §13, INT-01/02/07,
// COM-03, CM-06). Messages are written to message_logs with status Queued and a
// background worker delivers them through the configured provider adapters.
// When a provider is not configured the message stays visible with a clear
// error instead of being reported as sent.
const nodemailer = require("nodemailer");
const env = require("../config/env");
const { query } = require("../db/pool");

const MAX_ATTEMPTS = 3;

function smsParts(body) {
  const text = String(body || "");
  // Unicode (Bangla) SMS = 70 chars/part (67 when concatenated); GSM = 160 (153).
  const unicode = /[^\u0000-\u007f]/.test(text);
  const single = unicode ? 70 : 160;
  const multi = unicode ? 67 : 153;
  if (text.length <= single) return 1;
  return Math.ceil(text.length / multi);
}

async function getSettings() {
  const result = await query("SELECT * FROM system_settings WHERE id = 1");
  return result.rows[0] || {};
}

async function queueMessage(message, executor) {
  const run = executor ? executor.query.bind(executor) : query;
  const parts = message.channel === "SMS" ? smsParts(message.body) : 1;
  const settings = message.channel === "SMS" ? await getSettings() : {};
  const cost = message.channel === "SMS" ? parts * Number(settings.sms_cost_per_part || 0) : 0;
  const result = await run(
    `INSERT INTO message_logs
       (channel, event_type, recipient, recipient_type, recipient_id, student_id, subject, body,
        parts, cost, related_type, related_id, scheduled_at, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,COALESCE($13, NOW()),$14)
     RETURNING id`,
    [
      message.channel,
      message.eventType || "General",
      message.recipient || null,
      message.recipientType || null,
      message.recipientId || null,
      message.studentId || null,
      message.subject || null,
      message.body,
      parts,
      cost,
      message.relatedType || null,
      message.relatedId || null,
      message.scheduledAt || null,
      message.recipient || message.channel === "Portal" ? "Queued" : "Skipped",
    ],
  );
  return result.rows[0].id;
}

// Resolves the guardians who receive notifications for a student.
async function guardiansForStudent(studentId, { primaryOnly = false } = {}) {
  const result = await query(
    `SELECT g.id, g.name, g.mobile, g.email, gs.is_primary, gs.relation
     FROM guardian_students gs
     JOIN guardians g ON g.id = gs.guardian_id
     WHERE gs.student_id = $1 AND gs.receives_notifications AND gs.access_status = 'Enabled'
       AND g.status = 'Active' ${primaryOnly ? "AND gs.is_primary" : ""}
     ORDER BY gs.is_primary DESC`,
    [studentId],
  );
  if (result.rowCount) return result.rows;
  // Fallback to the contact stored on the student record.
  const student = await query("SELECT guardian_name, parent_contact, email FROM students WHERE id = $1", [studentId]);
  const s = student.rows[0];
  if (!s || !s.parent_contact) return [];
  return [{ id: null, name: s.guardian_name, mobile: s.parent_contact, email: null, is_primary: true }];
}

// Sends an event notification to a student's guardian(s) on the chosen channels.
async function notifyStudentGuardians(studentId, { eventType, body, subject, channels = ["SMS", "Portal"], primaryOnly = true, relatedType, relatedId }) {
  const guardians = await guardiansForStudent(studentId, { primaryOnly });
  let queued = 0;
  for (const g of guardians) {
    for (const channel of channels) {
      const recipient = channel === "SMS" ? g.mobile : channel === "Email" ? g.email : channel === "Push" ? g.id : g.id;
      if (channel !== "Portal" && !recipient) continue;
      await queueMessage({
        channel,
        eventType,
        recipient,
        recipientType: "Guardian",
        recipientId: g.id,
        studentId,
        subject,
        body,
        relatedType,
        relatedId,
      });
      queued += 1;
    }
  }
  return queued;
}

// ------------------------------------------------------------------ adapters
async function sendSms(message) {
  if (!env.sms.apiUrl || !env.sms.apiKey) {
    throw new Error("SMS provider is not configured (set SMS_API_URL and SMS_API_KEY).");
  }
  const response = await fetch(env.sms.apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.sms.apiKey}` },
    body: JSON.stringify({
      to: message.recipient,
      message: message.body,
      sender_id: env.sms.senderId || undefined,
    }),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`SMS provider error ${response.status}: ${text.slice(0, 200)}`);
  let id = null;
  try { id = JSON.parse(text)?.message_id || JSON.parse(text)?.id || null; } catch { /* ignore */ }
  return { provider: "sms-gateway", providerMessageId: id };
}

let mailer = null;
async function sendEmailMessage(message) {
  if (!(env.email.host && env.email.user && env.email.pass && env.email.from)) {
    throw new Error("Email (SMTP) is not configured.");
  }
  mailer = mailer || nodemailer.createTransport({
    host: env.email.host,
    port: env.email.port,
    secure: env.email.secure,
    auth: { user: env.email.user, pass: env.email.pass },
  });
  const info = await mailer.sendMail({
    from: env.email.from,
    to: message.recipient,
    subject: message.subject || "Notification",
    text: message.body,
  });
  return { provider: "smtp", providerMessageId: info.messageId };
}

async function sendPush(message) {
  if (!env.push.fcmServerKey) {
    throw new Error("Push provider (FCM) is not configured.");
  }
  const response = await fetch("https://fcm.googleapis.com/fcm/send", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `key=${env.push.fcmServerKey}` },
    body: JSON.stringify({
      to: `/topics/guardian-${message.recipient_id}`,
      notification: { title: message.subject || "Notification", body: message.body },
    }),
  });
  if (!response.ok) throw new Error(`FCM error ${response.status}`);
  return { provider: "fcm", providerMessageId: null };
}

async function deliver(message) {
  switch (message.channel) {
    case "SMS": return sendSms(message);
    case "Email": return sendEmailMessage(message);
    case "Push": return sendPush(message);
    case "Portal": return { provider: "portal", providerMessageId: null };
    default: throw new Error(`Unknown channel ${message.channel}`);
  }
}

let processing = false;
async function processQueue(limit = 50) {
  if (processing) return 0;
  processing = true;
  let processed = 0;
  try {
    const result = await query(
      `SELECT * FROM message_logs
       WHERE status = 'Queued' AND scheduled_at <= NOW() AND attempts < $1
       ORDER BY scheduled_at LIMIT $2`,
      [MAX_ATTEMPTS, limit],
    );
    for (const message of result.rows) {
      try {
        const info = await deliver(message);
        await query(
          `UPDATE message_logs SET status = $1, provider = $2, provider_message_id = $3,
             sent_at = NOW(), attempts = attempts + 1, error = NULL WHERE id = $4`,
          [message.channel === "Portal" ? "Delivered" : "Sent", info.provider, info.providerMessageId, message.id],
        );
      } catch (error) {
        const attempts = Number(message.attempts) + 1;
        await query(
          `UPDATE message_logs SET attempts = $1, error = $2,
             status = CASE WHEN $1 >= $3 THEN 'Failed' ELSE 'Queued' END,
             scheduled_at = NOW() + (INTERVAL '2 minutes' * $1)
           WHERE id = $4`,
          [attempts, error.message.slice(0, 500), MAX_ATTEMPTS, message.id],
        );
      }
      processed += 1;
    }
  } finally {
    processing = false;
  }
  return processed;
}

module.exports = {
  smsParts,
  queueMessage,
  guardiansForStudent,
  notifyStudentGuardians,
  processQueue,
  getSettings,
};
