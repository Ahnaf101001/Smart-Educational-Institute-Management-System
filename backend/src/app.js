const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const env = require("./config/env");
const apiRoutes = require("./routes");
const { notFound, errorHandler } = require("./middleware/errorHandler");

const app = express();

app.disable("x-powered-by");
// Only proxies on this machine (Next.js / nginx) may supply X-Forwarded-For; set TRUST_PROXY for other setups.
app.set("trust proxy", process.env.TRUST_PROXY || "loopback");
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({
  origin(origin, callback) {
    if (!origin || env.corsOrigins.includes("*") || env.corsOrigins.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
}));
// Raw body is kept for payment-callback signature verification.
app.use(express.json({
  limit: `${Math.max(2, env.maxUploadMb * 1.4 + 1)}mb`,
  verify: (req, res, buf) => { req.rawBody = buf.toString("utf8"); },
}));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));
// Never log query strings that may carry tokens (NFR-14).
morgan.token("safe-url", (req) => String(req.originalUrl || "").split("?")[0]);
app.use(morgan(env.nodeEnv === "production"
  ? ":remote-addr :method :safe-url :status :res[content-length] - :response-time ms"
  : ":method :safe-url :status :response-time ms"));

app.get("/health", (req, res) => {
  res.json({ success: true, service: env.appName, timestamp: new Date().toISOString() });
});

app.use("/api/v1", apiRoutes);
app.use(notFound);
app.use(errorHandler);

module.exports = app;
