const path = require("node:path");
const dotenv = require("dotenv");

// Load backend/.env regardless of the directory the process was started from;
// a .env in the current directory (if any) takes precedence.
dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

function required(name, fallback) {
  const value = process.env[name] || fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

module.exports = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 4000),
  databaseUrl: required("DATABASE_URL"),
  databaseSsl: process.env.DATABASE_SSL === "true",
  jwtSecret: required("JWT_SECRET", "development-only-change-me"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  corsOrigins: (process.env.CORS_ORIGIN || "http://localhost:3000")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  adminEmail: process.env.ADMIN_EMAIL || "admin@school.edu",
  adminPassword: process.env.ADMIN_PASSWORD || "Admin@123",
  appName: process.env.APP_NAME || "Smart Educational Institute Management System",
  publicAppUrl: process.env.PUBLIC_APP_URL || "http://localhost:3000",
  uploadDir: process.env.UPLOAD_DIR || "uploads",
  maxUploadMb: Number(process.env.MAX_UPLOAD_MB || 5),
  workerEnabled: process.env.WORKER_ENABLED !== "false",
  backupDir: process.env.BACKUP_DIR || "backups",
  sms: {
    apiUrl: process.env.SMS_API_URL || "",
    apiKey: process.env.SMS_API_KEY || "",
    senderId: process.env.SMS_SENDER_ID || "",
  },
  whatsapp: {
    apiBase: process.env.WHATSAPP_API_BASE || "https://graph.facebook.com/v19.0",
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || "",
    token: process.env.WHATSAPP_TOKEN || "",
  },
  // AES-256-GCM key for sensitive fields at rest (NID). 32+ characters; changing it makes old values unreadable.
  dataEncryptionKey: process.env.DATA_ENCRYPTION_KEY || "",
  push: {
    fcmServerKey: process.env.FCM_SERVER_KEY || "",
  },
  payment: {
    callbackSecret: process.env.PAYMENT_CALLBACK_SECRET || "",
    bkashBaseUrl: (process.env.BKASH_BASE_URL || "").replace(/\/$/, ""),
    bkashAppKey: process.env.BKASH_APP_KEY || "",
    bkashAppSecret: process.env.BKASH_APP_SECRET || "",
    bkashUsername: process.env.BKASH_USERNAME || "",
    bkashPassword: process.env.BKASH_PASSWORD || "",
    nagadMerchantId: process.env.NAGAD_MERCHANT_ID || "",
    nagadMerchantNumber: process.env.NAGAD_MERCHANT_NUMBER || "",
    nagadPublicKey: process.env.NAGAD_PUBLIC_KEY || "",
    nagadMerchantPrivateKey: process.env.NAGAD_MERCHANT_PRIVATE_KEY || "",
    serverIp: process.env.SERVER_PUBLIC_IP || "",
    nagadBaseUrl: (process.env.NAGAD_BASE_URL || "").replace(/\/$/, ""),
    sslcommerzStoreId: process.env.SSLCOMMERZ_STORE_ID || "",
    sslcommerzStorePassword: process.env.SSLCOMMERZ_STORE_PASSWORD || "",
    sslcommerzSandbox: process.env.SSLCOMMERZ_SANDBOX !== "false",
  },
  deviceSharedKey: process.env.DEVICE_SHARED_KEY || "",
  gpsSharedKey: process.env.GPS_SHARED_KEY || "",
  email: {
    host: process.env.EMAIL_HOST || "",
    port: Number(process.env.EMAIL_PORT || 587),
    secure: process.env.EMAIL_SECURE === "true",
    user: process.env.EMAIL_USER || "",
    pass: process.env.EMAIL_PASS || "",
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER || "",
  },
};
