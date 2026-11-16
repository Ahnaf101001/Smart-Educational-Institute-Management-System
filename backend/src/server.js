const app = require("./app");
const env = require("./config/env");
const { pool, query, useTimezone } = require("./db/pool");
const { ensureSystemData } = require("./services/bootstrap");
const { startWorker } = require("./services/worker");

// Keep the API alive if the database restarts or a background job rejects;
// errors are logged and the pool reconnects on the next query.
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection:", reason?.message || reason);
});
process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error?.message || error);
  if (error?.code === "EADDRINUSE") process.exit(1);
});

async function start() {
  try {
    await ensureSystemData();
  } catch (error) {
    console.error("System data bootstrap failed (run `npm run db:migrate` first):", error.message);
  }
  try {
    const tz = (await query("SELECT timezone FROM system_settings WHERE id = 1")).rows[0]?.timezone;
    useTimezone(tz);
  } catch {
    // keep the default time zone (Asia/Dhaka) when settings are not available yet
  }
  const server = app.listen(env.port, () => {
    console.log(`${env.appName} API running at http://localhost:${env.port}`);
  });
  if (env.workerEnabled) startWorker();

  async function shutdown(signal) {
    console.log(`${signal} received. Shutting down gracefully...`);
    server.close(async () => {
      await pool.end();
      process.exit(0);
    });
  }
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  return server;
}

module.exports = start();
