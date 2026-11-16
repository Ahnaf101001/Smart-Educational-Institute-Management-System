// Calendar dates in the institution's time zone (system_settings.timezone, default Asia/Dhaka).
// `new Date().toISOString().slice(0, 10)` gives the UTC date, which is yesterday's date in
// Bangladesh between midnight and 6 am. Use these helpers for "today" / "this month".
const DEFAULT_TZ = process.env.APP_TIMEZONE || "Asia/Dhaka";
let zone = isValidTimezone(DEFAULT_TZ) ? DEFAULT_TZ : "Asia/Dhaka";

function isValidTimezone(tz) {
  if (!tz || typeof tz !== "string") return false;
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function setTimezone(tz) {
  if (isValidTimezone(tz)) zone = tz;
  return zone;
}

function getTimezone() {
  return zone;
}

// YYYY-MM-DD for the given instant in the institution's time zone.
function localDate(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  return new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

// YYYY-MM for the given instant in the institution's time zone.
function localMonth(date = new Date()) {
  return localDate(date).slice(0, 7);
}

// Day of month (1-31) in the institution's time zone.
function localDay(date = new Date()) {
  return Number(localDate(date).slice(8, 10));
}

function localParts(date = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: zone, hourCycle: "h23", hour: "2-digit", minute: "2-digit", weekday: "short",
  }).formatToParts(date).map((p) => [p.type, p.value]));
  return { hour: Number(parts.hour), minute: Number(parts.minute), weekday: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday) };
}

// Hour of day (0-23) in the institution's time zone.
function localHour(date = new Date()) {
  return localParts(date).hour;
}

// Minutes since local midnight in the institution's time zone.
function localMinutes(date = new Date()) {
  const p = localParts(date);
  return p.hour * 60 + p.minute;
}

// Day of week (0 = Sunday) in the institution's time zone.
function localWeekday(date = new Date()) {
  return localParts(date).weekday;
}

// Calendar arithmetic on YYYY-MM-DD strings, independent of any time zone.
function addDays(ymd, days) {
  const [y, m, d] = String(ymd).slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

function lastDayOfMonth(ym) {
  const [y, m] = String(ym).slice(0, 7).split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

module.exports = {
  isValidTimezone, setTimezone, getTimezone, localDate, localMonth, localDay, localHour, localMinutes, localWeekday,
  addDays, lastDayOfMonth,
};
