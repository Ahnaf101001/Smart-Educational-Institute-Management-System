const express = require("express");
const { query, transaction } = require("../db/pool");
const asyncHandler = require("../utils/asyncHandler");
const httpError = require("../utils/httpError");
const { keysToCamel } = require("../utils/case");
const { requirePermission } = require("../middleware/auth");
const { writeAudit } = require("../services/audit");
const { createApproval } = require("../services/approvals");

const router = express.Router();
const ZAKAT_ELIGIBLE = ["Lillah Boarding", "Student Aid", "Scholarship", "Orphan Support", "Poor Student Support"];

// Income / expense entry. Expenses above the threshold need approval before posting (ACC-03, FIN-15).
router.post("/entries", requirePermission("accounts", "create"), asyncHandler(async (req, res) => {
  const { type, transactionDate, description, category, paymentMethod, amount, referenceNo, accountHeadId, fund = "General", details } = req.body || {};
  if (!["Income", "Expense"].includes(type)) throw httpError(422, "Type must be Income or Expense.");
  if (!description || !category || !(Number(amount) > 0)) throw httpError(422, "Description, category and a positive amount are required.");
  if (type === "Expense" && fund === "Zakat" && !ZAKAT_ELIGIBLE.includes(category)) {
    throw httpError(422, `Zakat fund can only be spent on: ${ZAKAT_ELIGIBLE.join(", ")}.`);
  }
  const settings = (await query("SELECT expense_approval_threshold, committee_approval_threshold FROM system_settings WHERE id = 1")).rows[0] || {};
  const needsApproval = type === "Expense" && Number(amount) > Number(settings.expense_approval_threshold || 0);
  const result = await transaction(async (client) => {
    const row = (await client.query(
      `INSERT INTO financial_transactions (type, transaction_date, description, category, payment_method, amount, status,
         reference_no, details, created_by, account_head_id, fund, approval_status)
       VALUES ($1, COALESCE($2::date, CURRENT_DATE), $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
      [type, transactionDate || null, description, category, paymentMethod || "Cash", amount, needsApproval ? "Pending" : "Completed",
        referenceNo || null, JSON.stringify(details || {}), req.user.id, accountHeadId || null, fund, needsApproval ? "Pending" : "Approved"],
    )).rows[0];
    await writeAudit(req, { entity: "financial_transactions", entityId: row.id, action: "CREATE", newValue: row }, client);
    let approval = null;
    if (needsApproval) {
      approval = await createApproval(req, {
        type: "expense", title: `${category}: ${description} (৳${amount})`, referenceTable: "financial_transactions",
        referenceId: row.id, amount, payload: { transactionId: row.id },
        urgency: Number(amount) > Number(settings.committee_approval_threshold || 0) ? "High" : "Normal",
      }, client);
    }
    return { transaction: row, approval };
  });
  res.status(201).json({ success: true, data: keysToCamel(result), message: needsApproval ? "Expense submitted for approval." : "Entry posted." });
}));

// Reversal instead of delete (ACC-06).
router.post("/entries/:id/reverse", requirePermission("accounts", "edit"), asyncHandler(async (req, res) => {
  const reason = String(req.body?.reason || "").trim();
  if (!reason) throw httpError(422, "Reversal reason is required.");
  const result = await transaction(async (client) => {
    const t = (await client.query("SELECT * FROM financial_transactions WHERE id = $1 FOR UPDATE", [req.params.id])).rows[0];
    if (!t) throw httpError(404, "Transaction not found.");
    if (t.reversed) throw httpError(409, "Already reversed.");
    await client.query("UPDATE financial_transactions SET reversed = TRUE WHERE id = $1", [t.id]);
    const rev = (await client.query(
      `INSERT INTO financial_transactions (type, transaction_date, description, category, payment_method, amount, status, reference_no, details, created_by, fund, reversed_of)
       VALUES ($1, CURRENT_DATE, $2, $3, $4, $5, 'Completed', $6, $7, $8, $9, $10) RETURNING *`,
      [t.type === "Income" ? "Expense" : "Income", `Reversal of ${t.id}: ${reason}`, `${t.category} (Reversal)`, t.payment_method,
        t.amount, `REV-${t.id}`, JSON.stringify({ reversalOf: t.id, reason }), req.user.id, t.fund, t.id],
    )).rows[0];
    await writeAudit(req, { entity: "financial_transactions", entityId: t.id, action: "REVERSE", oldValue: t, newValue: rev, reason }, client);
    return rev;
  });
  res.json({ success: true, data: keysToCamel(result) });
}));

function range(req) {
  return {
    from: req.query.from || `${new Date().getFullYear()}-01-01`,
    to: req.query.to || new Date().toISOString().slice(0, 10),
  };
}

// Cash book (ACC-04): chronological receipts & payments with running balance.
router.get("/cash-book", requirePermission("accounts", "view"), asyncHandler(async (req, res) => {
  const { from, to } = range(req);
  const opening = (await query(
    `SELECT COALESCE(SUM(CASE WHEN type = 'Income' THEN amount ELSE -amount END), 0) AS bal
     FROM financial_transactions WHERE transaction_date < $1 AND approval_status = 'Approved' AND COALESCE(payment_method,'Cash') = 'Cash'`,
    [from],
  )).rows[0].bal;
  const rows = (await query(
    `SELECT * FROM financial_transactions WHERE transaction_date BETWEEN $1 AND $2 AND approval_status = 'Approved'
       AND ($3::text IS NULL OR COALESCE(payment_method,'Cash') = $3)
     ORDER BY transaction_date, created_at`,
    [from, to, req.query.method || null],
  )).rows;
  let balance = Number(opening);
  const entries = rows.map((r) => {
    balance += r.type === "Income" ? Number(r.amount) : -Number(r.amount);
    return { ...r, debit: r.type === "Income" ? Number(r.amount) : 0, credit: r.type === "Expense" ? Number(r.amount) : 0, balance };
  });
  res.json({ success: true, data: keysToCamel({ from, to, openingBalance: Number(opening), closingBalance: balance, entries }) });
}));

// Category / head ledger and trial balance (ACC-04, FIN-17).
router.get("/ledger", requirePermission("accounts", "view"), asyncHandler(async (req, res) => {
  const { from, to } = range(req);
  const rows = (await query(
    `SELECT COALESCE(ah.name, ft.category) AS head, ft.type, ft.fund,
            COUNT(*)::int AS entries, COALESCE(SUM(ft.amount), 0) AS total
     FROM financial_transactions ft LEFT JOIN account_heads ah ON ah.id = ft.account_head_id
     WHERE ft.transaction_date BETWEEN $1 AND $2 AND ft.approval_status = 'Approved'
     GROUP BY 1, 2, 3 ORDER BY 2, 1`,
    [from, to],
  )).rows;
  res.json({ success: true, data: keysToCamel({ from, to, rows }) });
}));

router.get("/trial-balance", requirePermission("accounts", "view"), asyncHandler(async (req, res) => {
  const { from, to } = range(req);
  const tx = (await query(
    `SELECT COALESCE(ah.name, ft.category) AS account, ft.type, COALESCE(SUM(ft.amount),0) AS amount
     FROM financial_transactions ft LEFT JOIN account_heads ah ON ah.id = ft.account_head_id
     WHERE ft.transaction_date BETWEEN $1 AND $2 AND ft.approval_status = 'Approved' GROUP BY 1, 2`,
    [from, to],
  )).rows;
  const vouchers = (await query(
    `SELECT e->>'headName' AS account, SUM((e->>'debit')::numeric) AS debit, SUM((e->>'credit')::numeric) AS credit
     FROM vouchers v, jsonb_array_elements(v.entries) e
     WHERE v.voucher_date BETWEEN $1 AND $2 AND v.status = 'Posted' GROUP BY 1`,
    [from, to],
  )).rows;
  const lines = [];
  let income = 0;
  let expense = 0;
  for (const t of tx) {
    if (t.type === "Income") { income += Number(t.amount); lines.push({ account: t.account, debit: 0, credit: Number(t.amount) }); }
    else { expense += Number(t.amount); lines.push({ account: t.account, debit: Number(t.amount), credit: 0 }); }
  }
  lines.push({ account: "Cash & Bank (net)", debit: Math.max(0, income - expense), credit: Math.max(0, expense - income) });
  for (const v of vouchers) lines.push({ account: `${v.account || "Journal"} (voucher)`, debit: Number(v.debit || 0), credit: Number(v.credit || 0) });
  const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
  const totalCredit = lines.reduce((s, l) => s + l.credit, 0);
  res.json({ success: true, data: { from, to, lines, totalDebit, totalCredit, balanced: Math.abs(totalDebit - totalCredit) < 0.01 } });
}));

router.get("/income-expense", requirePermission("accounts", "view"), asyncHandler(async (req, res) => {
  const { from, to } = range(req);
  const monthly = (await query(
    `SELECT to_char(transaction_date, 'YYYY-MM') AS month,
            COALESCE(SUM(amount) FILTER (WHERE type = 'Income'), 0) AS income,
            COALESCE(SUM(amount) FILTER (WHERE type = 'Expense'), 0) AS expense
     FROM financial_transactions WHERE transaction_date BETWEEN $1 AND $2 AND approval_status = 'Approved'
     GROUP BY 1 ORDER BY 1`,
    [from, to],
  )).rows;
  const byCategory = (await query(
    `SELECT type, category, COALESCE(SUM(amount),0) AS total FROM financial_transactions
     WHERE transaction_date BETWEEN $1 AND $2 AND approval_status = 'Approved' GROUP BY type, category ORDER BY type, total DESC`,
    [from, to],
  )).rows;
  const byFund = (await query(
    `SELECT fund, COALESCE(SUM(amount) FILTER (WHERE type='Income'),0) AS income, COALESCE(SUM(amount) FILTER (WHERE type='Expense'),0) AS expense
     FROM financial_transactions WHERE transaction_date BETWEEN $1 AND $2 AND approval_status = 'Approved' GROUP BY fund`,
    [from, to],
  )).rows;
  const donations = (await query("SELECT fund, COALESCE(SUM(amount),0) AS total FROM donations WHERE donation_date BETWEEN $1 AND $2 GROUP BY fund", [from, to])).rows;
  res.json({ success: true, data: keysToCamel({ from, to, monthly, byCategory, byFund, donations }) });
}));

// Bank balances & reconciliation (ACC-05, FIN-16).
router.get("/bank-summary", requirePermission("accounts", "view"), asyncHandler(async (req, res) => {
  const rows = (await query(
    `SELECT b.*, b.opening_balance
       + COALESCE(SUM(t.amount) FILTER (WHERE t.txn_type = 'Deposit'), 0)
       - COALESCE(SUM(t.amount) FILTER (WHERE t.txn_type = 'Withdrawal'), 0) AS book_balance,
       b.opening_balance
       + COALESCE(SUM(t.amount) FILTER (WHERE t.txn_type = 'Deposit' AND t.reconciled), 0)
       - COALESCE(SUM(t.amount) FILTER (WHERE t.txn_type = 'Withdrawal' AND t.reconciled), 0) AS reconciled_balance,
       COUNT(t.id) FILTER (WHERE NOT t.reconciled)::int AS unreconciled
     FROM bank_accounts b LEFT JOIN bank_transactions t ON t.bank_account_id = b.id GROUP BY b.id ORDER BY b.bank_name`,
  )).rows;
  res.json({ success: true, data: keysToCamel(rows) });
}));

router.post("/bank-transactions/reconcile", requirePermission("accounts", "edit"), asyncHandler(async (req, res) => {
  const { ids = [], reconciled = true } = req.body || {};
  const r = await query("UPDATE bank_transactions SET reconciled = $1, reconciled_at = CASE WHEN $1 THEN CURRENT_DATE END WHERE id::text = ANY($2) RETURNING id", [Boolean(reconciled), ids]);
  await writeAudit(req, { entity: "bank_transactions", action: "RECONCILE", newValue: { ids, reconciled } });
  res.json({ success: true, data: { updated: r.rowCount } });
}));

// Voucher reversal (status change + reverse journal).
router.post("/vouchers/:id/reverse", requirePermission("accounts", "edit"), asyncHandler(async (req, res) => {
  const reason = String(req.body?.reason || "").trim();
  if (!reason) throw httpError(422, "Reason is required.");
  const result = await transaction(async (client) => {
    const v = (await client.query("SELECT * FROM vouchers WHERE id = $1 FOR UPDATE", [req.params.id])).rows[0];
    if (!v) throw httpError(404, "Voucher not found.");
    if (v.status === "Reversed") throw httpError(409, "Already reversed.");
    const entries = (v.entries || []).map((e) => ({ ...e, debit: Number(e.credit || 0), credit: Number(e.debit || 0) }));
    const rev = (await client.query(
      "INSERT INTO vouchers (voucher_type, voucher_date, narration, entries, total, fund, status, created_by) VALUES ('Journal', CURRENT_DATE, $1, $2, $3, $4, 'Posted', $5) RETURNING *",
      [`Reversal of ${v.id}: ${reason}`, JSON.stringify(entries), v.total, v.fund, req.user.id],
    )).rows[0];
    await client.query("UPDATE vouchers SET status = 'Reversed', reversed_by = $1 WHERE id = $2", [rev.id, v.id]);
    await writeAudit(req, { entity: "vouchers", entityId: v.id, action: "REVERSE", reason }, client);
    return rev;
  });
  res.json({ success: true, data: keysToCamel(result) });
}));

module.exports = router;
