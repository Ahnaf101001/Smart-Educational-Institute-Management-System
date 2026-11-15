// Attendance device ingestion (feature list: Face Recognition / Fingerprint /
// RFID / Mobile app attendance, Student entry & exit alerts; SRS AT-10, ATT-01/05).
// Devices push events with an API key; events are matched to a person via
// enrolled credentials, converted to attendance and logged for verification.
const crypto = require("node:crypto");
const { query } = require("../db/pool");
const { notifyStudentGuardians } = require("./notifications");
const { renderTemplate, defaultLanguage } = require("./templates");

function hashKey(key) {
  return crypto.createHash("sha256").update(String(key)).digest("hex");
}

async function deviceByKey(key) {
  if (!key) return null;
  return (await query("SELECT * FROM attendance_devices WHERE api_key_hash = $1 AND status = 'Active'", [hashKey(key)])).rows[0] || null;
}

async function resolvePerson(credential) {
  const value = String(credential || "").trim();
  if (!value) return null;
  const enrolled = (await query(
    "SELECT person_type, person_id FROM biometric_enrollments WHERE (credential_value = $1 OR device_user_id = $1) AND status = 'Active' LIMIT 1",
    [value],
  )).rows[0];
  if (enrolled) return { type: enrolled.person_type, id: enrolled.person_id };
  const card = (await query("SELECT holder_type, holder_id FROM id_cards WHERE (qr_token = $1 OR card_number = $1) AND status = 'Active'", [value])).rows[0];
  if (card) return { type: card.holder_type, id: card.holder_id };
  const student = (await query("SELECT id FROM students WHERE rfid_uid = $1 OR id = $1", [value])).rows[0];
  if (student) return { type: "Student", id: student.id };
  const teacher = (await query("SELECT id FROM teachers WHERE rfid_uid = $1 OR id = $1", [value])).rows[0];
  if (teacher) return { type: "Teacher", id: teacher.id };
  const staff = (await query("SELECT id FROM staff WHERE rfid_uid = $1 OR id = $1", [value])).rows[0];
  if (staff) return { type: "Staff", id: staff.id };
  return null;
}

function localParts(date, timezone = "Asia/Dhaka") {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
  const p = Object.fromEntries(fmt.formatToParts(date).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour === "24" ? "00" : p.hour}:${p.minute}` };
}

async function processEvent(device, { credential, eventType, time, raw }) {
  const settings = (await query("SELECT * FROM system_settings WHERE id = 1")).rows[0] || {};
  const at = time ? new Date(time) : new Date();
  if (Number.isNaN(at.getTime())) return { status: "Error", message: "Invalid event time" };
  let type = String(eventType || (device?.direction === "Out" ? "OUT" : "IN")).toUpperCase();
  if (!["IN", "OUT"].includes(type)) type = "IN";
  const person = await resolvePerson(credential);

  const log = async (status, message) => {
    await query(
      `INSERT INTO device_events (device_id, person_type, person_id, credential_value, event_type, event_time, status, message, raw)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [device?.id || null, person?.type || null, person?.id || null, credential || null, type, at, status, message, JSON.stringify(raw || {})],
    );
    return { status, message, person };
  };
  if (!person) return log("Unmatched", "Credential not enrolled – manual verification required");

  const dup = await query(
    `SELECT 1 FROM device_events WHERE person_type = $1 AND person_id = $2 AND event_type = $3
       AND status = 'Processed' AND ABS(EXTRACT(EPOCH FROM (event_time - $4::timestamptz))) < 120`,
    [person.type, person.id, type, at],
  );
  if (dup.rowCount) return log("Duplicate", "Repeated scan within 2 minutes ignored");

  const { date, time: hhmm } = localParts(at, settings.timezone);
  const late = hhmm > String(settings.attendance_cutoff_time || "09:15");

  if (person.type === "Student") {
    const student = (await query("SELECT id, name, class_name FROM students WHERE id = $1", [person.id])).rows[0];
    if (!student) return log("Error", "Student record missing");
    if (type === "IN") {
      await query(
        `INSERT INTO attendance (student_id, class_name, attendance_date, status, source, in_time, note)
         VALUES ($1,$2,$3,$4,$5,$6,'Device check-in')
         ON CONFLICT (student_id, attendance_date) DO UPDATE SET
           in_time = COALESCE(attendance.in_time, EXCLUDED.in_time),
           status = CASE WHEN attendance.status IN ('Absent') THEN EXCLUDED.status ELSE attendance.status END,
           source = CASE WHEN attendance.source = 'Manual' THEN attendance.source ELSE EXCLUDED.source END`,
        [student.id, student.class_name || "", date, late ? "Late" : "Present", device?.device_type || "Device", at],
      );
    } else {
      await query(
        `UPDATE attendance SET out_time = $1 WHERE student_id = $2 AND attendance_date = $3`,
        [at, student.id, date],
      );
    }
    if (settings.notify_entry_exit) {
      const lang = await defaultLanguage();
      const body = await renderTemplate(type === "IN" ? "entry" : "exit", lang, { student: student.name, time: hhmm });
      await notifyStudentGuardians(student.id, { eventType: type === "IN" ? "Entry" : "Exit", body, subject: type === "IN" ? "Entry alert" : "Exit alert", relatedType: "device_events" });
    } else if (type === "IN" && late && settings.notify_late) {
      const lang = await defaultLanguage();
      const body = await renderTemplate("late", lang, { student: student.name, date });
      await notifyStudentGuardians(student.id, { eventType: "Late", body, subject: "Late arrival", relatedType: "device_events" });
    }
  } else {
    const nameRow = (await query(`SELECT name FROM ${person.type === "Teacher" ? "teachers" : "staff"} WHERE id = $1`, [person.id])).rows[0];
    if (type === "IN") {
      await query(
        `INSERT INTO staff_attendance (employee_type, employee_id, employee_name, attendance_date, status, in_time, source)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (employee_type, employee_id, attendance_date) DO UPDATE SET in_time = COALESCE(staff_attendance.in_time, EXCLUDED.in_time)`,
        [person.type, person.id, nameRow?.name || null, date, late ? "Late" : "Present", at, device?.device_type || "Device"],
      );
    } else {
      await query(
        "UPDATE staff_attendance SET out_time = $1 WHERE employee_type = $2 AND employee_id = $3 AND attendance_date = $4",
        [at, person.type, person.id, date],
      );
    }
  }
  if (device?.id) await query("UPDATE attendance_devices SET last_sync_at = NOW() WHERE id = $1", [device.id]);
  return log("Processed", `${type} recorded${late && type === "IN" ? " (late)" : ""}`);
}

module.exports = { hashKey, deviceByKey, resolvePerson, processEvent };
