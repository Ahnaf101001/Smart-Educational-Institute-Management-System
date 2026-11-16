// Fee engine (SRS §11, §30 FIN-01..17). Every payment is allocated to specific
// student invoices; receipts are serial and never deleted (cancel = reversal).
const httpError = require("../utils/httpError");
const { writeAudit } = require("./audit");
const { queueMessage, guardiansForStudent } = require("./notifications");
const { renderTemplate } = require("./templates");
const { localDate } = require("../utils/dates");

function invoiceDue(inv) {
  return Math.max(0, Number(inv.amount) + Number(inv.late_fine || 0) - Number(inv.discount) - Number(inv.paid_amount));
}

function statusFor(inv, paid) {
  const net = Number(inv.amount) + Number(inv.late_fine || 0) - Number(inv.discount);
  if (paid <= 0) return inv.due_date && String(inv.due_date).slice(0, 10) < localDate() ? "Overdue" : "Due";
  return paid + 0.005 >= net ? "Paid" : "Partial";
}

async function nextReceiptNo(client) {
  const r = await client.query("SELECT 'RCPT-' || nextval('receipt_no_seq') AS no");
  return r.rows[0].no;
}

// Allocates `amount` across invoices (oldest due first unless explicit ids given).
// Any remainder becomes an advance credit (FIN-03, scenario "Partial/advance payment").
async function postPayment(client, req, {
  studentIds, invoiceIds, amount, method, referenceNo, notes, gateway, gatewayTxnId, guardianId, allowAdvance = true,
}) {
  amount = Number(amount);
  if (!(amount > 0)) throw httpError(422, "Payment amount must be greater than zero.");

  const params = [];
  let where;
  if (invoiceIds?.length) {
    params.push(invoiceIds);
    where = "id = ANY($1)";
  } else {
    params.push(studentIds);
    where = "student_id = ANY($1)";
  }
  const invoices = (await client.query(
    `SELECT * FROM fee_invoices WHERE ${where} AND status NOT IN ('Paid', 'Cancelled')
     ORDER BY due_date NULLS LAST, billing_month NULLS LAST, created_at FOR UPDATE`,
    params,
  )).rows;

  const groupRef = invoices.length > 1 || (studentIds?.length > 1) ? `GRP-${Date.now()}` : null;
  let remaining = amount;
  const receipts = [];
  for (const inv of invoices) {
    if (remaining <= 0.0001) break;
    const due = invoiceDue(inv);
    if (due <= 0) continue;
    const portion = Math.min(due, remaining);
    remaining = Math.round((remaining - portion) * 100) / 100;
    const receiptNo = await nextReceiptNo(client);
    const pay = (await client.query(
      `INSERT INTO fee_payments (invoice_id, student_id, amount, payment_method, reference_no, received_by, notes,
         receipt_no, gateway, gateway_txn_id, guardian_id, collector_name, group_ref)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [inv.id, inv.student_id, portion, method, referenceNo || null, req?.user?.id || null, notes || null,
        receiptNo, gateway || null, gatewayTxnId || null, guardianId || null, req?.user?.name || (gateway ? `Online (${gateway})` : null), groupRef],
    )).rows[0];
    const newPaid = Number(inv.paid_amount) + portion;
    await client.query("UPDATE fee_invoices SET paid_amount = $1, status = $2 WHERE id = $3", [newPaid, statusFor(inv, newPaid), inv.id]);
    await client.query(
      `INSERT INTO financial_transactions (type, transaction_date, description, category, payment_method, amount,
         status, reference_no, created_by, details, fund)
       VALUES ('Income', CURRENT_DATE, $1, $2, $3, $4, 'Completed', $5, $6, $7, 'General')`,
      [`Fee: ${inv.fee_head || "Invoice"} – ${inv.student_id}`, inv.fee_head || "Tuition Fee", method, portion, receiptNo,
        req?.user?.id || null, JSON.stringify({ invoiceId: inv.id, studentId: inv.student_id, paymentId: pay.id })],
    );
    receipts.push(pay);
  }

  if (remaining > 0.0001) {
    if (!allowAdvance) throw httpError(422, "Payment amount exceeds the total due.", { remaining });
    // Advance: stored as a negative-due credit invoice the next invoices consume.
    const studentId = (studentIds && studentIds[0]) || invoices[0]?.student_id;
    if (!studentId) throw httpError(422, "No open invoices; specify a student to record an advance.");
    const credit = (await client.query(
      `INSERT INTO fee_invoices (student_id, billing_month, amount, paid_amount, status, notes, fee_head)
       VALUES ($1, date_trunc('month', CURRENT_DATE)::date, 0, 0, 'Paid', $2, 'Advance Credit') RETURNING *`,
      [studentId, `Advance credit of ${remaining}`],
    )).rows[0];
    const receiptNo = await nextReceiptNo(client);
    const pay = (await client.query(
      `INSERT INTO fee_payments (invoice_id, student_id, amount, payment_method, reference_no, received_by, notes,
         receipt_no, gateway, gateway_txn_id, guardian_id, collector_name, group_ref)
       VALUES ($1,$2,$3,$4,$5,$6,'Advance payment',$7,$8,$9,$10,$11,$12) RETURNING *`,
      [credit.id, studentId, remaining, method, referenceNo || null, req?.user?.id || null, receiptNo,
        gateway || null, gatewayTxnId || null, guardianId || null, req?.user?.name || null, groupRef],
    )).rows[0];
    await client.query(
      `INSERT INTO financial_transactions (type, transaction_date, description, category, payment_method, amount, status, reference_no, details)
       VALUES ('Income', CURRENT_DATE, $1, 'Advance Fees', $2, $3, 'Completed', $4, $5)`,
      [`Advance fee – ${studentId}`, method, remaining, receiptNo, JSON.stringify({ studentId, advance: true })],
    );
    receipts.push({ ...pay, advance: true });
  }

  await writeAudit(req, { entity: "fee_payments", entityId: receipts.map((r) => r.receipt_no).join(","), action: "COLLECT", newValue: { amount, method, receipts: receipts.map((r) => ({ receipt: r.receipt_no, invoice: r.invoice_id, amount: r.amount })) } }, client);
  return { receipts, totalAllocated: amount, groupRef };
}

// Consumes advance credit for a student against open invoices.
async function applyAdvanceCredit(client, studentId) {
  const credit = (await client.query(
    `SELECT COALESCE(SUM(p.amount), 0) AS total FROM fee_payments p JOIN fee_invoices i ON i.id = p.invoice_id
     WHERE i.student_id = $1 AND i.fee_head = 'Advance Credit' AND p.status = 'Valid'`,
    [studentId],
  )).rows[0];
  const used = (await client.query(
    "SELECT COALESCE(SUM(amount), 0) AS total FROM fee_payments WHERE student_id = $1 AND payment_method = 'Advance Adjustment' AND status = 'Valid'",
    [studentId],
  )).rows[0];
  let available = Number(credit.total) - Number(used.total);
  if (available <= 0) return 0;
  const invoices = (await client.query(
    "SELECT * FROM fee_invoices WHERE student_id = $1 AND status NOT IN ('Paid','Cancelled') AND fee_head <> 'Advance Credit' ORDER BY due_date NULLS LAST FOR UPDATE",
    [studentId],
  )).rows;
  let applied = 0;
  for (const inv of invoices) {
    if (available <= 0) break;
    const portion = Math.min(invoiceDue(inv), available);
    if (portion <= 0) continue;
    const receiptNo = await nextReceiptNo(client);
    await client.query(
      `INSERT INTO fee_payments (invoice_id, student_id, amount, payment_method, notes, receipt_no, collector_name)
       VALUES ($1,$2,$3,'Advance Adjustment','Adjusted from advance credit',$4,'System')`,
      [inv.id, studentId, portion, receiptNo],
    );
    const newPaid = Number(inv.paid_amount) + portion;
    await client.query("UPDATE fee_invoices SET paid_amount = $1, status = $2 WHERE id = $3", [newPaid, statusFor(inv, newPaid), inv.id]);
    available -= portion;
    applied += portion;
  }
  return applied;
}

// Applies approved discounts to a student's open invoices (FIN-05).
async function applyDiscounts(client, studentId) {
  const discounts = (await client.query(
    `SELECT * FROM fee_discounts WHERE student_id = $1 AND status = 'Approved'
       AND (valid_from IS NULL OR valid_from <= CURRENT_DATE) AND (valid_to IS NULL OR valid_to >= CURRENT_DATE)`,
    [studentId],
  )).rows;
  const invoices = (await client.query(
    `SELECT i.*, fs.fee_head_id FROM fee_invoices i LEFT JOIN fee_structures fs ON fs.id = i.fee_structure_id
     WHERE i.student_id = $1 AND i.status NOT IN ('Paid', 'Cancelled') AND i.fee_head IS DISTINCT FROM 'Advance Credit' FOR UPDATE OF i`,
    [studentId],
  )).rows;
  // Stacking policy and maximum discount (FE-09, FIN-05): when stacking is off only the
  // single largest applicable discount counts; the total never exceeds max_discount_percent.
  const policy = (await client.query("SELECT allow_discount_stacking, max_discount_percent FROM system_settings WHERE id = 1")).rows[0] || {};
  const stacking = policy.allow_discount_stacking !== false;
  const capPercent = Number(policy.max_discount_percent ?? 100);
  let updated = 0;
  for (const inv of invoices) {
    const amounts = [];
    for (const d of discounts) {
      if (d.fee_head_id && d.fee_head_id !== inv.fee_head_id) continue;
      amounts.push(d.mode === "Percent" ? (Number(inv.amount) * Number(d.value)) / 100 : Number(d.value));
    }
    let discount = stacking ? amounts.reduce((sum, v) => sum + v, 0) : Math.max(0, ...amounts);
    discount = Math.min(discount, (Number(inv.amount) * capPercent) / 100);
    discount = Math.min(Number(inv.amount), Math.round(discount * 100) / 100);
    if (Math.abs(discount - Number(inv.discount)) > 0.001) {
      await client.query("UPDATE fee_invoices SET discount = $1, status = $2 WHERE id = $3",
        [discount, statusFor({ ...inv, discount }, Number(inv.paid_amount)), inv.id]);
      updated += 1;
    }
  }
  return updated;
}

// Receipt cancellation: never deletes; reverses ledger and invoice (FIN-10, scenario "Receipt cancellation").
async function cancelReceipt(client, req, paymentId, reason) {
  const pay = (await client.query("SELECT * FROM fee_payments WHERE id = $1 FOR UPDATE", [paymentId])).rows[0];
  if (!pay) throw httpError(404, "Payment not found.");
  if (pay.status === "Cancelled") throw httpError(409, "Receipt already cancelled.");
  const inv = (await client.query("SELECT * FROM fee_invoices WHERE id = $1 FOR UPDATE", [pay.invoice_id])).rows[0];
  await client.query(
    "UPDATE fee_payments SET status = 'Cancelled', cancelled_reason = $1, cancelled_by = $2, cancelled_at = NOW() WHERE id = $3",
    [reason, req?.user?.name || null, pay.id],
  );
  if (inv) {
    const newPaid = Math.max(0, Number(inv.paid_amount) - Number(pay.amount));
    await client.query("UPDATE fee_invoices SET paid_amount = $1, status = $2 WHERE id = $3", [newPaid, statusFor(inv, newPaid), inv.id]);
  }
  await client.query("UPDATE financial_transactions SET reversed = TRUE WHERE reference_no = $1 AND type = 'Income'", [pay.receipt_no]);
  await client.query(
    `INSERT INTO financial_transactions (type, transaction_date, description, category, payment_method, amount, status, reference_no, details, reversed_of)
     VALUES ('Expense', CURRENT_DATE, $1, 'Fee Reversal', $2, $3, 'Completed', $4, $5, $6)`,
    [`Receipt ${pay.receipt_no} cancelled: ${reason}`, pay.payment_method, pay.amount, `REV-${pay.receipt_no}`,
      JSON.stringify({ paymentId: pay.id, reason }), pay.receipt_no],
  );
  await writeAudit(req, { entity: "fee_payments", entityId: pay.id, action: "CANCEL_RECEIPT", oldValue: pay, reason }, client);
  return pay;
}

async function notifyPayment(studentId, receipts, lang = "bn") {
  const total = receipts.reduce((s, r) => s + Number(r.amount), 0);
  const guardians = await guardiansForStudent(studentId, { primaryOnly: true });
  for (const g of guardians) {
    if (!g.mobile) continue;
    const body = await renderTemplate("payment", lang, { amount: total.toFixed(2), receipt: receipts.map((r) => r.receipt_no).join(", ") });
    await queueMessage({ channel: "SMS", eventType: "Payment", recipient: g.mobile, recipientType: "Guardian", recipientId: g.id, studentId, body });
  }
}

module.exports = { invoiceDue, statusFor, postPayment, applyAdvanceCredit, applyDiscounts, cancelReceipt, notifyPayment };
