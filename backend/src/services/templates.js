// Bangla/English message template rendering (CM-03 / COM-02).
const { query } = require("../db/pool");

let profileCache = { at: 0, name: "" };
async function instituteName() {
  if (Date.now() - profileCache.at < 60_000) return profileCache.name;
  const r = await query("SELECT name FROM institute_profile WHERE id = 1");
  profileCache = { at: Date.now(), name: r.rows[0]?.name || "" };
  return profileCache.name;
}

function fill(text, vars) {
  return String(text || "").replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined && vars[k] !== null ? String(vars[k]) : ""));
}

async function renderTemplate(key, lang = "bn", vars = {}, channel = "SMS") {
  const result = await query(
    `SELECT body FROM message_templates WHERE template_key = $1 AND channel = $2 AND status = 'Active'
     ORDER BY (language = $3) DESC LIMIT 1`,
    [key, channel, lang],
  );
  const body = result.rows[0]?.body || `{institute}: ${key}`;
  return fill(body, { institute: await instituteName(), ...vars });
}

async function defaultLanguage() {
  const r = await query("SELECT language FROM system_settings WHERE id = 1");
  return r.rows[0]?.language || "bn";
}

module.exports = { renderTemplate, fill, instituteName, defaultLanguage };
