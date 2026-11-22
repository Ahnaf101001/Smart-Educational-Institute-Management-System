// Verifies the SMTP settings used for guardian credentials and password-reset emails.
// Usage: npm run check:smtp            (connects and authenticates only)
//        npm run check:smtp -- you@example.com   (also sends a test email)
require("dotenv").config();
const nodemailer = require("nodemailer");
const env = require("../src/config/env");

(async () => {
  const { host, port, secure, user, pass, from } = env.email;
  const missing = Object.entries({ EMAIL_HOST: host, EMAIL_USER: user, EMAIL_PASS: pass, EMAIL_FROM: from }).filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) {
    console.error(`SMTP is not configured. Missing: ${missing.join(", ")} (see backend/.env.example).`);
    process.exit(1);
  }
  const transport = nodemailer.createTransport({ host, port, secure, auth: { user, pass } });
  try {
    await transport.verify();
    console.log(`SMTP OK: authenticated to ${host}:${port} as ${user}.`);
    const to = process.argv[2];
    if (to) {
      const info = await transport.sendMail({ from, to, subject: "AeroSchool SMTP test", text: "SMTP is working. Guardian credentials and password-reset emails can be delivered." });
      console.log(`Test email sent to ${to} (${info.messageId}).`);
    }
  } catch (error) {
    console.error(`SMTP check failed: ${error.message}`);
    process.exit(1);
  }
})();
