// Online payment gateway adapter (SRS FE-10/11, FIN-08/09/11, NFR-11).
// Callbacks are idempotent: a transaction posts to the ledger exactly once,
// repeated callbacks are only counted and logged.
const crypto = require("node:crypto");
const env = require("../config/env");
const { query, transaction } = require("../db/pool");
const httpError = require("../utils/httpError");
const { postPayment, notifyPayment } = require("./fees");

const GATEWAYS = ["bkash", "nagad", "rocket", "sslcommerz"];

function sign(payload) {
  return crypto.createHmac("sha256", env.payment.callbackSecret || "dev-only-secret").update(payload).digest("hex");
}

function verifySignature(rawBody, signature) {
  if (!env.payment.callbackSecret) return env.nodeEnv === "development";
  if (!signature) return false;
  const expected = sign(rawBody);
  return expected.length === String(signature).length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(String(signature)));
}

async function initiate(req, { invoiceIds, gateway, guardianId }) {
  if (!GATEWAYS.includes(gateway)) throw httpError(422, `Unsupported gateway. Use one of ${GATEWAYS.join(", ")}.`);
  const settings = (await query("SELECT payment_gateways FROM system_settings WHERE id = 1")).rows[0] || {};
  if (!settings.payment_gateways?.[gateway]) throw httpError(409, `${gateway} is not enabled by the institution.`);
  const invoices = (await query(
    "SELECT * FROM fee_invoices WHERE id = ANY($1) AND status NOT IN ('Paid','Cancelled')",
    [invoiceIds],
  )).rows;
  if (!invoices.length) throw httpError(422, "No payable invoices selected.");
  const amount = invoices.reduce((s, i) => s + Math.max(0, Number(i.amount) + Number(i.late_fine || 0) - Number(i.discount) - Number(i.paid_amount)), 0);
  const txnId = `TXN${Date.now()}${crypto.randomInt(1000, 9999)}`;
  const idem = crypto.randomUUID();
  const row = (await query(
    `INSERT INTO gateway_transactions (gateway, txn_id, idempotency_key, guardian_id, invoice_ids, amount)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [gateway, txnId, idem, guardianId || null, JSON.stringify(invoices.map((i) => i.id)), Math.round(amount * 100) / 100],
  )).rows[0];

  // Real provider integrations require merchant credentials. Without them the
  // institution can only use the development sandbox page.
  let paymentUrl;
  const configured = gateway === "sslcommerz" ? env.payment.sslcommerzStoreId : gateway === "bkash" ? env.payment.bkashBaseUrl : env.payment.nagadBaseUrl;
  if (configured && gateway === "sslcommerz") {
    const base = env.payment.sslcommerzSandbox ? "https://sandbox.sslcommerz.com" : "https://securepay.sslcommerz.com";
    const form = new URLSearchParams({
      store_id: env.payment.sslcommerzStoreId, store_passwd: env.payment.sslcommerzStorePassword,
      total_amount: String(row.amount), currency: "BDT", tran_id: txnId,
      success_url: `${env.publicAppUrl}/api/backend/public/payments/return/sslcommerz?status=success`,
      fail_url: `${env.publicAppUrl}/api/backend/public/payments/return/sslcommerz?status=failed`,
      cancel_url: `${env.publicAppUrl}/api/backend/public/payments/return/sslcommerz?status=cancelled`,
      ipn_url: `${env.publicAppUrl}/api/backend/public/payments/ipn/sslcommerz`,
      product_name: "Tuition fee", product_category: "Education", product_profile: "non-physical-goods",
      cus_name: req.user?.name || "Guardian", cus_email: "guardian@example.com", cus_phone: "01700000000",
      cus_add1: "Bangladesh", cus_city: "Dhaka", cus_country: "Bangladesh", shipping_method: "NO",
    });
    const resp = await fetch(`${base}/gwprocess/v4/api.php`, { method: "POST", body: form });
    const data = await resp.json().catch(() => ({}));
    if (data.status !== "SUCCESS") throw httpError(502, `Gateway session failed: ${data.failedreason || "unknown error"}`);
    paymentUrl = data.GatewayPageURL;
  } else if (env.nodeEnv === "development") {
    paymentUrl = `/pay/sandbox/${row.id}`;
  } else {
    throw httpError(503, `${gateway} merchant credentials are not configured on the server.`);
  }
  return { transaction: row, paymentUrl };
}

// Finalises a transaction once (idempotent) – used by callback/IPN and reconciliation.
async function finalize({ gateway, txnId, status, payload }) {
  return transaction(async (client) => {
    const txn = (await client.query("SELECT * FROM gateway_transactions WHERE gateway = $1 AND txn_id = $2 FOR UPDATE", [gateway, txnId])).rows[0];
    if (!txn) throw httpError(404, "Unknown transaction.");
    await client.query("UPDATE gateway_transactions SET callback_count = callback_count + 1, last_payload = $1 WHERE id = $2", [JSON.stringify(payload || {}), txn.id]);
    if (txn.posted) return { duplicate: true, transaction: txn };
    if (status !== "Success") {
      await client.query("UPDATE gateway_transactions SET status = $1 WHERE id = $2", [status === "Cancelled" ? "Cancelled" : "Failed", txn.id]);
      return { duplicate: false, status };
    }
    const paidAmount = payload?.amount ? Number(payload.amount) : Number(txn.amount);
    if (Math.abs(paidAmount - Number(txn.amount)) > 0.01) {
      await client.query("UPDATE gateway_transactions SET status = 'Failed' WHERE id = $1", [txn.id]);
      throw httpError(409, "Paid amount does not match the transaction amount; flagged for reconciliation.");
    }
    const invoiceIds = txn.invoice_ids || [];
    const result = await postPayment(client, { user: { id: null, name: `Online (${gateway})` } }, {
      invoiceIds, amount: paidAmount, method: `Online - ${gateway}`, referenceNo: txnId,
      gateway, gatewayTxnId: txnId, guardianId: txn.guardian_id, allowAdvance: true,
    });
    await client.query(
      "UPDATE gateway_transactions SET status = 'Success', posted = TRUE, posted_at = NOW(), allocations = $1 WHERE id = $2",
      [JSON.stringify(result.receipts.map((r) => ({ invoiceId: r.invoice_id, studentId: r.student_id, amount: r.amount, receipt: r.receipt_no }))), txn.id],
    );
    const students = [...new Set(result.receipts.map((r) => r.student_id))];
    setImmediate(() => students.forEach((sid) => notifyPayment(sid, result.receipts.filter((r) => r.student_id === sid)).catch(() => {})));
    return { duplicate: false, status: "Success", receipts: result.receipts };
  });
}

module.exports = { GATEWAYS, initiate, finalize, verifySignature, sign };
