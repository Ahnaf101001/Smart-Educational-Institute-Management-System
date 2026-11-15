// Minimal in-memory fixed-window rate limiter (NFR-13 login rate limit,
// brute-force protection, OTP resend limit). Suitable for a single instance.
// skipSuccessful: requests that end with a status below 400 are not counted,
// so only failed attempts use up the allowance.
const httpError = require("../utils/httpError");

function rateLimit({ windowMs = 60_000, max = 10, key = (req) => req.ip, message = "Too many requests. Please try again later.", skipSuccessful = false } = {}) {
  const hits = new Map();
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (v.reset <= now) hits.delete(k);
  }, windowMs).unref();

  return function limiter(req, res, next) {
    const k = key(req);
    const now = Date.now();
    let entry = hits.get(k);
    if (!entry || entry.reset <= now) {
      entry = { count: 0, reset: now + windowMs };
      hits.set(k, entry);
    }
    entry.count += 1;
    if (entry.count > max) {
      res.setHeader("Retry-After", Math.ceil((entry.reset - now) / 1000));
      return next(httpError(429, message));
    }
    if (skipSuccessful) {
      const counted = entry;
      res.on("finish", () => { if (res.statusCode < 400 && counted.count > 0) counted.count -= 1; });
    }
    next();
  };
}

module.exports = rateLimit;
