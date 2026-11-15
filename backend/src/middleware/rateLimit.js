// Minimal in-memory fixed-window rate limiter (NFR-13 login rate limit,
// brute-force protection, OTP resend limit). Suitable for a single instance.
const httpError = require("../utils/httpError");

function rateLimit({ windowMs = 60_000, max = 10, key = (req) => req.ip, message = "Too many requests. Please try again later." } = {}) {
  const hits = new Map();
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (v.reset <= now) hits.delete(k);
  }, windowMs).unref();

  return function limiter(req, res, next) {
    const k = key(req);
    const now = Date.now();
    const entry = hits.get(k);
    if (!entry || entry.reset <= now) {
      hits.set(k, { count: 1, reset: now + windowMs });
      return next();
    }
    entry.count += 1;
    if (entry.count > max) {
      res.setHeader("Retry-After", Math.ceil((entry.reset - now) / 1000));
      return next(httpError(429, message));
    }
    next();
  };
}

module.exports = rateLimit;
