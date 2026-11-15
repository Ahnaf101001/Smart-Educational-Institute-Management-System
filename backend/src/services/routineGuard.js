// Class routine clash validation (SRS AC-08): the same teacher or room cannot be
// booked in two places for the same day + period.
const { query } = require("../db/pool");
const httpError = require("../utils/httpError");

async function assertNoClash(entry, excludeId = null) {
  if (entry.is_break) return;
  const checks = [];
  if (entry.teacher_id) checks.push(["teacher_id", entry.teacher_id, "Teacher"]);
  if (entry.room_no) checks.push(["room_no", entry.room_no, "Room"]);

  for (const [column, value, label] of checks) {
    const result = await query(
      `SELECT r.*, c.name AS class_name FROM routine_entries r
       LEFT JOIN classes c ON c.id = r.class_id
       WHERE r.${column} = $1 AND r.day_of_week = $2 AND r.period_code = $3
         AND NOT r.is_break AND ($4::uuid IS NULL OR r.id <> $4::uuid)
         AND NOT (r.class_id = $5 AND r.section = $6)`,
      [value, entry.day_of_week, entry.period_code, excludeId, entry.class_id, entry.section],
    );
    if (result.rowCount) {
      const clash = result.rows[0];
      throw httpError(409, `${label} clash: already assigned to ${clash.class_name || clash.class_id}-${clash.section} on ${entry.day_of_week} (${entry.period_code}).`);
    }
  }
}

module.exports = { assertNoClash };
