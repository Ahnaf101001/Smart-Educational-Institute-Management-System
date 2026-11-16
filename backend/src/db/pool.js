const { Pool, types } = require("pg");
const env = require("../config/env");
const { getTimezone, setTimezone } = require("../utils/dates");

// Return DATE columns as plain "YYYY-MM-DD" strings. By default pg turns them into a JS Date at
// local midnight, which serialises as the previous day in UTC ("2012-05-06T18:00:00Z" for 7 May)
// and shifted dates by one day when a form cut the first 10 characters and saved them back.
types.setTypeParser(1082, (value) => value);

const pool = new Pool({
  connectionString: env.databaseUrl,
  ssl: env.databaseSsl ? { rejectUnauthorized: false } : false,
  connectionTimeoutMillis: 10_000,
  idleTimeoutMillis: 30_000,
  // Each session runs in the institution's time zone so CURRENT_DATE, ::date and day grouping
  // follow the local calendar (the database server itself runs in UTC).
  options: `-c TimeZone=${getTimezone()}`,
});

// Switch the time zone used for "today" in JS and for new database sessions.
// Idle connections opened with the previous zone are recycled within idleTimeoutMillis.
function useTimezone(tz) {
  const zone = setTimezone(tz);
  pool.options.options = `-c TimeZone=${zone}`;
  return zone;
}

pool.on("error", (error) => {
  console.error("Unexpected PostgreSQL pool error", error);
});

async function query(text, params) {
  return pool.query(text, params);
}

async function transaction(callback) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { pool, query, transaction, useTimezone };
