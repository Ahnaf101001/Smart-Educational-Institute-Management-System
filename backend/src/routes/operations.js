const express = require("express");
const { query, transaction } = require("../db/pool");
const asyncHandler = require("../utils/asyncHandler");
const httpError = require("../utils/httpError");
const { keysToCamel } = require("../utils/case");
const { requirePermission } = require("../middleware/auth");
const { writeAudit } = require("../services/audit");
const { notifyStudentGuardians } = require("../services/notifications");

const router = express.Router();
const FINE_PER_DAY = 5;

// ------------------------------------------------------------------ Library (OM-01/02)
router.post("/library/issue", requirePermission("library", "create"), asyncHandler(async (req, res) => {
  const { bookId, borrowerType, borrowerId, dueDate, note } = req.body || {};
  if (!bookId || !borrowerType || !borrowerId) throw httpError(422, "Book and borrower are required.");
  const row = await transaction(async (client) => {
    const book = (await client.query("SELECT * FROM library_books WHERE id = $1 FOR UPDATE", [bookId])).rows[0];
    if (!book) throw httpError(404, "Book not found.");
    if (book.available_copies < 1) throw httpError(409, "No copies available.");
    const table = borrowerType === "Student" ? "students" : borrowerType === "Teacher" ? "teachers" : "staff";
    const person = (await client.query(`SELECT id, name FROM ${table} WHERE id = $1`, [borrowerId])).rows[0];
    if (!person) throw httpError(404, `${borrowerType} not found.`);
    const open = (await client.query("SELECT COUNT(*)::int AS n FROM library_issues WHERE borrower_type = $1 AND borrower_id = $2 AND status = 'Issued'", [borrowerType, borrowerId])).rows[0].n;
    if (open >= 5) throw httpError(409, "Borrower already has 5 books issued.");
    await client.query("UPDATE library_books SET available_copies = available_copies - 1 WHERE id = $1", [bookId]);
    const issue = (await client.query(
      `INSERT INTO library_issues (book_id, borrower_type, borrower_id, borrower_name, due_date, note)
       VALUES ($1,$2,$3,$4,COALESCE($5::date, CURRENT_DATE + 14),$6) RETURNING *`,
      [bookId, borrowerType, borrowerId, person.name, dueDate || null, note || null],
    )).rows[0];
    await writeAudit(req, { entity: "library_issues", entityId: issue.id, action: "ISSUE", newValue: issue }, client);
    return issue;
  });
  res.status(201).json({ success: true, data: keysToCamel(row) });
}));

router.post("/library/return/:id", requirePermission("library", "edit"), asyncHandler(async (req, res) => {
  const row = await transaction(async (client) => {
    const issue = (await client.query("SELECT * FROM library_issues WHERE id = $1 FOR UPDATE", [req.params.id])).rows[0];
    if (!issue) throw httpError(404, "Issue record not found.");
    if (issue.status === "Returned") throw httpError(409, "Already returned.");
    const lost = Boolean(req.body?.lost);
    const late = Math.max(0, Math.floor((Date.now() - new Date(issue.due_date).getTime()) / 86400000));
    const book = (await client.query("SELECT price FROM library_books WHERE id = $1", [issue.book_id])).rows[0];
    const fine = lost ? Number(book?.price || 0) + late * FINE_PER_DAY : late * FINE_PER_DAY;
    const updated = (await client.query(
      "UPDATE library_issues SET status = $1, return_date = CURRENT_DATE, fine = $2, fine_paid = $3 WHERE id = $4 RETURNING *",
      [lost ? "Lost" : "Returned", fine, Boolean(req.body?.finePaid), issue.id],
    )).rows[0];
    if (!lost) await client.query("UPDATE library_books SET available_copies = available_copies + 1 WHERE id = $1", [issue.book_id]);
    if (fine > 0 && req.body?.finePaid) {
      await client.query(
        "INSERT INTO financial_transactions (type, transaction_date, description, category, payment_method, amount, status, reference_no) VALUES ('Income', CURRENT_DATE, $1, 'Library Fine', 'Cash', $2, 'Completed', $3)",
        [`Library fine – ${issue.borrower_name}`, fine, issue.id],
      );
    }
    await writeAudit(req, { entity: "library_issues", entityId: issue.id, action: lost ? "LOST" : "RETURN", newValue: { fine } }, client);
    return updated;
  });
  res.json({ success: true, data: keysToCamel(row) });
}));

router.get("/library/overdue", requirePermission("library", "view"), asyncHandler(async (req, res) => {
  const rows = (await query(
    `SELECT li.*, b.title, (CURRENT_DATE - li.due_date) AS days_overdue, (CURRENT_DATE - li.due_date) * ${FINE_PER_DAY} AS estimated_fine
     FROM library_issues li JOIN library_books b ON b.id = li.book_id WHERE li.status = 'Issued' AND li.due_date < CURRENT_DATE ORDER BY li.due_date`,
  )).rows;
  res.json({ success: true, data: keysToCamel(rows) });
}));

// ------------------------------------------------------------------ Inventory (OM-03, OPS-04)
router.post("/inventory/movement", requirePermission("inventory", "create"), asyncHandler(async (req, res) => {
  const { itemId, txnType, quantity, supplierId, issuedTo, unitPrice, note, txnDate } = req.body || {};
  const qty = Number(quantity);
  if (!itemId || !txnType || !(qty > 0)) throw httpError(422, "Item, type and a positive quantity are required.");
  const row = await transaction(async (client) => {
    const item = (await client.query("SELECT * FROM inventory_items WHERE id = $1 FOR UPDATE", [itemId])).rows[0];
    if (!item) throw httpError(404, "Item not found.");
    const sign = ["Stock In", "Return"].includes(txnType) ? 1 : txnType === "Adjustment" ? (req.body?.direction === "decrease" ? -1 : 1) : -1;
    const newQty = Number(item.quantity) + sign * qty;
    if (newQty < 0) throw httpError(409, `Insufficient stock (available ${item.quantity}).`);
    await client.query("UPDATE inventory_items SET quantity = $1 WHERE id = $2", [newQty, itemId]);
    const t = (await client.query(
      `INSERT INTO inventory_transactions (item_id, txn_type, quantity, supplier_id, issued_to, unit_price, note, txn_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,COALESCE($8::date, CURRENT_DATE)) RETURNING *`,
      [itemId, txnType, qty, supplierId || null, issuedTo || null, unitPrice || null, note || null, txnDate || null],
    )).rows[0];
    await writeAudit(req, { entity: "inventory_transactions", entityId: t.id, action: txnType.toUpperCase(), newValue: { item: item.name, qty, newQty } }, client);
    return { ...t, balance: newQty, lowStock: newQty <= Number(item.reorder_level) };
  });
  res.status(201).json({ success: true, data: keysToCamel(row) });
}));

router.get("/inventory/low-stock", requirePermission("inventory", "view"), asyncHandler(async (req, res) => {
  const rows = (await query("SELECT * FROM inventory_items WHERE status = 'Active' AND quantity <= reorder_level ORDER BY name")).rows;
  res.json({ success: true, data: keysToCamel(rows) });
}));

router.post("/visitors/:id/checkout", requirePermission("inventory", "edit"), asyncHandler(async (req, res) => {
  const row = (await query("UPDATE visitors SET check_out = NOW() WHERE id::text = $1 AND check_out IS NULL RETURNING *", [req.params.id])).rows[0];
  if (!row) throw httpError(404, "Visitor not found or already checked out.");
  res.json({ success: true, data: keysToCamel(row) });
}));

// ------------------------------------------------------------------ Transport & GPS
router.get("/transport/live", requirePermission("transport", "view"), asyncHandler(async (req, res) => {
  const rows = (await query(
    `SELECT v.*, r.name AS route_name, l.latitude, l.longitude, l.speed, l.recorded_at
     FROM transport_vehicles v LEFT JOIN transport_routes r ON r.vehicle_id = v.id
     LEFT JOIN LATERAL (SELECT * FROM vehicle_locations vl WHERE vl.vehicle_id = v.id ORDER BY recorded_at DESC LIMIT 1) l ON TRUE
     WHERE v.status = 'Active' ORDER BY v.registration_no`,
  )).rows;
  res.json({ success: true, data: keysToCamel(rows) });
}));

router.get("/transport/vehicles/:id/track", requirePermission("transport", "view"), asyncHandler(async (req, res) => {
  const rows = (await query(
    "SELECT latitude, longitude, speed, recorded_at FROM vehicle_locations WHERE vehicle_id = $1 AND recorded_at > NOW() - INTERVAL '12 hours' ORDER BY recorded_at",
    [req.params.id],
  )).rows;
  res.json({ success: true, data: keysToCamel(rows) });
}));

router.get("/transport/routes/:id/students", requirePermission("transport", "view"), asyncHandler(async (req, res) => {
  const rows = (await query(
    `SELECT ta.*, s.name, s.class_name, s.parent_contact FROM transport_assignments ta JOIN students s ON s.id = ta.student_id
     WHERE ta.route_id = $1 AND ta.status = 'Active' ORDER BY ta.stop_name, s.name`,
    [req.params.id],
  )).rows;
  res.json({ success: true, data: keysToCamel(rows) });
}));

// ------------------------------------------------------------------ Madrasa: Hifz & Salah
router.get("/madrasa/hifz/:studentId/summary", requirePermission("madrasa", "view"), asyncHandler(async (req, res) => {
  const id = req.params.studentId;
  const [progress, logs, stats] = await Promise.all([
    query("SELECT para_no, status, completed_at FROM hifz_progress WHERE student_id = $1 ORDER BY para_no", [id]),
    query("SELECT h.*, t.name AS ustad_name FROM hifz_logs h LEFT JOIN teachers t ON t.id = h.ustad_id WHERE h.student_id = $1 ORDER BY log_date DESC, created_at DESC LIMIT 30", [id]),
    query(`SELECT COUNT(*)::int AS entries, ROUND(AVG(mistakes),1) AS avg_mistakes, ROUND(AVG(tajweed_rating),1) AS avg_tajweed
           FROM hifz_logs WHERE student_id = $1 AND log_date > CURRENT_DATE - 30`, [id]),
  ]);
  const map = new Map(progress.rows.map((p) => [p.para_no, p]));
  const paras = Array.from({ length: 30 }, (_, i) => map.get(i + 1) || { para_no: i + 1, status: "Not Started" });
  const done = paras.filter((p) => ["Done", "Revised"].includes(p.status)).length;
  res.json({ success: true, data: keysToCamel({ paras, completed: done, percentage: Math.round((done / 30) * 1000) / 10, logs: logs.rows, last30Days: stats.rows[0] }) });
}));

// Daily hifz entry updates para progress automatically (QM-13..15).
router.post("/madrasa/hifz/log", requirePermission("madrasa", "create"), asyncHandler(async (req, res) => {
  const b = req.body || {};
  if (!b.studentId) throw httpError(422, "Student is required.");
  const row = await transaction(async (client) => {
    const log = (await client.query(
      `INSERT INTO hifz_logs (student_id, ustad_id, log_date, log_type, sabak_para, sabak_from, sabak_to, sabqi, amukhta_para, mistakes, tajweed_rating, comment)
       VALUES ($1,$2,COALESCE($3::date, CURRENT_DATE),$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [b.studentId, b.ustadId || req.user.linkedId || null, b.logDate || null, b.logType || "Hifz", b.sabakPara || null, b.sabakFrom || null,
        b.sabakTo || null, b.sabqi || null, b.amukhtaPara || null, Number(b.mistakes || 0), b.tajweedRating || null, b.comment || null],
    )).rows[0];
    if (b.sabakPara && (b.logType || "Hifz") === "Hifz") {
      await client.query(
        `INSERT INTO hifz_progress (student_id, para_no, status, completed_at) VALUES ($1, $2, $3, CASE WHEN $3 = 'Done' THEN CURRENT_DATE END)
         ON CONFLICT (student_id, para_no) DO UPDATE SET status = CASE WHEN hifz_progress.status IN ('Done','Revised') AND EXCLUDED.status = 'Ongoing' THEN hifz_progress.status ELSE EXCLUDED.status END,
           completed_at = COALESCE(hifz_progress.completed_at, EXCLUDED.completed_at)`,
        [b.studentId, Number(b.sabakPara), b.paraCompleted ? "Done" : "Ongoing"],
      );
    }
    return log;
  });
  if (req.body?.notifyGuardian !== false) {
    const s = (await query("SELECT name FROM students WHERE id = $1", [b.studentId])).rows[0];
    notifyStudentGuardians(b.studentId, {
      eventType: "Hifz", channels: ["Portal"], subject: "Today's sabak",
      body: `${s?.name}: Sabak para ${b.sabakPara || "-"} (${b.sabakFrom || ""}–${b.sabakTo || ""}), mistakes ${b.mistakes || 0}. ${b.comment || ""}`,
    }).catch(() => {});
  }
  res.status(201).json({ success: true, data: keysToCamel(row) });
}));

router.get("/madrasa/hifz-report", requirePermission("madrasa", "view"), asyncHandler(async (req, res) => {
  const groupBy = req.query.groupBy || "student";
  const rows = (await query(
    `SELECT s.id AS student_id, s.name, h.name AS halaqa, t.name AS ustad,
            COUNT(hp.id) FILTER (WHERE hp.status IN ('Done','Revised'))::int AS paras_done,
            (SELECT COUNT(*)::int FROM hifz_logs l WHERE l.student_id = s.id AND l.log_date > CURRENT_DATE - 30) AS entries_30d,
            (SELECT ROUND(AVG(mistakes),1) FROM hifz_logs l WHERE l.student_id = s.id AND l.log_date > CURRENT_DATE - 30) AS avg_mistakes
     FROM students s JOIN halaqa_members hm ON hm.student_id = s.id JOIN halaqas h ON h.id = hm.halaqa_id
     LEFT JOIN teachers t ON t.id = h.ustad_id LEFT JOIN hifz_progress hp ON hp.student_id = s.id
     WHERE s.status = 'Active' GROUP BY s.id, h.name, t.name ORDER BY h.name, s.name`,
  )).rows;
  if (groupBy === "student") return res.json({ success: true, data: keysToCamel(rows) });
  const key = groupBy === "ustad" ? "ustad" : "halaqa";
  const groups = new Map();
  for (const r of rows) {
    const g = groups.get(r[key]) || { name: r[key] || "Unassigned", students: 0, parasDone: 0, entries30d: 0 };
    g.students += 1; g.parasDone += r.paras_done; g.entries30d += r.entries_30d;
    groups.set(r[key], g);
  }
  res.json({ success: true, data: [...groups.values()].map((g) => ({ ...g, avgParas: Math.round((g.parasDone / g.students) * 10) / 10 })) });
}));

router.put("/madrasa/salah/bulk", requirePermission("madrasa", "create"), asyncHandler(async (req, res) => {
  const { date, wakt, records = [] } = req.body || {};
  if (!date || !wakt || !records.length) throw httpError(422, "date, wakt and records are required.");
  await transaction(async (client) => {
    for (const r of records) {
      await client.query(
        `INSERT INTO salah_attendance (student_id, attendance_date, wakt, status, marked_by) VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (student_id, attendance_date, wakt) DO UPDATE SET status = EXCLUDED.status, marked_by = EXCLUDED.marked_by`,
        [r.studentId, date, wakt, r.status, req.user.id],
      );
    }
  });
  res.json({ success: true });
}));

router.get("/madrasa/salah/weekly", requirePermission("madrasa", "view"), asyncHandler(async (req, res) => {
  const rows = (await query(
    `SELECT s.id AS student_id, s.name, s.class_name,
            COUNT(*) FILTER (WHERE sa.status = 'Jamaat')::int AS jamaat,
            COUNT(*) FILTER (WHERE sa.status = 'Alone')::int AS alone,
            COUNT(*) FILTER (WHERE sa.status = 'Missed')::int AS missed,
            COUNT(sa.id)::int AS recorded
     FROM students s LEFT JOIN salah_attendance sa ON sa.student_id = s.id AND sa.attendance_date > CURRENT_DATE - 7
     WHERE s.status = 'Active' AND ($1::text IS NULL OR s.class_name ILIKE $1 || '%')
     GROUP BY s.id ORDER BY s.class_name, s.name`,
    [req.query.className || null],
  )).rows;
  res.json({ success: true, data: keysToCamel(rows) });
}));

router.get("/hostel/occupancy", requirePermission("hostel", "view"), asyncHandler(async (req, res) => {
  const rows = (await query(
    `SELECT r.*, COUNT(a.id) FILTER (WHERE a.status = 'Active')::int AS occupied
     FROM hostel_rooms r LEFT JOIN hostel_allocations a ON a.room_id = r.id GROUP BY r.id ORDER BY r.building, r.room_no`,
  )).rows;
  res.json({ success: true, data: keysToCamel(rows.map((r) => ({ ...r, available: r.capacity - r.occupied }))) });
}));

module.exports = router;
