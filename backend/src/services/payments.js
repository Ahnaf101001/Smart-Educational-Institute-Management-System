// Online payment gateway adapter (SRS FE-10/11, FIN-08/09/11, NFR-11).
// Callbacks are idempotent: a transaction posts to the ledger exactly once,
// repeated callbacks are only counted and logged.
const crypto = require("node:crypto");
const env = require("../config/env");
const { query, transaction } = require("../db/pool");
const httpError = require("../utils/httpError");
const { postPayment, notifyPayment } = require("./fees");
const { ADAPTERS } = require("./gatewayAdapters");

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
  const configured = gateway === "sslcommerz" ? env.payment.sslcommerzStoreId : ADAPTERS[gateway]?.configured();
  if (configured && ADAPTERS[gateway]) {
    // bKash Tokenized Checkout / Nagad Remote Payment Gateway.
    try {
      const created = await ADAPTERS[gateway].create(row, { payerReference: guardianId || undefined });
      await query("UPDATE gateway_transactions SET provider_ref = $1 WHERE id = $2", [created.providerRef, row.id]);
      paymentUrl = created.redirectUrl;
    } catch (error) {
      await query("UPDATE gateway_transactions SET status = 'Failed', last_payload = $1 WHERE id = $2", [JSON.stringify({ error: error.message }), row.id]);
      throw httpError(502, `${gateway} session failed: ${error.message}`);
    }
  } else if (configured && gateway === "sslcommerz") {
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

// Gateway redirect back to us: confirm with the provider (server-to-server), then post once.
async function confirmReturn(gateway, q) {
  const adapter = ADAPTERS[gateway];
  if (!adapter) throw httpError(404, "Unknown gateway.");
  const result = await adapter.confirm(q);
  const txn = (await query("SELECT * FROM gateway_transactions WHERE gateway = $1 AND provider_ref = $2", [gateway, result.providerRef])).rows[0];
  if (!txn) throw httpError(404, "Unknown payment reference.");
  if (result.txnId && result.txnId !== txn.txn_id) throw httpError(409, "Payment reference does not match the order.");
  if (result.trxId) await query("UPDATE gateway_transactions SET provider_trx_id = $1 WHERE id = $2", [result.trxId, txn.id]);
  if (result.status === "Pending") return { txn, status: "Pending" };
  const out = await finalize({ gateway, txnId: txn.txn_id, status: result.status, payload: { amount: result.amount ?? txn.amount, trxId: result.trxId, source: "return" } });
  return { txn, status: out.status || "Success", duplicate: out.duplicate };
}

// Timeout recovery / reconciliation (FIN-11, scenario "gateway success but browser disconnected"):
// pending transactions older than 5 minutes are queried at the provider and finalised once.
async function reconcilePending({ olderThanMinutes = 5, limit = 25 } = {}) {
  const rows = (await query(
    `SELECT * FROM gateway_transactions WHERE status = 'Pending' AND posted = FALSE AND provider_ref IS NOT NULL
       AND gateway = ANY($1) AND created_at < NOW() - ($2 || ' minutes')::interval
       AND (last_checked_at IS NULL OR last_checked_at < NOW() - INTERVAL '5 minutes')
     ORDER BY created_at LIMIT $3`,
    [Object.keys(ADAPTERS), String(olderThanMinutes), limit],
  )).rows;
  const summary = { checked: 0, posted: 0, failed: 0, pending: 0 };
  for (const txn of rows) {
    const adapter = ADAPTERS[txn.gateway];
    if (!adapter.configured()) continue;
    summary.checked += 1;
    try {
      const r = await adapter.status(txn.provider_ref);
      await query("UPDATE gateway_transactions SET last_checked_at = NOW(), provider_trx_id = COALESCE($1, provider_trx_id) WHERE id = $2", [r.trxId, txn.id]);
      if (r.status === "Pending") {
        // Abandoned sessions expire after 24 hours.
        if (Date.now() - new Date(txn.created_at).getTime() > 24 * 3600e3) {
          await finalize({ gateway: txn.gateway, txnId: txn.txn_id, status: "Failed", payload: { reason: "expired" } });
          summary.failed += 1;
        } else summary.pending += 1;
        continue;
      }
      const out = await finalize({ gateway: txn.gateway, txnId: txn.txn_id, status: r.status, payload: { amount: r.amount ?? txn.amount, trxId: r.trxId, source: "reconcile" } });
      if (out.status === "Success" && !out.duplicate) summary.posted += 1; else if (r.status !== "Success") summary.failed += 1;
    } catch (error) {
      await query("UPDATE gateway_transactions SET last_checked_at = NOW(), last_payload = $1 WHERE id = $2", [JSON.stringify({ reconcileError: error.message }), txn.id]);
    }
  }
  return summary;
}

module.exports = { GATEWAYS, initiate, finalize, verifySignature, sign, confirmReturn, reconcilePending };
