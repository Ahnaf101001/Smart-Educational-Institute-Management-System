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
    `SELECT g.id, g.name, g.mobile, g.email, g.notification_prefs, gs.is_primary, gs.relation
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

// Guardian opt-out policy (CM-09, COM-07). prefs = { sms: false, email: false, push: false,
// whatsapp: false, events: { Absent: false, ... } }. Safety-critical events are never suppressed.
const MANDATORY_EVENTS = new Set(["OTP", "Emergency", "EmergencyAlert", "PasswordReset"]);
function optedOut(prefs, channel, eventType) {
  if (!prefs || MANDATORY_EVENTS.has(eventType) || channel === "Portal") return false;
  if (prefs[String(channel).toLowerCase()] === false) return true;
  if (prefs.events && prefs.events[eventType] === false) return true;
  return false;
}

// Sends an event notification to a student's guardian(s) on the chosen channels.
async function notifyStudentGuardians(studentId, { eventType, body, subject, channels = ["SMS", "Portal"], primaryOnly = true, relatedType, relatedId }) {
  const guardians = await guardiansForStudent(studentId, { primaryOnly });
  let queued = 0;
  for (const g of guardians) {
    for (const channel of channels) {
      const recipient = channel === "SMS" || channel === "WhatsApp" ? g.mobile : channel === "Email" ? g.email : g.id;
      if (channel !== "Portal" && !recipient) continue;
      if (optedOut(g.notification_prefs, channel, eventType)) continue;
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

// WhatsApp Business Cloud API (NF-20 / §34, optional channel).
async function sendWhatsApp(message) {
  if (!env.whatsapp.token || !env.whatsapp.phoneNumberId) {
    throw new Error("WhatsApp Business API is not configured (set WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID).");
  }
  const digits = String(message.recipient || "").replace(/\D/g, "");
  const to = digits.startsWith("0") ? `88${digits}` : digits;
  const response = await fetch(`${env.whatsapp.apiBase}/${env.whatsapp.phoneNumberId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.whatsapp.token}` },
    body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: message.body } }),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`WhatsApp error ${response.status}: ${text.slice(0, 200)}`);
  let id = null;
  try { id = JSON.parse(text)?.messages?.[0]?.id || null; } catch { /* ignore */ }
  return { provider: "whatsapp", providerMessageId: id };
}

async function deliver(message) {
  switch (message.channel) {
    case "SMS": return sendSms(message);
    case "Email": return sendEmailMessage(message);
    case "Push": return sendPush(message);
    case "WhatsApp": return sendWhatsApp(message);
    case "Portal": return { provider: "portal", providerMessageId: null };
    default: throw new Error(`Unknown channel ${message.channel}`);
  }
}

// Channel failure fallback (COM-07, scenario "SMS provider unavailable"): only when configured.
async function queueFallback(message) {
  if (message.channel !== "SMS" || message.event_type === "OTP") return;
  const settings = await getSettings();
  const fallback = settings.sms_fallback_channel;
  if (!fallback || fallback === "SMS") return;
  let recipient = message.recipient;
  if (fallback === "Portal" || fallback === "Push") recipient = message.recipient_id;
  if (fallback === "Email") {
    const g = message.recipient_type === "Guardian" && message.recipient_id
      ? (await query("SELECT email FROM guardians WHERE id = $1", [message.recipient_id])).rows[0] : null;
    recipient = g?.email;
  }
  if (!recipient) return;
  await queueMessage({
    channel: fallback, eventType: message.event_type, recipient, recipientType: message.recipient_type,
    recipientId: message.recipient_id, studentId: message.student_id, subject: message.subject,
    body: message.body, relatedType: "message_logs", relatedId: message.id,
  });
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
          `UPDATE message_logs SET attempts = $1::int, error = $2,
             status = CASE WHEN $1::int >= $3::int THEN 'Failed' ELSE 'Queued' END,
             scheduled_at = NOW() + (INTERVAL '2 minutes' * $1::int)
           WHERE id = $4`,
          [attempts, error.message.slice(0, 500), MAX_ATTEMPTS, message.id],
        );
        if (attempts >= MAX_ATTEMPTS) await queueFallback(message).catch(() => {});
      }
      processed += 1;
    }
  } finally {
    processing = false;
  }
  return processed;
}

module.exports = {
  optedOut,
  smsParts,
  queueMessage,
  guardiansForStudent,
  notifyStudentGuardians,
  processQueue,
  getSettings,
};
