const express = require("express");
const crypto = require("node:crypto");
const { query } = require("../db/pool");
const asyncHandler = require("../utils/asyncHandler");
const httpError = require("../utils/httpError");
const { keysToCamel } = require("../utils/case");
const { requirePermission } = require("../middleware/auth");
const { writeAudit } = require("../services/audit");
const { hashKey, processEvent } = require("../services/deviceIngest");

const router = express.Router();

// Generates a device API key; shown once, stored hashed.
router.post("/:id/key", requirePermission("devices", "edit"), asyncHandler(async (req, res) => {
  const key = `dev_${crypto.randomBytes(24).toString("hex")}`;
  const row = (await query(
    "UPDATE attendance_devices SET api_key_hash = $1, api_key_hint = $2 WHERE id = $3 RETURNING id, name",
    [hashKey(key), `…${key.slice(-4)}`, req.params.id],
  )).rows[0];
  if (!row) throw httpError(404, "Device not found.");
  await writeAudit(req, { entity: "attendance_devices", entityId: row.id, action: "ROTATE_KEY" });
  res.json({ success: true, data: { apiKey: key, endpoint: "/api/v1/public/devices/events" } });
}));

// Mobile-app / QR attendance: a teacher scans a student's ID card QR or enters a card/RFID.
router.post("/scan", requirePermission("attendance", "create"), asyncHandler(async (req, res) => {
  const { credential, eventType } = req.body || {};
  if (!credential) throw httpError(422, "Scan a QR code or enter a card number.");
  const device = (await query("SELECT * FROM attendance_devices WHERE device_type = 'Mobile App' AND status = 'Active' ORDER BY created_at LIMIT 1")).rows[0]
    || { id: null, device_type: "Mobile App", direction: "Both" };
  const result = await processEvent(device, { credential, eventType, raw: { by: req.user.id, source: "mobile-scan" } });
  res.json({ success: true, data: keysToCamel(result) });
}));

// Teacher/staff self check-in from the mobile web app (with optional location).
router.post("/self-checkin", asyncHandler(async (req, res) => {
  const user = (await query("SELECT linked_type, linked_id FROM users WHERE id = $1", [req.user.id])).rows[0];
  if (!user?.linked_id || !["Teacher", "Staff"].includes(user.linked_type)) {
    throw httpError(422, "Your login is not linked to a teacher/staff profile.");
  }
  const result = await processEvent({ id: null, device_type: "Mobile App", direction: "Both" }, {
    credential: user.linked_id, eventType: req.body?.eventType || "IN",
    raw: { location: req.body?.location || null, by: req.user.id, source: "self-checkin" },
  });
  res.json({ success: true, data: keysToCamel(result) });
}));

router.get("/sync-status", requirePermission("devices", "view"), asyncHandler(async (req, res) => {
  const rows = (await query(
    `SELECT d.id, d.name, d.device_type, d.location, d.status, d.last_sync_at, d.api_key_hint,
            COUNT(e.id) FILTER (WHERE e.event_time > NOW() - INTERVAL '24 hours')::int AS events_24h,
            COUNT(e.id) FILTER (WHERE e.status = 'Unmatched' AND e.event_time > NOW() - INTERVAL '24 hours')::int AS unmatched_24h,
            COUNT(e.id) FILTER (WHERE e.status = 'Error' AND e.event_time > NOW() - INTERVAL '24 hours')::int AS errors_24h
     FROM attendance_devices d LEFT JOIN device_events e ON e.device_id = d.id
     GROUP BY d.id ORDER BY d.name`,
  )).rows;
  res.json({ success: true, data: keysToCamel(rows) });
}));

module.exports = router;
