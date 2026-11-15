// Provider adapters for bKash Tokenized Checkout and Nagad Remote Payment Gateway
// (SRS FE-10/11, FIN-08/11, INT-03, v1 NF-11). Each adapter exposes:
//   configured()                     -> credentials present?
//   create(txn, ctx)                 -> { providerRef, redirectUrl }
//   confirm(query)                   -> { providerRef, status: Success|Failed|Cancelled, amount, trxId, txnId? }
//   status(providerRef)              -> same shape as confirm, used by reconciliation
// The adapter never posts money itself; payments.finalize() does that idempotently.
const crypto = require("node:crypto");
const env = require("../config/env");

const returnUrl = (gateway) => `${env.publicAppUrl}/api/backend/public/payments/return/${gateway}`;

async function postJson(url, body, headers = {}) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", ...headers },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data = {};
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(data.statusMessage || data.message || text).toString().slice(0, 200)}`);
  return data;
}

// ------------------------------------------------------------------ bKash (Tokenized Checkout v1.2.0-beta)
let bkashToken = { value: null, expiresAt: 0 };
const bkash = {
  configured: () => Boolean(env.payment.bkashBaseUrl && env.payment.bkashAppKey && env.payment.bkashAppSecret && env.payment.bkashUsername && env.payment.bkashPassword),
  async token() {
    if (bkashToken.value && Date.now() < bkashToken.expiresAt) return bkashToken.value;
    const data = await postJson(`${env.payment.bkashBaseUrl}/tokenized/checkout/token/grant`,
      { app_key: env.payment.bkashAppKey, app_secret: env.payment.bkashAppSecret },
      { username: env.payment.bkashUsername, password: env.payment.bkashPassword });
    if (!data.id_token) throw new Error(`bKash token failed: ${data.statusMessage || "no token"}`);
    bkashToken = { value: data.id_token, expiresAt: Date.now() + (Number(data.expires_in || 3600) - 120) * 1000 };
    return bkashToken.value;
  },
  async headers() {
    return { Authorization: await bkash.token(), "X-APP-Key": env.payment.bkashAppKey };
  },
  async create(txn, ctx = {}) {
    const data = await postJson(`${env.payment.bkashBaseUrl}/tokenized/checkout/create`, {
      mode: "0011", payerReference: ctx.payerReference || txn.txn_id, callbackURL: returnUrl("bkash"),
      amount: Number(txn.amount).toFixed(2), currency: "BDT", intent: "sale", merchantInvoiceNumber: txn.txn_id,
    }, await bkash.headers());
    if (!data.paymentID || !data.bkashURL) throw new Error(`bKash create failed: ${data.statusMessage || data.errorMessage || "unknown"}`);
    return { providerRef: data.paymentID, redirectUrl: data.bkashURL };
  },
  map(data, fallbackRef) {
    const s = String(data.transactionStatus || "").toLowerCase();
    return {
      providerRef: data.paymentID || fallbackRef,
      status: s === "completed" ? "Success" : s === "initiated" || s === "inprogress" ? "Pending" : "Failed",
      amount: data.amount ? Number(data.amount) : null,
      trxId: data.trxID || null,
      txnId: data.merchantInvoiceNumber || null,
      raw: data,
    };
  },
  // bKash redirects with ?paymentID=&status=success|failure|cancel; success must be executed server-side.
  async confirm(q) {
    const paymentID = q.paymentID;
    if (!paymentID) throw new Error("paymentID missing");
    if (q.status === "cancel") return { providerRef: paymentID, status: "Cancelled" };
    if (q.status !== "success") return { providerRef: paymentID, status: "Failed" };
    let data;
    try {
      data = await postJson(`${env.payment.bkashBaseUrl}/tokenized/checkout/execute`, { paymentID }, await bkash.headers());
    } catch {
      data = null;
    }
    // Execute can time out after the debit; fall back to a status query (scenario "browser disconnected").
    if (!data || !data.transactionStatus) return bkash.status(paymentID);
    return bkash.map(data, paymentID);
  },
  async status(paymentID) {
    const data = await postJson(`${env.payment.bkashBaseUrl}/tokenized/checkout/payment/status`, { paymentID }, await bkash.headers());
    return bkash.map(data, paymentID);
  },
};

// ------------------------------------------------------------------ Nagad (Remote Payment Gateway v4)
// Sensitive data is RSA-encrypted with Nagad's public key and signed (SHA256withRSA) with the merchant key.
const pem = (key, type) => (String(key).includes("BEGIN") ? String(key).replace(/\\n/g, "\n")
  : `-----BEGIN ${type}-----\n${String(key).match(/.{1,64}/g).join("\n")}\n-----END ${type}-----`);
const nagadKeys = () => ({
  nagadPublic: pem(env.payment.nagadPublicKey, "PUBLIC KEY"),
  merchantPrivate: pem(env.payment.nagadMerchantPrivateKey, "PRIVATE KEY"),
});
const encryptFor = (obj, publicKey) => crypto.publicEncrypt({ key: publicKey, padding: crypto.constants.RSA_PKCS1_PADDING }, Buffer.from(JSON.stringify(obj))).toString("base64");
const signWith = (obj, privateKey) => crypto.createSign("SHA256").update(JSON.stringify(obj)).sign(privateKey, "base64");
const decryptWith = (b64, privateKey) => JSON.parse(crypto.privateDecrypt({ key: privateKey, padding: crypto.constants.RSA_PKCS1_PADDING }, Buffer.from(b64, "base64")).toString("utf8"));
const nagadTime = () => {
  const d = new Date(Date.now() + 6 * 3600e3); // Asia/Dhaka
  return d.toISOString().replace(/[-:T]/g, "").slice(0, 14);
};
const nagadHeaders = () => ({ "X-KM-Api-Version": "v-0.2.0", "X-KM-IP-V4": env.payment.serverIp || "127.0.0.1", "X-KM-Client-Type": "PC_WEB" });

const nagad = {
  configured: () => Boolean(env.payment.nagadBaseUrl && env.payment.nagadMerchantId && env.payment.nagadMerchantNumber && env.payment.nagadPublicKey && env.payment.nagadMerchantPrivateKey),
  async create(txn) {
    const { nagadPublic, merchantPrivate } = nagadKeys();
    const merchantId = env.payment.nagadMerchantId;
    const orderId = txn.txn_id;
    const datetime = nagadTime();
    const challenge = crypto.randomBytes(20).toString("hex");
    const sensitive = { merchantId, datetime, orderId, challenge };
    const init = await postJson(`${env.payment.nagadBaseUrl}/api/dfs/check-out/initialize/${merchantId}/${orderId}?locale=EN`, {
      accountNumber: env.payment.nagadMerchantNumber, dateTime: datetime,
      sensitiveData: encryptFor(sensitive, nagadPublic), signature: signWith(sensitive, merchantPrivate),
    }, nagadHeaders());
    if (!init.sensitiveData) throw new Error(`Nagad initialize failed: ${init.message || "unknown"}`);
    const plain = decryptWith(init.sensitiveData, merchantPrivate);
    const order = { merchantId, orderId, currencyCode: "050", amount: Number(txn.amount).toFixed(2), challenge: plain.challenge };
    const done = await postJson(`${env.payment.nagadBaseUrl}/api/dfs/check-out/complete/${plain.paymentReferenceId}`, {
      sensitiveData: encryptFor(order, nagadPublic), signature: signWith(order, merchantPrivate),
      merchantCallbackURL: returnUrl("nagad"), additionalMerchantInfo: { purpose: "Tuition fee" },
    }, nagadHeaders());
    if (String(done.status).toLowerCase() !== "success" || !done.callBackUrl) throw new Error(`Nagad complete failed: ${done.message || "unknown"}`);
    return { providerRef: plain.paymentReferenceId, redirectUrl: done.callBackUrl };
  },
  async status(paymentRefId) {
    const res = await fetch(`${env.payment.nagadBaseUrl}/api/dfs/verify/payment/${encodeURIComponent(paymentRefId)}`, { headers: nagadHeaders() });
    const data = await res.json().catch(() => ({}));
    const s = String(data.status || "").toLowerCase();
    return {
      providerRef: paymentRefId,
      status: s === "success" ? "Success" : ["aborted", "cancelled"].includes(s) ? "Cancelled" : s === "" || s === "initiated" || s === "ready" ? "Pending" : "Failed",
      amount: data.amount ? Number(data.amount) : null,
      trxId: data.issuerPaymentRefNo || null,
      txnId: data.orderId || null,
      raw: data,
    };
  },
  // Nagad redirects with ?payment_ref_id=&order_id=&status=; always verify with the server.
  async confirm(q) {
    const ref = q.payment_ref_id;
    if (!ref) throw new Error("payment_ref_id missing");
    return nagad.status(ref);
  },
};

module.exports = { bkash, nagad, ADAPTERS: { bkash, nagad } };
