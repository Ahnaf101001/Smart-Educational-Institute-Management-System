const express = require("express");
const crypto = require("node:crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { z } = require("zod");
const env = require("../config/env");
const { query } = require("../db/pool");
const validate = require("../middleware/validate");
const rateLimit = require("../middleware/rateLimit");
const { authenticate } = require("../middleware/auth");
const asyncHandler = require("../utils/asyncHandler");
const httpError = require("../utils/httpError");
const { keysToCamel } = require("../utils/case");
const { resolveAccess } = require("../services/access");
const { MODULES, ACTIONS, isAdminRoleName } = require("../services/permissions");
const { writeAudit } = require("../services/audit");
const { queueMessage, processQueue } = require("../services/notifications");

const router = express.Router();
// Limits are per network address + account: a school office or a mobile carrier puts many
// users behind one IP, so an IP-only limit locked genuine staff/guardians out each morning.
// A wider per-IP cap still stops one address from cycling through many accounts.
const who = (req) => String(req.body?.identifier || req.body?.email || req.body?.mobile || "").trim().toLowerCase();
const perAccount = (req) => `${req.ip}|${who(req)}`;
const LOGIN_MSG = "Too many login attempts. Try again in 15 minutes.";
const OTP_MSG = "Too many OTP requests. Try again later.";
const loginAccountLimiter = rateLimit({ windowMs: 15 * 60_000, max: 10, key: perAccount, message: LOGIN_MSG, skipSuccessful: true });
const loginIpLimiter = rateLimit({ windowMs: 15 * 60_000, max: 300, message: LOGIN_MSG });
const loginLimiter = [loginIpLimiter, loginAccountLimiter];
const otpAccountLimiter = rateLimit({ windowMs: 15 * 60_000, max: 5, key: perAccount, message: OTP_MSG });
const otpIpLimiter = rateLimit({ windowMs: 15 * 60_000, max: 60, message: OTP_MSG });
const otpLimiter = [otpIpLimiter, otpAccountLimiter];

const loginSchema = z.object({
  email: z.string().min(3).optional(),
  identifier: z.string().min(3).optional(),
  password: z.string().min(6),
}).refine((v) => v.email || v.identifier, { message: "Email or mobile is required." });

function normalizeMobile(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("880")) return `0${digits.slice(3)}`;
  return digits;
}

async function findUser(identifier) {
  const id = String(identifier || "").trim();
  const mobile = normalizeMobile(id);
  const result = await query(
    `SELECT * FROM users WHERE LOWER(email) = LOWER($1) OR (phone IS NOT NULL AND phone = $2) LIMIT 1`,
    [id, mobile || "__none__"],
  );
  return result.rows[0];
}

async function settings() {
  return (await query("SELECT max_login_attempts, session_timeout_minutes, enforce_admin_two_factor FROM system_settings WHERE id = 1")).rows[0] || {};
}

async function issueSession(req, user, method = "password") {
  if (user.access_expires_at && new Date(user.access_expires_at) < new Date()) {
    throw httpError(401, "Your access period has ended.");
  }
  const access = await resolveAccess(user);
  // One row per signed-in device so users can review and sign out devices (GA-05).
  const { clientIp } = require("../middleware/auth");
  const session = (await query(
    "INSERT INTO user_sessions (user_id, user_agent, ip, method) VALUES ($1,$2,$3,$4) RETURNING id",
    [user.id, String(req.headers["user-agent"] || "").slice(0, 300), clientIp(req), method],
  )).rows[0];
  const token = jwt.sign(
    { sub: user.id, role: user.role, tv: Number(user.token_version || 0), sid: session.id },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn },
  );
  await query("UPDATE users SET last_login_at = NOW(), failed_attempts = 0, locked_until = NULL WHERE id = $1", [user.id]);
  await writeAudit({ ...req, user: { id: user.id, name: user.name } }, { entity: "users", entityId: user.id, action: "LOGIN" });
  const safe = { ...user };
  delete safe.password_hash; delete safe.otp_hash; delete safe.pin_hash;
  safe.has_pin = Boolean(user.pin_hash);
  return {
    token,
    user: keysToCamel({
      ...safe,
      roles: access.roleNames,
      isAdmin: access.isAdmin,
      matrix: access.matrix,
      canViewSensitive: access.canViewSensitive,
      permissions: access.isAdmin ? ["All Modules"] : [],
    }),
  };
}

async function sendOtp(user, purpose) {
  const code = String(crypto.randomInt(100000, 1000000));
  const hash = await bcrypt.hash(code, 10);
  await query(
    "UPDATE users SET otp_hash = $1, otp_expires_at = NOW() + INTERVAL '5 minutes', otp_sent_count = otp_sent_count + 1 WHERE id = $2",
    [hash, user.id],
  );
  if (user.phone) {
    await queueMessage({
      channel: "SMS", eventType: "OTP", recipient: user.phone, recipientType: "User", recipientId: user.id,
      body: `Your ${purpose} code is ${code}. It expires in 5 minutes. Do not share it.`,
    });
    processQueue().catch(() => {});
  }
  // Development convenience only: expose the code when no SMS provider exists.
  return env.nodeEnv === "development" && !env.sms.apiUrl ? code : undefined;
}

router.post("/login", loginLimiter, validate(loginSchema), asyncHandler(async (req, res) => {
  const identifier = req.body.identifier || req.body.email;
  const user = await findUser(identifier);
  const policy = await settings();

  if (user?.locked_until && new Date(user.locked_until) > new Date()) {
    throw httpError(423, "Account temporarily locked after repeated failed attempts. Try again later.");
  }
  // Correct password on a deactivated account: tell the user to contact the school
  // (Guardian App login workflow). Wrong passwords still get the generic message below.
  if (user && user.status !== "Active" && (await bcrypt.compare(req.body.password, user.password_hash))) {
    const e = httpError(403, "Your account is inactive. Please contact the school office.");
    e.code = "ACCOUNT_INACTIVE";
    throw e;
  }
  if (!user || user.status !== "Active" || !(await bcrypt.compare(req.body.password, user.password_hash))) {
    if (user) {
      const attempts = Number(user.failed_attempts || 0) + 1;
      const max = Number(policy.max_login_attempts || 5);
      await query(
        `UPDATE users SET failed_attempts = $1::int,
           locked_until = CASE WHEN $1::int >= $2::int THEN NOW() + INTERVAL '15 minutes' ELSE locked_until END WHERE id = $3`,
        [attempts >= max ? 0 : attempts, max, user.id],
      );
      await writeAudit({ ...req, user: { id: user.id, name: user.name } }, { entity: "users", entityId: user.id, action: "LOGIN_FAILED" });
    }
    throw httpError(401, "Email/mobile or password is incorrect.");
  }

  // NF-43: when the institution enforces two-step sign-in for administrators, an admin account gets the
  // SMS OTP step even if the user never switched it on. Without a mobile number the OTP cannot be sent,
  // so the session is issued with a flag that tells the website to ask for a number / 2FA setup.
  const isAdminAccount = [user.role, ...(Array.isArray(user.roles) ? user.roles : [])].some(isAdminRoleName);
  const adminMust2fa = Boolean(policy.enforce_admin_two_factor) && isAdminAccount;
  if (user.two_factor_enabled || (adminMust2fa && user.phone)) {
    const devCode = await sendOtp(user, "login");
    const challenge = jwt.sign({ sub: user.id, purpose: "2fa" }, env.jwtSecret, { expiresIn: "5m" });
    return res.json({ success: true, data: { requiresOtp: true, challenge, maskedPhone: user.phone ? `***${user.phone.slice(-3)}` : null, devCode } });
  }

  const session = await issueSession(req, user);
  res.json({ success: true, data: adminMust2fa ? { ...session, twoFactorSetupRequired: true } : session });
}));

router.post("/verify-otp", otpLimiter, asyncHandler(async (req, res) => {
  const { challenge, code } = req.body || {};
  let payload;
  try { payload = jwt.verify(String(challenge || ""), env.jwtSecret); } catch { throw httpError(401, "OTP session expired. Sign in again."); }
  if (payload.purpose !== "2fa") throw httpError(401, "OTP session expired. Sign in again.");
  const user = (await query("SELECT * FROM users WHERE id = $1", [payload.sub])).rows[0];
  if (!user || !user.otp_hash || !user.otp_expires_at || new Date(user.otp_expires_at) < new Date()) {
    throw httpError(401, "OTP expired. Request a new code.");
  }
  if (!(await bcrypt.compare(String(code || ""), user.otp_hash))) throw httpError(401, "Incorrect OTP.");
  await query("UPDATE users SET otp_hash = NULL, otp_expires_at = NULL, otp_sent_count = 0 WHERE id = $1", [user.id]);
  res.json({ success: true, data: await issueSession(req, user, "otp") });
}));

// Guardian / staff OTP login by mobile number (GA-01, GDX-03).
router.post("/otp/request", otpLimiter, asyncHandler(async (req, res) => {
  const mobile = normalizeMobile(req.body?.mobile);
  if (mobile.length < 10) throw httpError(422, "A valid mobile number is required.");
  const user = (await query("SELECT * FROM users WHERE phone = $1 AND status = 'Active'", [mobile])).rows[0];
  // Same response whether or not the account exists (prevents enumeration).
  let devCode;
  let challenge = jwt.sign({ sub: null, purpose: "otp-login" }, env.jwtSecret, { expiresIn: "5m" });
  if (user) {
    if (Number(user.otp_sent_count || 0) >= 5 && user.otp_expires_at && new Date(user.otp_expires_at) > new Date()) {
      throw httpError(429, "OTP resend limit reached. Please wait a few minutes.");
    }
    devCode = await sendOtp(user, "login");
    challenge = jwt.sign({ sub: user.id, purpose: "otp-login" }, env.jwtSecret, { expiresIn: "5m" });
  }
  res.json({ success: true, data: { challenge, message: "If the number is registered, an OTP has been sent.", devCode } });
}));

router.post("/otp/verify", otpLimiter, asyncHandler(async (req, res) => {
  const { challenge, code } = req.body || {};
  let payload;
  try { payload = jwt.verify(String(challenge || ""), env.jwtSecret); } catch { throw httpError(401, "OTP session expired."); }
  if (payload.purpose !== "otp-login") throw httpError(401, "OTP session expired.");
  if (!payload.sub) throw httpError(401, "Incorrect OTP.");
  const user = (await query("SELECT * FROM users WHERE id = $1 AND status = 'Active'", [payload.sub])).rows[0];
  if (!user || !user.otp_hash || new Date(user.otp_expires_at) < new Date()) throw httpError(401, "OTP expired.");
  if (!(await bcrypt.compare(String(code || ""), user.otp_hash))) throw httpError(401, "Incorrect OTP.");
  await query("UPDATE users SET otp_hash = NULL, otp_expires_at = NULL, otp_sent_count = 0 WHERE id = $1", [user.id]);
  res.json({ success: true, data: await issueSession(req, user) });
}));

// Secure password reset (RP-09, NFR-13): token is single use and expires in 30 minutes.
router.post("/password/forgot", otpLimiter, asyncHandler(async (req, res) => {
  const user = await findUser(req.body?.identifier || req.body?.email);
  let devToken;
  if (user && user.status === "Active") {
    const token = crypto.randomBytes(24).toString("hex");
    const hash = crypto.createHash("sha256").update(token).digest("hex");
    await query("INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, NOW() + INTERVAL '30 minutes')", [user.id, hash]);
    const link = `${env.publicAppUrl}/reset-password?token=${token}`;
    // Requests from the AeroSchool Guardian app also get a deep link that opens the in-app
    // reset screen (Workflow §6); the website link stays as the fallback.
    const appLink = req.body?.client === "app" ? `aeroschool://reset-password?token=${token}` : null;
    if (user.email && !user.email.endsWith(".local")) {
      const body = appLink
        ? `Reset your password (valid 30 minutes).\n\nOn your phone with the AeroSchool Guardian app: ${appLink}\nIn a browser: ${link}`
        : `Reset your password using this link (valid 30 minutes): ${link}`;
      await queueMessage({ channel: "Email", eventType: "PasswordReset", recipient: user.email, recipientType: "User", recipientId: user.id, subject: "Password reset", body });
    }
    if (user.phone) {
      await queueMessage({ channel: "SMS", eventType: "PasswordReset", recipient: user.phone, recipientType: "User", recipientId: user.id, body: `Password reset link (30 min): ${appLink || link}` });
    }
    processQueue().catch(() => {});
    if (env.nodeEnv === "development" && !env.sms.apiUrl && !env.email.host) devToken = token;
  }
  res.json({ success: true, message: "If the account exists, reset instructions have been sent.", data: { devToken } });
}));

router.post("/password/reset", asyncHandler(async (req, res) => {
  const { token, password } = req.body || {};
  if (!password || String(password).length < 8) throw httpError(422, "Password must be at least 8 characters.");
  const hash = crypto.createHash("sha256").update(String(token || "")).digest("hex");
  const row = (await query(
    "SELECT * FROM password_reset_tokens WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()",
    [hash],
  )).rows[0];
  if (!row) throw httpError(400, "Reset link is invalid or has expired.");
  await query("UPDATE users SET password_hash = $1, token_version = token_version + 1, failed_attempts = 0, locked_until = NULL, must_change_password = FALSE, password_changed_at = NOW() WHERE id = $2",
    [await bcrypt.hash(String(password), 12), row.user_id]);
  await query("UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1", [row.id]);
  await writeAudit({ ...req, user: { id: row.user_id } }, { entity: "users", entityId: row.user_id, action: "PASSWORD_RESET" });
  res.json({ success: true, message: "Password updated. Please sign in." });
}));

router.get("/me", authenticate, asyncHandler(async (req, res) => {
  const user = (await query(
    `SELECT id, name, email, phone, role, roles, status, scope, linked_type, linked_id, two_factor_enabled,
            preferred_language, last_login_at, created_at, must_change_password FROM users WHERE id = $1`,
    [req.user.id],
  )).rows[0];
  if (!user) throw httpError(404, "User not found.");
  res.json({
    success: true,
    data: keysToCamel({
      ...user,
      roles: req.user.roles,
      isAdmin: req.user.isAdmin,
      matrix: req.user.matrix,
      canViewSensitive: req.user.canViewSensitive,
      permissions: req.user.isAdmin ? ["All Modules"] : [],
    }),
  });
}));

router.post("/change-password", authenticate, asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!newPassword || String(newPassword).length < 8) throw httpError(422, "New password must be at least 8 characters.");
  const user = (await query("SELECT * FROM users WHERE id = $1", [req.user.id])).rows[0];
  if (!(await bcrypt.compare(String(currentPassword || ""), user.password_hash))) throw httpError(401, "Current password is incorrect.");
  if (await bcrypt.compare(String(newPassword), user.password_hash)) throw httpError(422, "New password must be different from the current password.");
  await query(
    "UPDATE users SET password_hash = $1, token_version = token_version + 1, must_change_password = FALSE, password_changed_at = NOW() WHERE id = $2",
    [await bcrypt.hash(String(newPassword), 12), user.id],
  );
  await writeAudit(req, { entity: "users", entityId: user.id, action: "PASSWORD_CHANGE" });
  res.json({ success: true, message: "Password changed. Please sign in again." });
}));

// Sign-out on this device: the session (and its token) stops working immediately.
router.post("/logout", authenticate, asyncHandler(async (req, res) => {
  if (req.user.sessionId) {
    await query("UPDATE user_sessions SET revoked_at = NOW() WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL", [req.user.sessionId, req.user.id]);
  }
  await writeAudit(req, { entity: "user_sessions", entityId: req.user.sessionId || req.user.id, action: "LOGOUT" });
  res.json({ success: true });
}));

// Ends every active session of the current user.
router.post("/logout-all", authenticate, asyncHandler(async (req, res) => {
  await query("UPDATE users SET token_version = token_version + 1 WHERE id = $1", [req.user.id]);
  await query("UPDATE user_sessions SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL", [req.user.id]);
  await writeAudit(req, { entity: "users", entityId: req.user.id, action: "LOGOUT_ALL" });
  res.json({ success: true });
}));

router.patch("/preferences", authenticate, asyncHandler(async (req, res) => {
  const lang = req.body?.preferredLanguage;
  if (lang && !["bn", "en"].includes(lang)) throw httpError(422, "Language must be bn or en.");
  if (lang) await query("UPDATE users SET preferred_language = $1 WHERE id = $2", [lang, req.user.id]);
  if (typeof req.body?.twoFactorEnabled === "boolean") {
    await query("UPDATE users SET two_factor_enabled = $1 WHERE id = $2", [req.body.twoFactorEnabled, req.user.id]);
  }
  res.json({ success: true });
}));

// ---------------------------------------------------------------- devices & PIN (GA-01, GA-05)
router.get("/sessions", authenticate, asyncHandler(async (req, res) => {
  const rows = (await query(
    "SELECT id, user_agent, ip, method, created_at, last_seen_at FROM user_sessions WHERE user_id = $1 AND revoked_at IS NULL ORDER BY last_seen_at DESC LIMIT 50",
    [req.user.id],
  )).rows.map((r) => ({ ...r, current: r.id === req.user.sessionId }));
  res.json({ success: true, data: keysToCamel(rows) });
}));

router.delete("/sessions/:id", authenticate, asyncHandler(async (req, res) => {
  const result = await query("UPDATE user_sessions SET revoked_at = NOW() WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL RETURNING id", [req.params.id, req.user.id]);
  if (!result.rowCount) throw httpError(404, "Session not found.");
  await writeAudit(req, { entity: "user_sessions", entityId: req.params.id, action: "DEVICE_LOGOUT" });
  res.json({ success: true });
}));

// Quick re-login with a 4-digit PIN on a device after OTP/password sign-in (GA-01).
router.post("/pin", authenticate, asyncHandler(async (req, res) => {
  const pin = String(req.body?.pin || "");
  if (!/^\d{4,6}$/.test(pin)) throw httpError(422, "PIN must be 4 to 6 digits.");
  await query("UPDATE users SET pin_hash = $1 WHERE id = $2", [await bcrypt.hash(pin, 10), req.user.id]);
  await writeAudit(req, { entity: "users", entityId: req.user.id, action: "PIN_SET" });
  res.json({ success: true, message: "PIN saved." });
}));

router.delete("/pin", authenticate, asyncHandler(async (req, res) => {
  await query("UPDATE users SET pin_hash = NULL WHERE id = $1", [req.user.id]);
  res.json({ success: true });
}));

router.post("/pin/login", loginLimiter, asyncHandler(async (req, res) => {
  const user = await findUser(req.body?.identifier || req.body?.mobile || "");
  if (user?.locked_until && new Date(user.locked_until) > new Date()) {
    throw httpError(423, "Account temporarily locked after repeated failed attempts. Try again later.");
  }
  if (!user || user.status !== "Active" || !user.pin_hash || !(await bcrypt.compare(String(req.body?.pin || ""), user.pin_hash))) {
    if (user) {
      const policy = await settings();
      const attempts = Number(user.failed_attempts || 0) + 1;
      const max = Number(policy.max_login_attempts || 5);
      await query(
        `UPDATE users SET failed_attempts = $1::int,
           locked_until = CASE WHEN $1::int >= $2::int THEN NOW() + INTERVAL '15 minutes' ELSE locked_until END WHERE id = $3`,
        [attempts >= max ? 0 : attempts, max, user.id],
      );
    }
    throw httpError(401, "Mobile/email or PIN is incorrect.");
  }
  res.json({ success: true, data: await issueSession(req, user, "pin") });
}));

router.get("/permission-catalog", authenticate, (req, res) => {
  res.json({ success: true, data: { modules: MODULES, actions: ACTIONS } });
});

module.exports = router;
