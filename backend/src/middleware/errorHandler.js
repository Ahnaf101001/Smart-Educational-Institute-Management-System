function notFound(req, res) {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
}

function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);

  // Database validation errors are the client's input, not server faults.
  const INVALID_INPUT = ["23514", "23502", "22P02", "22007", "22008", "22003", "22001"];
  // Schema validation thrown directly (e.g. schema.parse) is a 422, not a server fault.
  if (error?.name === "ZodError" && !error.status) {
    error.status = 422;
    error.details = error.issues;
    error.message = (error.issues || []).map((i) => `${(i.path || []).join(".") || "value"}: ${i.message}`).join("; ") || "Validation failed.";
  }
  const status =
    error.status ||
    (["23503", "23505"].includes(error.code) ? 409 : INVALID_INPUT.includes(error.code) ? 422 : 500);
  const message =
    error.code === "23505"
      ? "A record with the same unique value already exists."
      : error.code === "23503"
        ? "This record is linked to other data and cannot be changed or deleted."
        : error.code === "23514"
          ? `A value is not allowed${error.constraint ? ` (${String(error.constraint).replace(/_check$/, "").replace(/_/g, " ")})` : ""}.`
          : error.code === "23502"
            ? `${error.column || "A required field"} is required.`
            : INVALID_INPUT.includes(error.code)
              ? `Invalid value: ${error.message}`
              : error.message || "Internal server error";

  // Full stack only for server faults; expected client errors get one short line.
  if (process.env.NODE_ENV !== "test") {
    if (status >= 500) console.error(error);
    else console.warn(`${status} ${req.method} ${req.originalUrl.split("?")[0]} – ${message}`);
  }

  res.status(status).json({
    success: false,
    message,
    // Application error codes (e.g. ACCOUNT_INACTIVE) let clients react; Postgres codes are not exposed.
    ...(typeof error.code === "string" && /^[A-Z][A-Z_]+$/.test(error.code) ? { code: error.code } : {}),
    ...(error.details ? { details: error.details } : {}),
    ...(process.env.NODE_ENV === "development" && status === 500
      ? { stack: error.stack }
      : {}),
  });
}

module.exports = { notFound, errorHandler };
