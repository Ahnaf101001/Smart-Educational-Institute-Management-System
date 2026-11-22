// Background push to the AeroSchool Guardian Mobile App via Firebase Cloud Messaging (HTTP v1).
//
// Configure ONE of:
//   FCM_SERVICE_ACCOUNT_FILE=/path/to/firebase-service-account.json
//   FCM_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}'
// (Firebase console → Project settings → Service accounts → Generate new private key.)
// Without credentials push is skipped silently; in-app notifications still work.
const fs = require("node:fs");
const jwt = require("jsonwebtoken");
const { query } = require("../db/pool");

let serviceAccount;
let cachedToken = { value: null, expiresAt: 0 };

function loadServiceAccount() {
  if (serviceAccount !== undefined) return serviceAccount;
  try {
    const raw = process.env.FCM_SERVICE_ACCOUNT_JSON
      || (process.env.FCM_SERVICE_ACCOUNT_FILE ? fs.readFileSync(process.env.FCM_SERVICE_ACCOUNT_FILE, "utf8") : "");
    serviceAccount = raw ? JSON.parse(raw) : null;
    if (serviceAccount && !(serviceAccount.client_email && serviceAccount.private_key && serviceAccount.project_id)) {
      console.error("[push] FCM service account is missing client_email / private_key / project_id; push disabled.");
      serviceAccount = null;
    }
  } catch (error) {
    console.error("[push] Could not read the FCM service account:", error.message);
    serviceAccount = null;
  }
  return serviceAccount;
}

function isConfigured() {
  return Boolean(loadServiceAccount());
}

// OAuth2 access token for the FCM API (JWT bearer grant), cached until shortly before expiry.
async function accessToken() {
  if (cachedToken.value && Date.now() < cachedToken.expiresAt - 60_000) return cachedToken.value;
  const sa = loadServiceAccount();
  const now = Math.floor(Date.now() / 1000);
  const assertion = jwt.sign(
    { iss: sa.client_email, scope: "https://www.googleapis.com/auth/firebase.messaging", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 },
    sa.private_key,
    { algorithm: "RS256" },
  );
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) throw new Error(`FCM auth failed (${response.status}): ${data.error_description || data.error || "unknown"}`);
  cachedToken = { value: data.access_token, expiresAt: Date.now() + Number(data.expires_in || 3600) * 1000 };
  return cachedToken.value;
}

async function sendToToken(token, { title, body, data }) {
  const sa = loadServiceAccount();
  const response = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${await accessToken()}` },
    body: JSON.stringify({
      message: {
        token,
        notification: { title: String(title || "AeroSchool").slice(0, 120), body: String(body || "").slice(0, 400) },
        data: Object.fromEntries(Object.entries(data || {}).filter(([, v]) => v !== null && v !== undefined).map(([k, v]) => [k, String(v)])),
        android: { priority: "HIGH" },
        apns: { payload: { aps: { sound: "default" } } },
      },
    }),
  });
  if (response.ok) return { ok: true };
  const err = await response.json().catch(() => ({}));
  const code = err?.error?.details?.find?.((d) => d.errorCode)?.errorCode || err?.error?.status;
  // Token no longer valid (app uninstalled / token rotated): forget it.
  const invalid = response.status === 404 || ["UNREGISTERED", "INVALID_ARGUMENT"].includes(code);
  return { ok: false, invalid, error: `${response.status} ${code || ""}`.trim() };
}

// Pushes to every registered device of a guardian. Never throws.
async function pushToGuardian(guardianId, { title, body, data, eventType }) {
  if (!guardianId || !isConfigured()) return { sent: 0, skipped: true };
  try {
    const g = (await query("SELECT notification_prefs, status, portal_access FROM guardians WHERE id = $1", [guardianId])).rows[0];
    if (!g || g.status !== "Active" || !g.portal_access) return { sent: 0 };
    const mandatory = ["Emergency", "EmergencyAlert"].includes(eventType);
    if (!mandatory && g.notification_prefs?.push === false) return { sent: 0, optedOut: true };
    const devices = (await query("SELECT id, token FROM guardian_devices WHERE guardian_id = $1", [guardianId])).rows;
    let sent = 0;
    for (const d of devices) {
      const r = await sendToToken(d.token, { title, body, data });
      if (r.ok) sent += 1;
      else if (r.invalid) await query("DELETE FROM guardian_devices WHERE id = $1", [d.id]);
      else console.error(`[push] send failed for guardian ${guardianId}: ${r.error}`);
    }
    return { sent };
  } catch (error) {
    console.error("[push] pushToGuardian failed:", error.message);
    return { sent: 0, error: error.message };
  }
}

module.exports = { isConfigured, pushToGuardian, sendToToken };
