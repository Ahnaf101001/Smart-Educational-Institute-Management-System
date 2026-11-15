const nodemailer = require("nodemailer");
const env = require("../config/env");
const httpError = require("../utils/httpError");

function isConfigured() {
  return Boolean(env.email.host && env.email.user && env.email.pass && env.email.from);
}

function createTransporter() {
  if (!isConfigured()) {
    throw httpError(503, "Email service is not configured. Please set EMAIL_HOST, EMAIL_USER, EMAIL_PASS, and EMAIL_FROM.");
  }

  return nodemailer.createTransport({
    host: env.email.host,
    port: env.email.port,
    secure: env.email.secure,
    auth: {
      user: env.email.user,
      pass: env.email.pass,
    },
  });
}

async function sendEmail({ to, subject, text }) {
  const recipients = Array.from(new Set((to || []).filter(Boolean)));
  if (!recipients.length) {
    throw httpError(422, "No recipient email addresses found.");
  }

  const transporter = createTransporter();
  const info = await transporter.sendMail({
    from: env.email.from,
    to: recipients,
    subject,
    text,
  });

  return {
    messageId: info.messageId,
    accepted: info.accepted || [],
    rejected: info.rejected || [],
  };
}

module.exports = { sendEmail, isConfigured };
