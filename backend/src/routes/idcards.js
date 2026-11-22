const express = require("express");
const crypto = require("node:crypto");
const { query, transaction } = require("../db/pool");
const asyncHandler = require("../utils/asyncHandler");
const httpError = require("../utils/httpError");
const { keysToCamel } = require("../utils/case");
const { requirePermission, hasPermission } = require("../middleware/auth");
const { writeAudit } = require("../services/audit");
const { createApproval } = require("../services/approvals");
const { TEMPLATES } = require("../data/idCardTemplates");
const { localDate } = require("../utils/dates");

const router = express.Router();
const HOLDER_TABLE = { Student: "students", Teacher: "teachers", Staff: "staff" };
const REQUIRED_FIELDS = {
  Student: [["name", "Name"], ["class_name", "Class"], ["roll", "Roll"]],
  Teacher: [["name", "Name"], ["designation", "Designation"]],
  Staff: [["name", "Name"], ["designation", "Designation"]],
};

function holderTable(type) {
  const t = HOLDER_TABLE[type];
  if (!t) throw httpError(422, "Holder type must be Student, Teacher or Staff.");
  return t;
}

async function publishedVersion(executor, template) {
  const v = (await executor.query(
    "SELECT * FROM id_card_template_versions WHERE template_id = $1 AND version = $2",
    [template.id, template.version],
  )).rows[0];
  if (v) return v;
  return {
    version: template.version, orientation: template.orientation, width_mm: template.width_mm, height_mm: template.height_mm,
    front_config: template.front_config, back_config: template.back_config,
  };
}

// ---------------------------------------------------------------- templates (IDC-01..15)
router.get("/templates", requirePermission("idcards", "view"), asyncHandler(async (req, res) => {
  const rows = (await query(
    `SELECT t.*, (SELECT COUNT(*)::int FROM id_cards c WHERE c.template_id = t.id) AS cards_issued
     FROM id_card_templates t
     WHERE ($1::text IS NULL OR t.audience = $1 OR ($1 = 'Staff' AND t.audience = 'Teacher'))
       AND ($2::text IS NULL OR t.category = $2) AND t.status <> 'Archived'
       AND ($3::text IS NULL OR t.name ILIKE '%' || $3 || '%' OR t.description ILIKE '%' || $3 || '%')
     ORDER BY t.audience, t.is_default DESC, t.is_system DESC, t.created_at`,
    [req.query.audience || null, req.query.category || null, req.query.search || null],
  )).rows;
  res.json({ success: true, data: keysToCamel(rows) });
}));

router.get("/templates/:id", requirePermission("idcards", "view"), asyncHandler(async (req, res) => {
  const t = (await query("SELECT * FROM id_card_templates WHERE id = $1", [req.params.id])).rows[0];
  if (!t) throw httpError(404, "Template not found.");
  const versions = (await query("SELECT id, version, published_by, created_at FROM id_card_template_versions WHERE template_id = $1 ORDER BY version DESC", [t.id])).rows;
  const live = await publishedVersion({ query }, t);
  res.json({ success: true, data: keysToCamel({ ...t, versions, published: live }) });
}));

// Customise a copy of any template (IDC-07..14).
router.post("/templates/:id/duplicate", requirePermission("idcards", "create"), asyncHandler(async (req, res) => {
  const t = (await query("SELECT * FROM id_card_templates WHERE id = $1", [req.params.id])).rows[0];
  if (!t) throw httpError(404, "Template not found.");
  const row = (await query(
    `INSERT INTO id_card_templates (template_key, name, audience, category, description, orientation, width_mm, height_mm,
       front_config, back_config, version, status, is_default, is_system, base_template_id, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,1,'Draft',FALSE,FALSE,$11,$12) RETURNING *`,
    [`${t.template_key}-custom-${Date.now().toString(36)}`, req.body?.name || `${t.name} (Custom)`, req.body?.audience || t.audience,
      t.category, t.description, t.orientation, t.width_mm, t.height_mm, JSON.stringify(t.front_config), JSON.stringify(t.back_config), t.id, req.user.name],
  )).rows[0];
  await writeAudit(req, { entity: "id_card_templates", entityId: row.id, action: "DUPLICATE", newValue: { from: t.id } });
  res.status(201).json({ success: true, data: keysToCamel(row) });
}));

// Save draft (working copy). Printing keeps using the last published version (IDC-14/15).
router.patch("/templates/:id", requirePermission("idcards", "edit"), asyncHandler(async (req, res) => {
  const t = (await query("SELECT * FROM id_card_templates WHERE id = $1", [req.params.id])).rows[0];
  if (!t) throw httpError(404, "Template not found.");
  const b = req.body || {};
  const width = b.widthMm !== undefined ? Number(b.widthMm) : Number(t.width_mm);
  const height = b.heightMm !== undefined ? Number(b.heightMm) : Number(t.height_mm);
  if (width < 30 || width > 210 || height < 30 || height > 297) throw httpError(422, "Card size must be between 30 mm and A4.");
  const row = (await query(
    `UPDATE id_card_templates SET name = COALESCE($1, name), description = COALESCE($2, description), category = COALESCE($3, category),
       orientation = COALESCE($4, orientation), width_mm = $5, height_mm = $6,
       front_config = COALESCE($7, front_config), back_config = COALESCE($8, back_config),
       status = CASE WHEN status = 'Archived' THEN status ELSE 'Draft' END
     WHERE id = $9 RETURNING *`,
    [b.name || null, b.description || null, b.category || null, b.orientation || null, width, height,
      b.frontConfig ? JSON.stringify(b.frontConfig) : null, b.backConfig ? JSON.stringify(b.backConfig) : null, t.id],
  )).rows[0];
  await writeAudit(req, { entity: "id_card_templates", entityId: t.id, action: "SAVE_DRAFT" });
  res.json({ success: true, data: keysToCamel(row) });
}));

router.post("/templates/:id/publish", requirePermission("idcards", "edit"), asyncHandler(async (req, res) => {
  const row = await transaction(async (client) => {
    const t = (await client.query("SELECT * FROM id_card_templates WHERE id = $1 FOR UPDATE", [req.params.id])).rows[0];
    if (!t) throw httpError(404, "Template not found.");
    const last = (await client.query("SELECT * FROM id_card_template_versions WHERE template_id = $1 ORDER BY version DESC LIMIT 1", [t.id])).rows[0];
    const unchanged = last && JSON.stringify(last.front_config) === JSON.stringify(t.front_config)
      && JSON.stringify(last.back_config) === JSON.stringify(t.back_config) && Number(last.width_mm) === Number(t.width_mm)
      && Number(last.height_mm) === Number(t.height_mm) && last.orientation === t.orientation;
    const version = unchanged ? last.version : (last ? last.version + 1 : 1);
    if (!unchanged) {
      await client.query(
        `INSERT INTO id_card_template_versions (template_id, version, orientation, width_mm, height_mm, front_config, back_config, published_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [t.id, version, t.orientation, t.width_mm, t.height_mm, JSON.stringify(t.front_config), JSON.stringify(t.back_config), req.user.name],
      );
    }
    const updated = (await client.query("UPDATE id_card_templates SET status = 'Published', version = $1 WHERE id = $2 RETURNING *", [version, t.id])).rows[0];
    await writeAudit(req, { entity: "id_card_templates", entityId: t.id, action: "PUBLISH", newValue: { version } }, client);
    return updated;
  });
  res.json({ success: true, data: keysToCamel(row) });
}));

router.post("/templates/:id/default", requirePermission("idcards", "edit"), asyncHandler(async (req, res) => {
  const row = await transaction(async (client) => {
    const t = (await client.query("SELECT * FROM id_card_templates WHERE id = $1", [req.params.id])).rows[0];
    if (!t) throw httpError(404, "Template not found.");
    if (t.status !== "Published") throw httpError(409, "Publish the template before making it the default.");
    await client.query("UPDATE id_card_templates SET is_default = FALSE WHERE audience = $1 AND is_default", [t.audience]);
    const updated = (await client.query("UPDATE id_card_templates SET is_default = TRUE WHERE id = $1 RETURNING *", [t.id])).rows[0];
    await writeAudit(req, { entity: "id_card_templates", entityId: t.id, action: "SET_DEFAULT" }, client);
    return updated;
  });
  res.json({ success: true, data: keysToCamel(row) });
}));

router.post("/templates/:id/reset", requirePermission("idcards", "edit"), asyncHandler(async (req, res) => {
  const t = (await query("SELECT * FROM id_card_templates WHERE id = $1", [req.params.id])).rows[0];
  if (!t) throw httpError(404, "Template not found.");
  const key = t.is_system ? t.template_key : (await query("SELECT template_key FROM id_card_templates WHERE id = $1", [t.base_template_id])).rows[0]?.template_key;
  const def = TEMPLATES.find((x) => x.templateKey === key);
  if (!def) throw httpError(409, "No original design is available for this template.");
  const row = (await query(
    `UPDATE id_card_templates SET orientation = $1, width_mm = $2, height_mm = $3, front_config = $4, back_config = $5, status = 'Draft' WHERE id = $6 RETURNING *`,
    [def.orientation, def.widthMm, def.heightMm, JSON.stringify(def.front), JSON.stringify(def.back), t.id],
  )).rows[0];
  res.json({ success: true, data: keysToCamel(row) });
}));

router.delete("/templates/:id", requirePermission("idcards", "delete"), asyncHandler(async (req, res) => {
  const t = (await query("SELECT * FROM id_card_templates WHERE id = $1", [req.params.id])).rows[0];
  if (!t) throw httpError(404, "Template not found.");
  if (t.is_system) throw httpError(409, "Built-in templates cannot be removed.");
  if (t.is_default) throw httpError(409, "Choose another default template first.");
  await query("UPDATE id_card_templates SET status = 'Archived' WHERE id = $1", [t.id]);
  await writeAudit(req, { entity: "id_card_templates", entityId: t.id, action: "ARCHIVE" });
  res.status(204).send();
}));

// ---------------------------------------------------------------- holders & validation (IDC-16..19)
async function loadHolders(executor, type, { ids, classId, section, shift, status, search, rollFrom, rollTo } = {}) {
  const table = holderTable(type);
  const values = [];
  const conds = [];
  if (ids?.length) { values.push(ids); conds.push(`h.id = ANY($${values.length})`); }
  if (type === "Student") {
    if (classId) { values.push(classId); conds.push(`h.class_id = $${values.length}`); }
    if (section) { values.push(section); conds.push(`h.section = $${values.length}`); }
    if (shift) { values.push(shift); conds.push(`h.shift = $${values.length}`); }
    if (rollFrom) { values.push(Number(rollFrom)); conds.push(`NULLIF(regexp_replace(COALESCE(h.roll,''), '\\D', '', 'g'), '')::int >= $${values.length}`); }
    if (rollTo) { values.push(Number(rollTo)); conds.push(`NULLIF(regexp_replace(COALESCE(h.roll,''), '\\D', '', 'g'), '')::int <= $${values.length}`); }
  }
  values.push(status || "Active");
  conds.push(`h.status = $${values.length}`);
  if (search) { values.push(`%${search}%`); conds.push(`(h.name ILIKE $${values.length} OR h.id ILIKE $${values.length})`); }
  const select = type === "Student"
    ? `h.*, ay.name AS session_name, (SELECT g.mobile FROM guardian_students gs JOIN guardians g ON g.id = gs.guardian_id WHERE gs.student_id = h.id AND gs.is_primary LIMIT 1) AS guardian_mobile`
    : "h.*";
  const join = type === "Student"
    ? "LEFT JOIN academic_years ay ON ay.id = COALESCE(h.academic_year_id, (SELECT id FROM academic_years WHERE is_current LIMIT 1))"
    : "";
  return (await executor.query(
    `SELECT ${select}, c.card_number AS active_card_number, c.id AS active_card_id, c.issue_date AS active_card_issued
     FROM ${table} h ${join}
     LEFT JOIN id_cards c ON c.holder_type = '${type}' AND c.holder_id = h.id AND c.status = 'Active'
     WHERE ${conds.join(" AND ")}
     ORDER BY ${type === "Student" ? "h.class_name, NULLIF(regexp_replace(COALESCE(h.roll,''), '\\D', '', 'g'), '')::int NULLS LAST," : ""} h.name`,
    values,
  )).rows;
}

function snapshotFor(type, h) {
  if (type === "Student") {
    return {
      id: h.id, name: h.name, nameBn: h.name_bn, nameAr: h.name_ar, photoUrl: h.photo_url, className: String(h.class_name || "").split("-")[0],
      section: h.section, roll: h.roll, session: h.session_name, shift: h.shift, group: h.group_name,
      dob: h.date_of_birth, bloodGroup: h.blood_group, guardianPhone: h.guardian_mobile || h.parent_contact,
    };
  }
  return {
    id: h.id, name: h.name, nameBn: h.name_bn, photoUrl: h.photo_url, designation: h.designation, department: h.department,
    bloodGroup: h.blood_group, phone: h.phone, email: h.email, joinDate: h.join_date, employeeType: h.employee_type,
  };
}

function validateHolders(type, holders, frontConfig = {}) {
  const missingPhoto = [];
  const missingFields = [];
  const warnings = [];
  const duplicates = [];
  const fields = frontConfig.fields || {};
  for (const h of holders) {
    if (fields.photo !== false && !h.photo_url) missingPhoto.push({ id: h.id, name: h.name, className: h.class_name });
    // Required identity fields block generation; optional fields shown on the card only warn.
    const missing = REQUIRED_FIELDS[type].filter(([f]) => !h[f]).map(([, label]) => label);
    if (missing.length) missingFields.push({ id: h.id, name: h.name, missing });
    const optional = [];
    if (fields.bloodGroup && !h.blood_group) optional.push("Blood group");
    if (type === "Student" && fields.guardianPhone && !(h.guardian_mobile || h.parent_contact)) optional.push("Guardian phone");
    if (type === "Student" && fields.dob && !h.date_of_birth) optional.push("Date of birth");
    if (type !== "Student" && fields.phone && !h.phone) optional.push("Phone");
    if (optional.length) warnings.push({ id: h.id, name: h.name, missing: optional });
    if (h.active_card_id) duplicates.push({ id: h.id, name: h.name, cardNumber: h.active_card_number });
  }
  return { total: holders.length, missingPhoto, missingFields, warnings, duplicates };
}

router.get("/holders", requirePermission("idcards", "view"), asyncHandler(async (req, res) => {
  const type = req.query.holderType || "Student";
  const holders = await loadHolders({ query }, type, req.query);
  res.json({
    success: true,
    data: keysToCamel(holders.map((h) => ({
      id: h.id, name: h.name, nameBn: h.name_bn, className: h.class_name, section: h.section, roll: h.roll, designation: h.designation,
      department: h.department, photoUrl: h.photo_url, bloodGroup: h.blood_group, status: h.status,
      activeCardNumber: h.active_card_number, activeCardIssued: h.active_card_issued,
      snapshot: snapshotFor(type, h),
    }))),
  });
}));

router.post("/validate", requirePermission("idcards", "view"), asyncHandler(async (req, res) => {
  const { holderType = "Student", holderIds, filters = {}, templateId } = req.body || {};
  const template = templateId ? (await query("SELECT * FROM id_card_templates WHERE id = $1", [templateId])).rows[0] : null;
  const holders = await loadHolders({ query }, holderType, { ...filters, ids: holderIds });
  res.json({ success: true, data: keysToCamel(validateHolders(holderType, holders, template?.front_config)) });
}));

async function nextCardNumber(client, type) {
  const s = (await client.query("SELECT card_number_prefix, staff_card_number_prefix FROM system_settings WHERE id = 1")).rows[0] || {};
  const prefix = type === "Student" ? s.card_number_prefix || "SC" : s.staff_card_number_prefix || "EC";
  const seq = (await client.query("SELECT nextval('card_number_seq') AS n")).rows[0].n;
  return `${prefix}-${localDate().slice(2, 4)}-${String(seq).padStart(6, "0")}`;
}

async function issueCard(client, req, { type, holder, template, version, settings, replacedCardId = null, placeholder = false, cardVersion = 1 }) {
  const validUntil = new Date();
  validUntil.setMonth(validUntil.getMonth() + Number(settings.card_validity_months || 12));
  const card = (await client.query(
    `INSERT INTO id_cards (holder_type, holder_id, holder_name, template_id, template_version, card_number, qr_token, card_version,
       academic_year_id, valid_until, used_placeholder_photo, snapshot, issued_by, replaced_card_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
    [type, holder.id, holder.name, template.id, version.version, await nextCardNumber(client, type), crypto.randomBytes(16).toString("hex"),
      cardVersion, holder.academic_year_id || null, localDate(validUntil), placeholder,
      JSON.stringify(snapshotFor(type, holder)), req.user.name, replacedCardId],
  )).rows[0];
  // Register the QR token as a credential so gate/mobile scans map to this person.
  await client.query(
    `INSERT INTO biometric_enrollments (person_type, person_id, credential_type, credential_value)
     VALUES ($1,$2,'QR',$3) ON CONFLICT (credential_type, credential_value) DO NOTHING`,
    [type, holder.id, card.qr_token],
  );
  return card;
}

async function createPrintJob(client, req, { type, jobType, cards, template, version, filters, reason, settings }) {
  const needsApproval = settings.card_print_requires_approval && !hasPermission(req.user, "idcards", "approve");
  const job = (await client.query(
    `INSERT INTO id_card_print_jobs (holder_type, job_type, filters, card_ids, card_count, template_id, template_name, template_version, status, reason, created_by, created_by_name)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
    [type, jobType, JSON.stringify(filters || {}), JSON.stringify(cards.map((c) => c.id)), cards.length, template.id, template.name,
      version.version, needsApproval ? "Failed" : "Queued", reason || null, req.user.id, req.user.name],
  )).rows[0];
  if (needsApproval) {
    await client.query("UPDATE id_card_print_jobs SET error = 'Awaiting print approval' WHERE id = $1", [job.id]);
    await createApproval(req, {
      type: "id_card_print", title: `Print ${cards.length} ${type} ID card(s) – ${template.name}`, referenceTable: "id_card_print_jobs",
      referenceId: job.id, payload: { jobId: job.id },
    }, client);
  }
  return { ...job, needsApproval };
}

// Generate cards (IDC-16..19, IDC-21, business rules §7.4).
router.post("/generate", requirePermission("idcards", "create"), asyncHandler(async (req, res) => {
  const { holderType = "Student", holderIds, filters = {}, templateId, allowPlaceholder = false, reissue = false, layout } = req.body || {};
  if (allowPlaceholder && !hasPermission(req.user, "idcards", "approve") && !req.user.isAdmin) {
    throw httpError(403, "Only an approver/admin can override missing photos with a placeholder.");
  }
  const result = await transaction(async (client) => {
    const settings = (await client.query("SELECT * FROM system_settings WHERE id = 1")).rows[0] || {};
    const template = templateId
      ? (await client.query("SELECT * FROM id_card_templates WHERE id = $1", [templateId])).rows[0]
      : (await client.query("SELECT * FROM id_card_templates WHERE (audience = $1 OR ($1 = 'Staff' AND audience = 'Teacher')) AND is_default ORDER BY audience = $1 DESC LIMIT 1", [holderType])).rows[0];
    if (!template) throw httpError(422, "Select a template (or set a default template) first.");
    if (template.status === "Archived") throw httpError(409, "This template is archived.");
    const version = await publishedVersion(client, template);
    if (template.status === "Draft" && !(await client.query("SELECT 1 FROM id_card_template_versions WHERE template_id = $1", [template.id])).rowCount) {
      throw httpError(409, "Publish the template before generating cards.");
    }
    const holders = await loadHolders(client, holderType, { ...filters, ids: holderIds });
    if (!holders.length) throw httpError(422, "No matching holders for the selected filters.");
    const report = validateHolders(holderType, holders, version.front_config);
    const blocking = report.missingFields.length || (report.missingPhoto.length && !allowPlaceholder);
    if (blocking) {
      // §7.4: stop bulk generation and show the list – never print silent blank cards.
      throw httpError(422, "Validation failed: fix missing photos/fields or use an authorised placeholder override.", report);
    }

    const cards = [];
    const skipped = [];
    for (const h of holders) {
      if (h.active_card_id && !reissue) {
        skipped.push({ id: h.id, name: h.name, reason: `Active card ${h.active_card_number} exists` });
        continue;
      }
      let replacedId = null;
      let cardVersion = 1;
      if (h.active_card_id) {
        const old = (await client.query("UPDATE id_cards SET status = 'Replaced', block_reason = 'Re-issued (new session/template)' WHERE id = $1 RETURNING *", [h.active_card_id])).rows[0];
        replacedId = old.id;
        cardVersion = Number(old.card_version) + 1;
      }
      cards.push(await issueCard(client, req, { type: holderType, holder: h, template, version, settings, replacedCardId: replacedId, placeholder: !h.photo_url, cardVersion }));
    }
    if (!cards.length) return { cards: [], skipped, job: null, report };
    const job = await createPrintJob(client, req, { type: holderType, jobType: cards.length === 1 ? "Single" : "Bulk", cards, template, version, filters: { ...filters, layout }, settings });
    if (report.missingPhoto.length && allowPlaceholder) {
      await writeAudit(req, { entity: "id_cards", entityId: job.id, action: "PLACEHOLDER_OVERRIDE", newValue: report.missingPhoto }, client);
    }
    await writeAudit(req, { entity: "id_cards", entityId: job.id, action: "GENERATE", newValue: { count: cards.length, template: template.id, version: version.version } }, client);
    return { cards, skipped, job, report };
  });
  res.status(201).json({ success: true, data: keysToCamel(result) });
}));

router.get("/cards", requirePermission("idcards", "view"), asyncHandler(async (req, res) => {
  const rows = (await query(
    `SELECT c.*, t.name AS template_name FROM id_cards c LEFT JOIN id_card_templates t ON t.id = c.template_id
     WHERE ($1::text IS NULL OR c.holder_type = $1) AND ($2::text IS NULL OR c.status = $2)
       AND ($3::text IS NULL OR c.holder_name ILIKE '%' || $3 || '%' OR c.holder_id ILIKE '%' || $3 || '%' OR c.card_number ILIKE '%' || $3 || '%')
       AND ($4::text IS NULL OR c.holder_id = $4)
     ORDER BY c.created_at DESC LIMIT 1000`,
    [req.query.holderType || null, req.query.status || null, req.query.search || null, req.query.holderId || null],
  )).rows;
  res.json({ success: true, data: keysToCamel(rows) });
}));

router.post("/cards/:id/block", requirePermission("idcards", "edit"), asyncHandler(async (req, res) => {
  const reason = String(req.body?.reason || "").trim();
  if (!reason) throw httpError(422, "A reason is required.");
  const row = (await query("UPDATE id_cards SET status = 'Blocked', block_reason = $1 WHERE id = $2 AND status = 'Active' RETURNING *", [reason, req.params.id])).rows[0];
  if (!row) throw httpError(404, "Active card not found.");
  await query("UPDATE biometric_enrollments SET status = 'Inactive' WHERE credential_type = 'QR' AND credential_value = $1", [row.qr_token]);
  await writeAudit(req, { entity: "id_cards", entityId: row.id, action: "BLOCK", reason });
  res.json({ success: true, data: keysToCamel(row) });
}));

// Lost/damaged replacement (IDC-24): old card Blocked → new card Active (new number/version).
router.post("/cards/:id/replace", requirePermission("idcards", "create"), asyncHandler(async (req, res) => {
  const reason = String(req.body?.reason || "").trim();
  if (!reason) throw httpError(422, "Replacement reason is required.");
  const result = await transaction(async (client) => {
    const settings = (await client.query("SELECT * FROM system_settings WHERE id = 1")).rows[0] || {};
    const old = (await client.query("SELECT * FROM id_cards WHERE id = $1 FOR UPDATE", [req.params.id])).rows[0];
    if (!old) throw httpError(404, "Card not found.");
    if (old.status === "Replaced") throw httpError(409, "This card was already replaced.");
    await client.query("UPDATE id_cards SET status = 'Blocked', block_reason = $1 WHERE id = $2", [`Replaced: ${reason}`, old.id]);
    await client.query("UPDATE biometric_enrollments SET status = 'Inactive' WHERE credential_type = 'QR' AND credential_value = $1", [old.qr_token]);
    const template = (await client.query("SELECT * FROM id_card_templates WHERE id = $1", [req.body?.templateId || old.template_id])).rows[0];
    if (!template) throw httpError(422, "Template not found.");
    const version = await publishedVersion(client, template);
    const [holder] = await loadHolders(client, old.holder_type, { ids: [old.holder_id], status: req.body?.holderStatus || "Active" });
    if (!holder) throw httpError(409, "Holder is not active; cannot issue a replacement.");
    const card = await issueCard(client, req, { type: old.holder_type, holder, template, version, settings, replacedCardId: old.id, placeholder: !holder.photo_url, cardVersion: Number(old.card_version) + 1 });
    const job = await createPrintJob(client, req, { type: old.holder_type, jobType: "Replacement", cards: [card], template, version, reason, settings });
    if (req.body?.chargeFee && Number(req.body?.feeAmount) > 0 && old.holder_type === "Student") {
      await client.query(
        "INSERT INTO fee_invoices (student_id, billing_month, due_date, amount, status, fee_head, notes) VALUES ($1, date_trunc('month', CURRENT_DATE)::date, CURRENT_DATE + 7, $2, 'Due', 'ID Card Replacement', $3)",
        [old.holder_id, Number(req.body.feeAmount), `Replacement for ${old.card_number}`],
      );
    }
    await writeAudit(req, { entity: "id_cards", entityId: old.id, action: "REPLACE", oldValue: { card: old.card_number }, newValue: { card: card.card_number }, reason }, client);
    return { oldCard: { ...old, status: "Blocked" }, card, job };
  });
  res.status(201).json({ success: true, data: keysToCamel(result) });
}));

// Reprint (IDC-23): reason + operator recorded; optional invalidation of the previous card.
router.post("/reprint", requirePermission("idcards", "print"), asyncHandler(async (req, res) => {
  const { cardIds = [], reason, invalidatePrevious = false } = req.body || {};
  if (!cardIds.length) throw httpError(422, "Select cards to reprint.");
  if (!String(reason || "").trim()) throw httpError(422, "A reprint reason is required.");
  const result = await transaction(async (client) => {
    const settings = (await client.query("SELECT * FROM system_settings WHERE id = 1")).rows[0] || {};
    const cards = (await client.query("SELECT * FROM id_cards WHERE id::text = ANY($1) AND status = 'Active'", [cardIds])).rows;
    if (!cards.length) throw httpError(404, "No active cards found.");
    const template = (await client.query("SELECT * FROM id_card_templates WHERE id = $1", [cards[0].template_id])).rows[0];
    let jobCards = cards;
    if (invalidatePrevious) {
      jobCards = [];
      for (const old of cards) {
        await client.query("UPDATE id_cards SET status = 'Blocked', block_reason = $1 WHERE id = $2", [`Reprint: ${reason}`, old.id]);
        const tpl = (await client.query("SELECT * FROM id_card_templates WHERE id = $1", [old.template_id])).rows[0];
        const version = await publishedVersion(client, tpl);
        const [holder] = await loadHolders(client, old.holder_type, { ids: [old.holder_id] });
        if (holder) jobCards.push(await issueCard(client, req, { type: old.holder_type, holder, template: tpl, version, settings, replacedCardId: old.id, cardVersion: Number(old.card_version) + 1 }));
      }
    }
    const version = { version: jobCards[0]?.template_version || template.version };
    const job = await createPrintJob(client, req, { type: cards[0].holder_type, jobType: "Reprint", cards: jobCards, template, version, reason, settings });
    await writeAudit(req, { entity: "id_cards", entityId: job.id, action: "REPRINT", newValue: { count: jobCards.length, invalidatePrevious }, reason }, client);
    return { job, cards: jobCards };
  });
  res.status(201).json({ success: true, data: keysToCamel(result) });
}));

// Print job payload for rendering: exact template version + card snapshots (IDC-25, NFR-15).
router.get("/print-jobs/:id", requirePermission("idcards", "view"), asyncHandler(async (req, res) => {
  const job = (await query("SELECT * FROM id_card_print_jobs WHERE id = $1", [req.params.id])).rows[0];
  if (!job) throw httpError(404, "Print job not found.");
  const cards = (await query("SELECT * FROM id_cards WHERE id::text = ANY($1) ORDER BY holder_name", [job.card_ids])).rows;
  const template = (await query("SELECT * FROM id_card_templates WHERE id = $1", [job.template_id])).rows[0];
  const version = template ? await publishedVersion({ query }, { ...template, version: job.template_version || template.version }) : null;
  const institute = (await query("SELECT * FROM institute_profile WHERE id = 1")).rows[0];
  // Holder data is refreshed for display, while card number / version stay as issued.
  const ids = cards.map((c) => c.holder_id);
  const fresh = new Map((await loadHolders({ query }, job.holder_type, { ids, status: undefined }).catch(() => [])).map((h) => [h.id, snapshotFor(job.holder_type, h)]));
  res.json({
    success: true,
    data: keysToCamel({
      job, institute,
      template: template ? { ...template, orientation: version.orientation, width_mm: version.width_mm, height_mm: version.height_mm, front_config: version.front_config, back_config: version.back_config, version: version.version } : null,
      cards: cards.map((c) => ({ ...c, data: { ...c.snapshot, ...(fresh.get(c.holder_id) || {}) } })),
    }),
  });
}));

router.patch("/print-jobs/:id/status", requirePermission("idcards", "print"), asyncHandler(async (req, res) => {
  const { status, error, fileName } = req.body || {};
  if (!["Processing", "Ready", "Failed", "Printed"].includes(status)) throw httpError(422, "Invalid print job status.");
  const job = (await query("SELECT * FROM id_card_print_jobs WHERE id = $1", [req.params.id])).rows[0];
  if (!job) throw httpError(404, "Print job not found.");
  if (job.error === "Awaiting print approval") throw httpError(409, "This job is awaiting print approval.");
  const row = (await query(
    `UPDATE id_card_print_jobs SET status = $1, error = $2, file_name = COALESCE($3, file_name),
       completed_at = CASE WHEN $1 IN ('Ready','Printed') THEN NOW() ELSE completed_at END WHERE id = $4 RETURNING *`,
    [status, error || null, fileName || null, req.params.id],
  )).rows[0];
  if (status === "Printed") {
    await query("UPDATE id_cards SET print_count = print_count + 1, last_printed_at = NOW() WHERE id::text = ANY($1)", [job.card_ids]);
  }
  await writeAudit(req, { entity: "id_card_print_jobs", entityId: job.id, action: `STATUS_${status.toUpperCase()}`, reason: error });
  res.json({ success: true, data: keysToCamel(row) });
}));

router.get("/stats", requirePermission("idcards", "view"), asyncHandler(async (req, res) => {
  // Same shape for every holder type: total active, missing photo, without an active card.
  const holderStats = (table, holderType) => query(
    `SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE photo_url IS NULL OR photo_url = '')::int AS missing_photo,
            COUNT(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM id_cards c WHERE c.holder_type = $1 AND c.holder_id = h.id AND c.status = 'Active'))::int AS without_card
     FROM ${table} h WHERE status = 'Active'`,
    [holderType],
  );
  const [cards, students, teachers, staff, jobs] = await Promise.all([
    query("SELECT holder_type, status, COUNT(*)::int AS n FROM id_cards GROUP BY holder_type, status"),
    holderStats("students", "Student"),
    holderStats("teachers", "Teacher"),
    holderStats("staff", "Staff"),
    query("SELECT status, COUNT(*)::int AS n FROM id_card_print_jobs GROUP BY status"),
  ]);
  res.json({
    success: true,
    data: keysToCamel({ cards: cards.rows, students: students.rows[0], teachers: teachers.rows[0], staff: staff.rows[0], jobs: jobs.rows }),
  });
}));

module.exports = router;
