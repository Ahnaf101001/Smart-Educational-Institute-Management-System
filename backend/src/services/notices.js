// Notice / bulk message dispatch (SRS CM-01..06, COM-01..03).
const { query } = require("../db/pool");
const httpError = require("../utils/httpError");
const { queueMessage, smsParts, getSettings, optedOut } = require("./notifications");

function channelsOf(notice) {
  const c = String(notice.channel || "Notice").toLowerCase();
  const list = [];
  if (c.includes("sms") || c === "both" || c === "all") list.push("SMS");
  if (c.includes("email") || c === "both" || c === "all") list.push("Email");
  if (c.includes("push") || c === "all") list.push("Push");
  if (c.includes("whatsapp")) list.push("WhatsApp");
  return list;
}

// Returns [{type, id, name, mobile, email, studentId}] for a notice audience.
async function resolveRecipients(notice) {
  const audience = String(notice.audience || "All").toLowerCase();
  const out = [];
  const wantGuardians = ["all", "everyone", "guardians", "students", "parents", "class", "section", "student"].some((a) => audience.includes(a));
  const wantTeachers = ["all", "everyone", "teachers", "staff"].some((a) => audience.includes(a));
  const wantStaff = ["all", "everyone", "staff"].some((a) => audience.includes(a)) && !audience.includes("teachers only");

  if (wantGuardians) {
    const params = [];
    const conds = ["s.status = 'Active'"];
    if (notice.target_student_id) { params.push(notice.target_student_id); conds.push(`s.id = $${params.length}`); }
    if (notice.target_class) { params.push(`${notice.target_class}%`); conds.push(`s.class_name ILIKE $${params.length}`); }
    if (notice.target_section) { params.push(notice.target_section); conds.push(`s.section = $${params.length}`); }
    const rows = (await query(
      `SELECT DISTINCT ON (COALESCE(g.mobile, s.parent_contact)) s.id AS student_id, s.name AS student_name,
              g.id AS guardian_id, COALESCE(g.name, s.guardian_name) AS name, COALESCE(g.mobile, s.parent_contact) AS mobile, g.email
       FROM students s
       LEFT JOIN guardian_students gs ON gs.student_id = s.id AND gs.is_primary AND gs.receives_notifications
       LEFT JOIN guardians g ON g.id = gs.guardian_id
       WHERE ${conds.join(" AND ")}`,
      params,
    )).rows;
    rows.forEach((r) => out.push({ type: "Guardian", id: r.guardian_id, name: r.name, mobile: r.mobile, email: r.email, studentId: r.student_id }));
  }
  if (wantTeachers && !notice.target_class && !notice.target_student_id) {
    (await query("SELECT id, name, phone, email FROM teachers WHERE status = 'Active'")).rows
      .forEach((t) => out.push({ type: "Teacher", id: t.id, name: t.name, mobile: t.phone, email: t.email }));
  }
  if (wantStaff && !notice.target_class && !notice.target_student_id) {
    (await query("SELECT id, name, phone, email FROM staff WHERE status = 'Active'")).rows
      .forEach((t) => out.push({ type: "Staff", id: t.id, name: t.name, mobile: t.phone, email: t.email }));
  }
  return out;
}

async function previewNotice(notice) {
  const recipients = await resolveRecipients(notice);
  const channels = channelsOf(notice);
  const settings = await getSettings();
  const parts = smsParts(`${notice.title}: ${notice.message}`);
  const smsCount = channels.includes("SMS") ? recipients.filter((r) => r.mobile).length : 0;
  return {
    recipients: recipients.length,
    smsRecipients: smsCount,
    emailRecipients: channels.includes("Email") ? recipients.filter((r) => r.email).length : 0,
    smsParts: parts,
    characters: `${notice.title}: ${notice.message}`.length,
    estimatedCost: Math.round(smsCount * parts * Number(settings.sms_cost_per_part || 0) * 100) / 100,
    channels,
  };
}

async function dispatchNotice(noticeId, executor) {
  const run = executor ? executor.query.bind(executor) : query;
  const notice = (await run("SELECT * FROM notices WHERE id = $1", [noticeId])).rows[0];
  if (!notice) throw httpError(404, "Notice not found.");
  const recipients = await resolveRecipients(notice);
  const channels = channelsOf(notice);
  const prefix = notice.priority === "Emergency" ? "[EMERGENCY] " : "";
  // Guardian opt-out preferences (CM-09); emergency notices are always delivered.
  const guardianIds = [...new Set(recipients.filter((r) => r.type === "Guardian" && r.id).map((r) => r.id))];
  const prefs = guardianIds.length
    ? Object.fromEntries((await run("SELECT id, notification_prefs FROM guardians WHERE id = ANY($1::text[])", [guardianIds])).rows.map((g) => [g.id, g.notification_prefs]))
    : {};
  const eventType = notice.priority === "Emergency" ? "Emergency" : "Notice";
  let queued = 0;
  for (const r of recipients) {
    for (const channel of channels) {
      const recipient = channel === "SMS" || channel === "WhatsApp" ? r.mobile : channel === "Email" ? r.email : r.id;
      if (!recipient) continue;
      if (r.type === "Guardian" && optedOut(prefs[r.id], channel, eventType)) continue;
      await queueMessage({
        channel, eventType, recipient,
        recipientType: r.type, recipientId: r.id, studentId: r.studentId || null,
        subject: notice.title, body: channel === "SMS" || channel === "WhatsApp" ? `${prefix}${notice.title}: ${notice.message}` : notice.message,
        relatedType: "notices", relatedId: notice.id,
      }, executor);
      queued += 1;
    }
  }
  const preview = await previewNotice(notice);
  await run(
    "UPDATE notices SET status = 'Sent', sent_at = NOW(), recipients_count = $1, estimated_cost = $2, approval_status = CASE WHEN approval_status = 'Pending' THEN 'Approved' ELSE approval_status END WHERE id = $3",
    [recipients.length, preview.estimatedCost, notice.id],
  );
  return { queued, recipients: recipients.length };
}

module.exports = { resolveRecipients, previewNotice, dispatchNotice, channelsOf };
