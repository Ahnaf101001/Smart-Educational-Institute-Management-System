// Idempotent system data: default roles, grading templates, fee heads, leave
// types, message templates, chart of accounts and the 10 ID card templates.
const { query, transaction } = require("../db/pool");
const { DEFAULT_ROLES, LEGACY_ROLE_MATRIX, allModules } = require("./permissions");
const { GRADE_TEMPLATES } = require("./grading");
const { TEMPLATES } = require("../data/idCardTemplates");
const { PRESETS } = require("../data/presets");
const httpError = require("../utils/httpError");

const MESSAGE_TEMPLATES = [
  ["absent", "Absence alert", "SMS", "bn", "{student} আজ ({date}) প্রতিষ্ঠানে অনুপস্থিত। - {institute}"],
  ["absent", "Absence alert", "SMS", "en", "{student} was absent today ({date}). - {institute}"],
  ["late", "Late arrival", "SMS", "bn", "{student} আজ ({date}) দেরিতে উপস্থিত হয়েছে। - {institute}"],
  ["late", "Late arrival", "SMS", "en", "{student} arrived late today ({date}). - {institute}"],
  ["entry", "Entry alert", "SMS", "bn", "{student} {time} এ প্রতিষ্ঠানে প্রবেশ করেছে। - {institute}"],
  ["exit", "Exit alert", "SMS", "bn", "{student} {time} এ প্রতিষ্ঠান থেকে বের হয়েছে। - {institute}"],
  ["entry", "Entry alert", "SMS", "en", "{student} entered the campus at {time}. - {institute}"],
  ["exit", "Exit alert", "SMS", "en", "{student} left the campus at {time}. - {institute}"],
  ["result", "Result published", "SMS", "bn", "{exam} এর ফলাফল প্রকাশিত হয়েছে। {student}: GPA {gpa}, গ্রেড {grade}। - {institute}"],
  ["result", "Result published", "SMS", "en", "{exam} result published. {student}: GPA {gpa}, Grade {grade}. - {institute}"],
  ["fee_reminder", "Fee reminder", "SMS", "bn", "{student} এর বকেয়া ফি ৳{due}। অনুগ্রহ করে {date} এর মধ্যে পরিশোধ করুন। - {institute}"],
  ["fee_reminder", "Fee reminder", "SMS", "en", "Dues for {student}: BDT {due}. Please pay by {date}. - {institute}"],
  ["payment", "Payment receipt", "SMS", "bn", "৳{amount} পরিশোধ সম্পন্ন। রসিদ নং {receipt}। ধন্যবাদ। - {institute}"],
  ["payment", "Payment receipt", "SMS", "en", "Payment of BDT {amount} received. Receipt {receipt}. Thank you. - {institute}"],
  ["admission", "Admission confirmed", "SMS", "bn", "অভিনন্দন! {student} এর ভর্তি নিশ্চিত হয়েছে। আইডি: {studentId}। - {institute}"],
  ["admission", "Admission confirmed", "SMS", "en", "Congratulations! Admission of {student} is confirmed. ID: {studentId}. - {institute}"],
  ["emergency", "Emergency alert", "SMS", "bn", "জরুরি নোটিশ: {message} - {institute}"],
  ["emergency", "Emergency alert", "SMS", "en", "EMERGENCY: {message} - {institute}"],
  ["otp", "Login OTP", "SMS", "en", "Your login code is {code}. It expires in 5 minutes. Do not share it."],
];

const ACCOUNT_HEADS = [
  ["1000", "Cash in Hand", "Asset"], ["1010", "Bank Accounts", "Asset"], ["1100", "Fees Receivable", "Asset"],
  ["2000", "Security Deposits (Refundable)", "Liability"], ["2100", "Advance Fees Received", "Liability"],
  ["3000", "Capital / General Fund", "Equity"],
  ["4000", "Tuition Fee Income", "Income"], ["4010", "Admission Fee Income", "Income"], ["4020", "Exam Fee Income", "Income"],
  ["4030", "Transport Fee Income", "Income"], ["4040", "Donation Income", "Income"], ["4090", "Other Income", "Income"],
  ["5000", "Salaries & Allowances", "Expense"], ["5010", "Utilities", "Expense"], ["5020", "Maintenance & Repairs", "Expense"],
  ["5030", "Stationery & Printing", "Expense"], ["5040", "Transport Expense", "Expense"], ["5050", "Events & Programs", "Expense"],
  ["5060", "Fee Refunds & Reversals", "Expense"], ["5090", "Miscellaneous Expense", "Expense"],
];

async function ensureRoles(client) {
  for (const role of DEFAULT_ROLES) {
    await client.query(
      `INSERT INTO roles (name, color, description, matrix, can_view_sensitive, is_system, permissions)
       VALUES ($1, $2, $3, $4, $5, TRUE, '[]'::jsonb)
       ON CONFLICT (name) DO UPDATE SET
         matrix = CASE WHEN roles.matrix = '{}'::jsonb THEN EXCLUDED.matrix ELSE roles.matrix END,
         description = COALESCE(roles.description, EXCLUDED.description),
         is_system = TRUE`,
      [role.name, role.color, role.description, JSON.stringify(role.matrix), Boolean(role.canViewSensitive)],
    );
  }
  for (const [name, matrix] of Object.entries(LEGACY_ROLE_MATRIX)) {
    await client.query(
      "UPDATE roles SET matrix = $1 WHERE LOWER(name) = $2 AND matrix = '{}'::jsonb",
      [JSON.stringify(matrix), name],
    );
  }
  await client.query("UPDATE roles SET matrix = $1, can_view_sensitive = TRUE WHERE LOWER(name) = 'super admin'", [JSON.stringify(allModules())]);
}

async function ensureGradeScales(client) {
  for (const [key, t] of Object.entries(GRADE_TEMPLATES)) {
    await client.query(
      `INSERT INTO grade_scales (name, template_key, institution_type, scale_type, bands, max_point, fail_grade, fourth_subject_threshold)
       SELECT $1::text, $2::text, $3::text, $4::text, $5::jsonb, $6::numeric, $7::text, $8::numeric
       WHERE NOT EXISTS (SELECT 1 FROM grade_scales WHERE template_key = $2::text)`,
      [t.name, key, t.institutionType, t.scaleType, JSON.stringify(t.bands), t.maxPoint, t.failGrade, t.fourthSubjectThreshold],
    );
  }
  const def = await client.query("SELECT 1 FROM grade_scales WHERE is_default");
  if (!def.rowCount) await client.query("UPDATE grade_scales SET is_default = TRUE WHERE template_key = 'nctb_gpa5'");
}

async function ensureCardTemplates(client) {
  for (const t of TEMPLATES) {
    const exists = await client.query("SELECT id FROM id_card_templates WHERE template_key = $1 AND is_system", [t.templateKey]);
    if (exists.rowCount) continue;
    const hasDefault = await client.query("SELECT 1 FROM id_card_templates WHERE audience = $1 AND is_default", [t.audience]);
    const inserted = await client.query(
      `INSERT INTO id_card_templates (template_key, name, audience, category, description, orientation, width_mm, height_mm,
         front_config, back_config, version, status, is_default, is_system)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,1,'Published',$11,TRUE) RETURNING id`,
      [t.templateKey, t.name, t.audience, t.category, t.description, t.orientation, t.widthMm, t.heightMm,
        JSON.stringify(t.front), JSON.stringify(t.back), Boolean(t.isDefault && !hasDefault.rowCount)],
    );
    await client.query(
      `INSERT INTO id_card_template_versions (template_id, version, orientation, width_mm, height_mm, front_config, back_config)
       VALUES ($1, 1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING`,
      [inserted.rows[0].id, t.orientation, t.widthMm, t.heightMm, JSON.stringify(t.front), JSON.stringify(t.back)],
    );
  }
  // Staff use the teacher defaults unless the school chooses otherwise.
}

async function ensureLookups(client) {
  const heads = await client.query("SELECT COUNT(*)::int AS n FROM fee_heads");
  if (!heads.rows[0].n) {
    for (const [name, category, refundable] of [
      ["Admission Fee", "Admission", false], ["Session Fee", "Session", false], ["Tuition Fee", "Tuition", false],
      ["Exam Fee", "Exam", false], ["Library Fee", "Library", false], ["Transport Fee", "Transport", false],
      ["Development Fee", "Development", false], ["Late Fine", "Fine", false],
      ["Security Deposit (Refundable)", "Deposit", true], ["Others", "Others", false],
    ]) {
      await client.query("INSERT INTO fee_heads (name, category, is_refundable) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING", [name, category, refundable]);
    }
  }
  const leaves = await client.query("SELECT COUNT(*)::int AS n FROM leave_types");
  if (!leaves.rows[0].n) {
    for (const [name, applies, days, paid] of [
      ["Casual Leave", "Staff", 10, true], ["Sick Leave", "Staff", 14, true], ["Earned Leave", "Staff", 15, true],
      ["Maternity Leave", "Staff", 120, true], ["Leave Without Pay", "Staff", 0, false],
      ["Sick Leave", "Student", 0, true], ["Family Emergency", "Student", 0, true], ["Other", "Student", 0, true],
    ]) {
      await client.query("INSERT INTO leave_types (name, applies_to, days_per_year, is_paid) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING", [name, applies, days, paid]);
    }
  }
  for (const [key, name, channel, lang, body] of MESSAGE_TEMPLATES) {
    await client.query(
      `INSERT INTO message_templates (template_key, name, channel, language, body)
       VALUES ($1,$2,$3,$4,$5) ON CONFLICT (template_key, channel, language) DO NOTHING`,
      [key, name, channel, lang, body],
    );
  }
  const accounts = await client.query("SELECT COUNT(*)::int AS n FROM account_heads");
  if (!accounts.rows[0].n) {
    for (const [code, name, type] of ACCOUNT_HEADS) {
      await client.query("INSERT INTO account_heads (code, name, type) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING", [code, name, type]);
    }
  }
  const shifts = await client.query("SELECT COUNT(*)::int AS n FROM shifts");
  if (!shifts.rows[0].n) {
    await client.query("INSERT INTO shifts (name, start_time, end_time) VALUES ('Morning','07:30','12:00'), ('Day','12:30','17:00') ON CONFLICT DO NOTHING");
  }
  const groups = await client.query("SELECT COUNT(*)::int AS n FROM student_groups");
  if (!groups.rows[0].n) {
    await client.query("INSERT INTO student_groups (name, applicable_classes) VALUES ('Science','9-12'), ('Humanities','9-12'), ('Business Studies','9-12') ON CONFLICT DO NOTHING");
  }
  await client.query(`UPDATE users SET roles = '["School Admin"]'::jsonb WHERE id = 'USR-1' AND roles = '[]'::jsonb`);
}

async function ensureSystemData() {
  await transaction(async (client) => {
    await ensureRoles(client);
    await ensureGradeScales(client);
    await ensureCardTemplates(client);
    await ensureLookups(client);
  });
}

// Applies an institution-type preset (SRS v1 PC-14 / PC-05 / RP-05).
async function applyPreset(type, { replaceRoleNames = true } = {}) {
  const preset = PRESETS[type];
  if (!preset) throw httpError(422, `Unknown institution type: ${type}`);

  return transaction(async (client) => {
    const scale = await client.query("SELECT id FROM grade_scales WHERE template_key = $1", [preset.gradeTemplate]);
    const scaleId = scale.rows[0]?.id || null;
    let classesCreated = 0;
    let subjectsCreated = 0;

    const orderBase = (await client.query("SELECT COALESCE(MAX(sort_order),0)::int AS m FROM classes")).rows[0].m;
    const classIds = [];
    for (const [index, cls] of preset.classes.entries()) {
      const existing = await client.query("SELECT id FROM classes WHERE name = $1", [cls.name]);
      let id = existing.rows[0]?.id;
      if (!id) {
        const inserted = await client.query(
          `INSERT INTO classes (name, level, sections, institution_type, sort_order, grade_scale_id, has_groups)
           VALUES ($1, $2, '["A"]'::jsonb, $3, $4, $5, $6) RETURNING id`,
          [cls.name, cls.level || null, type, orderBase + index + 1, scaleId, Boolean(cls.hasGroups)],
        );
        id = inserted.rows[0].id;
        classesCreated += 1;
      }
      classIds.push({ id, hasGroups: Boolean(cls.hasGroups) });
    }

    const subjectIds = [];
    for (const s of preset.subjects) {
      const existing = await client.query("SELECT id FROM subjects WHERE code = $1", [s.code]);
      let id = existing.rows[0]?.id;
      if (!id) {
        const inserted = await client.query(
          `INSERT INTO subjects (name, name_bn, name_ar, code, type, full_marks, pass_marks, components, is_optional,
             is_religious, group_name, kitab_name, institution_type, status)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'Active') RETURNING id`,
          [s.name, s.nameBn || null, s.nameAr || null, s.code, s.optional ? "Optional" : "Compulsory",
            s.fullMarks || 100, s.passMarks ?? 33, JSON.stringify(s.components || []), Boolean(s.optional),
            Boolean(s.isReligious), s.group || null, s.kitab || null, type],
        );
        id = inserted.rows[0].id;
        subjectsCreated += 1;
      }
      subjectIds.push({ id, group: s.group || "", optional: Boolean(s.optional) });
    }

    // Map subjects to classes: grouped subjects only to classes that have groups.
    for (const cls of classIds) {
      for (const [i, sub] of subjectIds.entries()) {
        if (sub.group && !cls.hasGroups) continue;
        await client.query(
          `INSERT INTO class_subjects (class_id, subject_id, group_name, is_compulsory, is_fourth_subject_eligible, sort_order)
           VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (class_id, subject_id, group_name) DO NOTHING`,
          [cls.id, sub.id, sub.group, !sub.optional, sub.optional, i],
        );
      }
    }

    for (const head of preset.feeHeads) {
      await client.query(
        "INSERT INTO fee_heads (name, category, is_refundable) VALUES ($1, $2, $3) ON CONFLICT (name) DO NOTHING",
        [head, head.replace(/ Fee$/, ""), /Refundable/i.test(head)],
      );
    }
    for (const group of preset.groups || []) {
      await client.query("INSERT INTO student_groups (name) VALUES ($1) ON CONFLICT (name) DO NOTHING", [group]);
    }

    if (replaceRoleNames) {
      for (const [roleName, display] of Object.entries(preset.roleNames || {})) {
        await client.query("UPDATE roles SET display_name = $1 WHERE name = $2", [display, roleName]);
      }
    }

    const profile = (await client.query("SELECT institution_types FROM institute_profile WHERE id = 1")).rows[0];
    const types = new Set(Array.isArray(profile?.institution_types) ? profile.institution_types : []);
    types.add(type);
    await client.query(
      "UPDATE institute_profile SET institution_types = $1, primary_type = COALESCE(NULLIF(primary_type, ''), $2) WHERE id = 1",
      [JSON.stringify([...types]), type],
    );
    if (preset.modules?.length) {
      const s = (await client.query("SELECT enabled_modules FROM system_settings WHERE id = 1")).rows[0];
      const mods = new Set(Array.isArray(s?.enabled_modules) ? s.enabled_modules : []);
      preset.modules.forEach((m) => mods.add(m));
      await client.query("UPDATE system_settings SET enabled_modules = $1 WHERE id = 1", [JSON.stringify([...mods])]);
    }
    if (preset.calendar) {
      await client.query("UPDATE system_settings SET calendar_type = $1 WHERE id = 1", [preset.calendar]);
    }

    return { type, classesCreated, subjectsCreated, gradeScaleId: scaleId };
  });
}

module.exports = { ensureSystemData, applyPreset, MESSAGE_TEMPLATES };
