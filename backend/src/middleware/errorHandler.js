function notFound(req, res) {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
}

function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);

  const status =
    error.status ||
    (["23503", "23505"].includes(error.code) ? 409 : 500);
  const message =
    error.code === "23505"
      ? "A record with the same unique value already exists."
      : error.code === "23503"
        ? "This record is linked to other data and cannot be changed or deleted."
      : error.message || "Internal server error";

  if (process.env.NODE_ENV !== "test") {
    console.error(error);
  }

  res.status(status).json({
    success: false,
    message,
    ...(error.details ? { details: error.details } : {}),
    ...(process.env.NODE_ENV === "development" && status === 500
      ? { stack: error.stack }
      : {}),
  });
}

module.exports = { notFound, errorHandler };
