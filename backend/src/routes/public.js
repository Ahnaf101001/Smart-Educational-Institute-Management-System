// Public, unauthenticated endpoints (SRS §1.2 Public Admission Portal, online
// result publication, QR card verification, device/GPS/payment callbacks).
const express = require("express");
const path = require("node:path");
const fs = require("node:fs");
const env = require("../config/env");
const { query, transaction } = require("../db/pool");
const asyncHandler = require("../utils/asyncHandler");
const httpError = require("../utils/httpError");
const { keysToCamel } = require("../utils/case");
const rateLimit = require("../middleware/rateLimit");
const { findDuplicates } = require("../services/admissions");
const { normalizeMobile } = require("../services/students");
const { queueMessage } = require("../services/notifications");
const { deviceByKey, processEvent } = require("../services/deviceIngest");
const payments = require("../services/payments");
const { localDate } = require("../utils/dates");

const router = express.Router();
const publicLimiter = rateLimit({ windowMs: 60_000, max: 60 });
const applyLimiter = rateLimit({ windowMs: 60 * 60_000, max: 20, message: "Too many applications from this network. Try later." });
router.use(publicLimiter);

router.get("/institute", asyncHandler(async (req, res) => {
  const p = (await query(
    `SELECT name, name_bn, name_ar, type, eiin, phone, email, website, address, logo_url, brand_color, accent_color, motto,
            institution_types, primary_type, established_year FROM institute_profile WHERE id = 1`,
  )).rows[0];
  const s = (await query("SELECT public_admission_enabled, public_result_enabled, language FROM system_settings WHERE id = 1")).rows[0];
  res.json({ success: true, data: keysToCamel({ ...p, ...s }) });
}));

router.get("/circulars", asyncHandler(async (req, res) => {
  const rows = (await query(
    `SELECT c.*, ay.name AS session_name,
            GREATEST(c.seats - (SELECT COUNT(*) FROM admissions a WHERE a.circular_id = c.id AND a.status = 'Admitted'), 0)::int AS seats_available
     FROM admission_circulars c LEFT JOIN academic_years ay ON ay.id = c.academic_year_id
     WHERE c.status = 'Published' AND (c.deadline IS NULL OR c.deadline >= CURRENT_DATE) AND (c.start_date IS NULL OR c.start_date <= CURRENT_DATE)
     ORDER BY c.class_name`,
  )).rows;
  res.json({ success: true, data: keysToCamel(rows) });
}));

// Online admission form (AD-02, v1 AD-02..05).
router.post("/admissions/apply", applyLimiter, asyncHandler(async (req, res) => {
  const s = (await query("SELECT public_admission_enabled FROM system_settings WHERE id = 1")).rows[0];
  if (s && s.public_admission_enabled === false) throw httpError(403, "Online admission is currently closed.");
  const b = req.body || {};
  const name = String(b.studentName || b.name || "").trim();
  const mobile = normalizeMobile(b.guardianPhone || b.fatherPhone);
  if (!name || name.length < 3) throw httpError(422, "Student name is required.");
  if (!/^01[3-9]\d{8}$/.test(mobile)) throw httpError(422, "A valid Bangladeshi guardian mobile number is required.");
  if (!b.circularId && !b.classApplied) throw httpError(422, "Select the class / circular you are applying for.");
  const circular = b.circularId ? (await query("SELECT * FROM admission_circulars WHERE id = $1 AND status = 'Published'", [b.circularId])).rows[0] : null;
  if (b.circularId && !circular) throw httpError(404, "Admission circular not found or closed.");
  if (circular?.deadline && String(circular.deadline).slice(0, 10) < localDate()) throw httpError(409, "The application deadline has passed.");

  const allowedKeys = ["nameBn", "dateOfBirth", "gender", "bloodGroup", "religion", "birthCertificateNo", "classApplied", "section", "shift", "group",
    "previousSchool", "previousClass", "previousResult", "fatherName", "fatherPhone", "fatherOccupation", "fatherNid", "motherName", "motherPhone",
    "motherOccupation", "guardianName", "guardianPhone", "guardianRelation", "presentAddress", "permanentAddress", "email", "photoUrl", "documents", "primaryGuardian"];
  const details = Object.fromEntries(Object.entries(b).filter(([k]) => allowedKeys.includes(k)).map(([k, v]) => [k, typeof v === "string" ? v.slice(0, 500) : v]));
  details.classApplied = circular?.class_name || b.classApplied;

  const dups = await findDuplicates({ query }, { birthCertNo: b.birthCertificateNo, name, dateOfBirth: b.dateOfBirth, guardianMobile: mobile });
  const row = await transaction(async (client) => {
    const app = (await client.query(
      `INSERT INTO admissions (initials, name, gender, class_name, status, details, circular_id, birth_cert_no, guardian_mobile,
         date_of_birth, source, payment_status, duplicate_flag, duplicate_of, status_history)
       VALUES ($1,$2,$3,$4,'Submitted',$5,$6,$7,$8,$9,'Online',$10,$11,$12,$13) RETURNING id, name, class_name, status, payment_status`,
      [name.split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase(), name, b.gender || null, details.classApplied,
        JSON.stringify(details), circular?.id || null, b.birthCertificateNo || null, mobile, b.dateOfBirth || null,
        Number(circular?.application_fee || 0) > 0 ? "Unpaid" : "Not Required", dups.length > 0, dups[0]?.id || null,
        JSON.stringify([{ at: new Date().toISOString(), status: "Submitted", by: "Online applicant" }])],
    )).rows[0];
    await client.query(
      "INSERT INTO audit_logs (user_name, entity, entity_id, action, new_value, ip) VALUES ('Online applicant', 'admissions', $1, 'APPLY_ONLINE', $2, $3)",
      [app.id, JSON.stringify({ name, class: details.classApplied }), req.ip],
    );
    await queueMessage({ channel: "SMS", eventType: "Application", recipient: mobile, recipientType: "Applicant", recipientId: app.id,
      body: `Application received. ID: ${app.id}. Check status with this ID and your mobile number.` }, client);
    return app;
  });
  res.status(201).json({ success: true, data: keysToCamel({ ...row, applicationFee: Number(circular?.application_fee || 0) }) });
}));

router.post("/admissions/status", asyncHandler(async (req, res) => {
  const { applicationId, mobile } = req.body || {};
  const app = (await query(
    "SELECT id, name, class_name, status, merit_position, payment_status, admit_card_no, application_date FROM admissions WHERE id = $1 AND guardian_mobile = $2",
    [String(applicationId || "").trim().toUpperCase(), normalizeMobile(mobile)],
  )).rows[0];
  if (!app) throw httpError(404, "No application found for this ID and mobile number.");
  res.json({ success: true, data: keysToCamel(app) });
}));

// Online result publication (feature list; EX-15).
router.get("/results/exams", asyncHandler(async (req, res) => {
  const rows = (await query("SELECT id, name, exam_type, published_at FROM exams WHERE result_status = 'Published' ORDER BY published_at DESC LIMIT 50")).rows;
  res.json({ success: true, data: keysToCamel(rows) });
}));

router.post("/results/lookup", asyncHandler(async (req, res) => {
  const s = (await query("SELECT public_result_enabled, result_hide_on_due FROM system_settings WHERE id = 1")).rows[0];
  if (s && s.public_result_enabled === false) throw httpError(403, "Online result publication is disabled.");
  const { examId, studentId, dateOfBirth } = req.body || {};
  if (!examId || !studentId || !dateOfBirth) throw httpError(422, "Exam, student ID and date of birth are required.");
  const row = (await query(
    `SELECT r.*, e.name AS exam_name, st.name AS student_name, st.date_of_birth FROM results r JOIN exams e ON e.id = r.exam_id
     JOIN students st ON st.id = r.student_id
     WHERE r.exam_id = $1 AND r.student_id = $2 AND r.published AND st.date_of_birth = $3::date`,
    [examId, String(studentId).trim().toUpperCase(), dateOfBirth],
  )).rows[0];
  if (!row) throw httpError(404, "No published result matches these details.");
  if (s?.result_hide_on_due) {
    const due = (await query("SELECT COALESCE(SUM(amount + late_fine - discount - paid_amount),0) AS due FROM fee_invoices WHERE student_id = $1 AND status NOT IN ('Paid','Cancelled')", [row.student_id])).rows[0];
    if (Number(due.due) > 0) throw httpError(403, "Result is withheld. Please contact the institution office.");
  }
  delete row.date_of_birth;
  res.json({ success: true, data: keysToCamel(row) });
}));

// QR card verification: only approved, non-sensitive information (§7.4).
router.get("/cards/verify/:token", asyncHandler(async (req, res) => {
  const card = (await query("SELECT * FROM id_cards WHERE qr_token = $1", [req.params.token])).rows[0];
  const institute = (await query("SELECT name, logo_url, address, phone FROM institute_profile WHERE id = 1")).rows[0];
  if (!card) return res.status(404).json({ success: false, message: "Card not recognised.", data: { valid: false, institute: keysToCamel(institute) } });
  const snap = card.snapshot || {};
  const expired = Boolean(card.valid_until) && String(card.valid_until).slice(0, 10) < localDate();
  res.json({
    success: true,
    data: keysToCamel({
      valid: card.status === "Active" && !expired,
      status: expired && card.status === "Active" ? "Expired" : card.status,
      holderType: card.holder_type, name: card.holder_name, cardNumber: card.card_number, photoUrl: snap.photoUrl || null,
      className: card.holder_type === "Student" ? snap.className : null, designation: card.holder_type !== "Student" ? snap.designation : null,
      issueDate: card.issue_date, validUntil: card.valid_until, institute,
    }),
  });
}));

// Attendance devices push events here with their API key (AT-10, ATT-01/05).
router.post("/devices/events", asyncHandler(async (req, res) => {
  const device = await deviceByKey(req.headers["x-device-key"]);
  if (!device) throw httpError(401, "Unknown or inactive device key.");
  const events = Array.isArray(req.body?.events) ? req.body.events : [req.body];
  if (events.length > 500) throw httpError(422, "Maximum 500 events per batch.");
  const results = [];
  for (const e of events) {
    results.push(await processEvent(device, { credential: e.credential || e.cardUid || e.userId, eventType: e.type || e.eventType, time: e.time, raw: e }));
  }
  res.json({ success: true, data: { processed: results.filter((r) => r.status === "Processed").length, results: results.map((r) => ({ status: r.status, message: r.message })) } });
}));

// GPS trackers push positions (feature list: GPS-based bus tracking).
router.post("/gps", asyncHandler(async (req, res) => {
  if (!env.gpsSharedKey || req.headers["x-gps-key"] !== env.gpsSharedKey) throw httpError(401, "Invalid GPS key.");
  const points = Array.isArray(req.body?.points) ? req.body.points : [req.body];
  let saved = 0;
  for (const p of points) {
    const v = (await query("SELECT id FROM transport_vehicles WHERE gps_device_id = $1", [p.deviceId])).rows[0];
    if (!v || Number.isNaN(Number(p.lat)) || Number.isNaN(Number(p.lng))) continue;
    await query("INSERT INTO vehicle_locations (vehicle_id, latitude, longitude, speed, heading, recorded_at) VALUES ($1,$2,$3,$4,$5,COALESCE($6::timestamptz, NOW()))",
      [v.id, p.lat, p.lng, p.speed || null, p.heading || null, p.time || null]);
    saved += 1;
    // Bus arrival alerts when the bus reaches a stop (geofence).
    require("../services/transport").checkArrivals(v.id, Number(p.lat), Number(p.lng), p.time ? new Date(p.time) : new Date())
      .catch((error) => console.error("[transport] arrival check failed:", error.message));
  }
  res.json({ success: true, data: { saved } });
}));

// Payment gateway callback / IPN – signature verified, idempotent (FIN-08/11, NFR-11).
router.post("/payments/callback/:gateway", express.text({ type: "text/*" }), asyncHandler(async (req, res) => {
  const raw = req.rawBody ?? (typeof req.body === "string" ? req.body : JSON.stringify(req.body || {}));
  if (!payments.verifySignature(raw, req.headers["x-signature"])) throw httpError(401, "Invalid callback signature.");
  let body;
  try { body = JSON.parse(raw); } catch { throw httpError(400, "Callback body must be JSON."); }
  const status = ["success", "completed", "paid"].includes(String(body.status).toLowerCase()) ? "Success"
    : String(body.status).toLowerCase() === "cancelled" ? "Cancelled" : "Failed";
  const result = await payments.finalize({ gateway: req.params.gateway, txnId: body.txnId || body.tran_id, status, payload: body });
  res.json({ success: true, data: { duplicate: result.duplicate, status: result.status || "Success" } });
}));

// SSLCommerz IPN: validate with the gateway's validator before posting.
router.post("/payments/ipn/sslcommerz", express.urlencoded({ extended: false }), asyncHandler(async (req, res) => {
  const { val_id: valId, tran_id: tranId } = req.body || {};
  if (!valId || !env.payment.sslcommerzStoreId) throw httpError(400, "Invalid IPN.");
  const base = env.payment.sslcommerzSandbox ? "https://sandbox.sslcommerz.com" : "https://securepay.sslcommerz.com";
  const url = `${base}/validator/api/validationserverAPI.php?val_id=${encodeURIComponent(valId)}&store_id=${encodeURIComponent(env.payment.sslcommerzStoreId)}&store_passwd=${encodeURIComponent(env.payment.sslcommerzStorePassword)}&format=json`;
  const v = await (await fetch(url)).json();
  const status = ["VALID", "VALIDATED"].includes(v.status) ? "Success" : "Failed";
  const result = await payments.finalize({ gateway: "sslcommerz", txnId: tranId || v.tran_id, status, payload: { amount: v.amount, valId, status: v.status } });
  res.json({ success: true, data: { duplicate: result.duplicate } });
}));

// bKash / Nagad redirect here after payment; we confirm server-to-server before showing the result.
router.all("/payments/return/:gateway", async (req, res, next) => {
  if (!["bkash", "nagad"].includes(req.params.gateway)) return next();
  // Sends the payer back to where the payment started (the guardian app's deep link or the website).
  try {
    const r = await payments.confirmReturn(req.params.gateway, { ...req.query, ...(req.body || {}) });
    const status = r.status === "Success" ? "success" : r.status === "Pending" ? "pending" : r.status === "Cancelled" ? "cancelled" : "failed";
    res.redirect(payments.returnRedirect(r.txn, status));
  } catch (error) {
    console.error(`[payments] ${req.params.gateway} return failed:`, error.message);
    res.redirect(payments.returnRedirect(null, "failed"));
  }
});

router.all("/payments/return/:gateway", asyncHandler(async (req, res) => {
  const status = String(req.query.status || "unknown");
  const tranId = String(req.body?.tran_id || req.query.tran_id || "");
  const txn = tranId ? (await query("SELECT id, txn_id, return_url FROM gateway_transactions WHERE txn_id = $1", [tranId])).rows[0] : null;
  res.redirect(payments.returnRedirect(txn || { txn_id: tranId }, status));
}));

// Where the development sandbox should send the payer afterwards (app deep link or website).
router.get("/payments/return-target/:id", asyncHandler(async (req, res) => {
  const txn = (await query("SELECT id, txn_id, return_url, status FROM gateway_transactions WHERE id::text = $1", [req.params.id])).rows[0];
  if (!txn) throw httpError(404, "Transaction not found.");
  const status = txn.status === "Success" ? "success" : txn.status === "Pending" ? "pending" : "failed";
  res.json({ success: true, data: { url: txn.return_url ? payments.returnRedirect(txn, status) : null } });
}));

// Development-only sandbox so the online-payment flow can be exercised without merchant credentials.
router.get("/payments/sandbox/:id", asyncHandler(async (req, res) => {
  if (env.nodeEnv !== "development") throw httpError(404, "Not found.");
  const txn = (await query("SELECT id, gateway, txn_id, amount, status, posted FROM gateway_transactions WHERE id::text = $1", [req.params.id])).rows[0];
  if (!txn) throw httpError(404, "Transaction not found.");
  res.json({ success: true, data: keysToCamel(txn) });
}));

router.post("/payments/sandbox/:id/complete", asyncHandler(async (req, res) => {
  if (env.nodeEnv !== "development") throw httpError(404, "Not found.");
  const txn = (await query("SELECT * FROM gateway_transactions WHERE id::text = $1", [req.params.id])).rows[0];
  if (!txn) throw httpError(404, "Transaction not found.");
  const result = await payments.finalize({ gateway: txn.gateway, txnId: txn.txn_id, status: req.body?.status === "fail" ? "Failed" : "Success", payload: { amount: txn.amount, sandbox: true } });
  res.json({ success: true, data: keysToCamel(result) });
}));

// Public uploads (photos/logos) are served with random names; documents are private.
router.get("/files/:name", (req, res, next) => {
  const name = path.basename(req.params.name);
  const file = path.resolve(env.uploadDir, "public", name);
  if (!fs.existsSync(file)) return next(httpError(404, "File not found."));
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  res.sendFile(file);
});

module.exports = router;
