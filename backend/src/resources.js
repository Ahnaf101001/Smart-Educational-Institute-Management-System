// Generic CRUD resources. Each maps to a permission module (RBAC) and declares
// writable / required / searchable fields. Records holding financial or academic
// history are archived or protected instead of deleted (NFR-07).

const ARCHIVE = { column: "status", value: "Archived", stamp: null };

module.exports = {
  students: {
    table: "students", module: "students", label: "Student",
    search: ["id", "name", "name_bn", "roll", "class_name", "parent_contact", "guardian_name", "birth_cert_no"],
    filters: ["status", "class_name", "class_id", "section", "gender", "shift", "group_name", "branch_id", "academic_year_id"],
    writable: [
      "id", "roll", "name", "name_bn", "name_ar", "gender", "class_name", "class_id", "section", "shift",
      "group_name", "version", "parent_contact", "date_of_birth", "admission_date", "address", "email",
      "phone", "guardian_name", "source_applicant_id", "status", "details", "photo_url", "blood_group",
      "birth_cert_no", "religion", "nationality", "branch_id", "academic_year_id", "previous_school",
      "fourth_subject_id", "rfid_uid", "division", "district", "upazila", "post_office", "allergies", "special_needs",
      "medical_notes",
    ],
    genderColumn: "gender",
    required: ["name"],
    sensitive: ["parent_contact", "birth_cert_no"],
    scopeColumn: { id: "class_id", name: "class_name" },
    softDelete: { column: "status", value: "Archived", stamp: "archived_at" },
    beforeCreate: async (payload) => {
      const { query } = require("./db/pool");
      if (!payload.class_id && payload.class_name) {
        const c = (await query("SELECT id FROM classes WHERE name = $1", [String(payload.class_name).split("-")[0]])).rows[0];
        if (c) payload.class_id = c.id;
      }
      if (!payload.section && payload.class_name && String(payload.class_name).includes("-")) {
        payload.section = String(payload.class_name).split("-").slice(1).join("-");
      }
      if (payload.birth_cert_no) {
        const dup = (await query("SELECT id FROM students WHERE birth_cert_no = $1 AND status <> 'Archived'", [payload.birth_cert_no])).rows[0];
        if (dup) { const e = new Error(`A student with this birth certificate already exists (${dup.id}).`); e.status = 409; throw e; }
      }
      if (payload.roll && payload.class_id) {
        const dup = (await query(
          `SELECT id FROM students WHERE status = 'Active' AND class_id = $1 AND COALESCE(section,'') = COALESCE($2,'')
             AND COALESCE(shift,'') = COALESCE($3,'') AND roll = $4`,
          [payload.class_id, payload.section || null, payload.shift || null, String(payload.roll)],
        )).rows[0];
        if (dup) { const e = new Error(`Roll ${payload.roll} is already assigned to ${dup.id} in this class/section.`); e.status = 409; throw e; }
      }
    },
    beforeUpdate: async (payload, old) => {
      const { query } = require("./db/pool");
      const next = { ...old, ...payload };
      if (payload.roll !== undefined && next.roll && next.class_id) {
        const dup = (await query(
          `SELECT id FROM students WHERE status = 'Active' AND id <> $5 AND class_id = $1 AND COALESCE(section,'') = COALESCE($2,'')
             AND COALESCE(shift,'') = COALESCE($3,'') AND roll = $4`,
          [next.class_id, next.section || null, next.shift || null, String(next.roll), old.id],
        )).rows[0];
        if (dup) { const e = new Error(`Roll ${next.roll} is already assigned to ${dup.id}.`); e.status = 409; throw e; }
      }
    },
    // Enrollment + guardian link + duplicate roll prevention (ST-02/04, GD-02/03).
    afterCreate: async (row) => {
      const { query } = require("./db/pool");
      const svc = require("./services/students");
      const exec = { query };
      await svc.upsertEnrollment(exec, row).catch((e) => console.error("Enrollment sync failed:", e.message));
      if (row.parent_contact) {
        const g = await svc.upsertGuardian(exec, { name: row.guardian_name, mobile: row.parent_contact, relation: row.details?.guardianRelation || "Father" });
        if (g) await svc.linkGuardian(exec, { guardianId: g.guardian.id, studentId: row.id, relation: row.details?.guardianRelation || "Father", isPrimary: true });
      }
    },
    afterUpdate: async (row, old, req) => {
      const { query } = require("./db/pool");
      if (row.status !== old.status) {
        await query("INSERT INTO student_status_history (student_id, from_status, to_status, reason, changed_by) VALUES ($1,$2,$3,$4,$5)",
          [row.id, old.status, row.status, req.body?.reason || null, req.user?.name || null]);
      }
      if (row.roll !== old.roll || row.class_id !== old.class_id || row.section !== old.section) {
        await require("./services/students").upsertEnrollment({ query }, row).catch((e) => console.error("Enrollment sync failed:", e.message));
      }
    },
  },
  admissions: {
    table: "admissions", module: "admission", label: "Application",
    search: ["id", "name", "class_name", "birth_cert_no", "guardian_mobile"],
    filters: ["status", "class_name", "gender", "circular_id", "source", "payment_status"],
    writable: [
      "id", "initials", "name", "gender", "class_name", "application_date", "status", "details", "student_id",
      "circular_id", "birth_cert_no", "guardian_mobile", "date_of_birth", "source", "test_marks",
      "test_attendance", "merit_position", "admit_card_no", "payment_status", "payment_ref", "payment_amount",
      "override_reason",
    ],
    required: ["name"],
  },
  admissionCirculars: {
    table: "admission_circulars", module: "admission", label: "Admission circular",
    search: ["id", "title", "class_name"], filters: ["status", "academic_year_id", "class_name"],
    writable: ["title", "academic_year_id", "class_name", "seats", "admission_fee", "application_fee", "eligibility",
      "required_documents", "start_date", "deadline", "test_required", "test_date", "test_venue", "selection_method",
      "status", "description"],
    required: ["title", "class_name"],
  },
  guardians: {
    table: "guardians", module: "guardians", label: "Guardian",
    search: ["id", "name", "name_bn", "mobile", "email"], filters: ["status", "relation_default", "portal_access"],
    encrypted: ["nid"],
    writable: ["name", "name_bn", "relation_default", "mobile", "alt_mobile", "email", "nid", "occupation",
      "income_range", "address", "emergency_contact", "photo_url", "portal_access", "status", "notification_prefs"],
    required: ["name", "mobile"],
    sensitive: ["mobile", "alt_mobile", "nid", "email"],
  },
  guardianStudents: {
    table: "guardian_students", module: "guardians", label: "Guardian link",
    search: ["guardian_id", "student_id", "relation"], filters: ["guardian_id", "student_id", "is_primary", "access_status"],
    writable: ["guardian_id", "student_id", "relation", "is_primary", "access_status", "receives_notifications"],
    required: ["guardian_id", "student_id"],
  },
  enrollments: {
    table: "enrollments", module: "students", label: "Enrollment",
    search: ["student_id", "class_name", "section", "roll"], filters: ["student_id", "academic_year_id", "class_id", "section", "status"],
    writable: ["student_id", "academic_year_id", "session_name", "class_id", "class_name", "section", "shift",
      "group_name", "roll", "status", "effective_date", "result_summary"],
    required: ["student_id"], noDelete: true,
  },
  studentDocuments: {
    table: "student_documents", module: "students", label: "Document",
    search: ["owner_id", "document_type", "file_name"], filters: ["owner_type", "owner_id", "document_type"],
    writable: ["owner_type", "owner_id", "document_type", "file_name", "file_url", "mime_type", "size_bytes", "uploaded_by"],
    required: ["owner_id", "document_type", "file_url"],
  },
  studentStatusHistory: {
    table: "student_status_history", module: "students", label: "Status history",
    search: ["student_id", "to_status"], filters: ["student_id"], writable: [], required: [], noDelete: true,
  },
  certificates: {
    table: "certificates", module: "certificates", label: "Certificate",
    search: ["id", "holder_id", "holder_name", "certificate_type"], filters: ["certificate_type", "holder_type", "holder_id", "status"],
    writable: ["certificate_type", "holder_type", "holder_id", "holder_name", "content", "status"],
    required: ["certificate_type", "holder_id"], noDelete: "Issued certificates cannot be deleted; cancel instead.",
  },
  teachers: {
    table: "teachers", module: "teachers", label: "Teacher",
    search: ["id", "name", "name_bn", "email", "phone", "department", "designation"],
    filters: ["status", "department", "designation", "employee_type", "branch_id"],
    writable: ["id", "first_name", "last_name", "name", "name_bn", "department", "designation", "qualification",
      "phone", "email", "join_date", "experience", "subjects", "salary", "classes", "rating", "status", "details",
      "employee_type", "gender", "blood_group", "nid", "address", "photo_url", "date_of_birth", "mpo_index",
      "branch_id", "rfid_uid", "emergency_contact"],
    required: ["first_name", "name"],
    sensitive: ["salary", "nid", "phone"],
    softDelete: { column: "status", value: "Archived" },
    encrypted: ["nid"], genderColumn: "gender",
  },
  staff: {
    table: "staff", module: "staff", label: "Staff",
    search: ["id", "name", "name_bn", "email", "phone", "department", "designation"],
    filters: ["status", "department", "shift", "employee_type", "branch_id"],
    writable: ["id", "first_name", "last_name", "name", "name_bn", "designation", "department", "phone", "email",
      "join_date", "shift", "salary", "gender", "address", "status", "details", "employee_type", "blood_group",
      "nid", "education", "photo_url", "date_of_birth", "branch_id", "rfid_uid", "emergency_contact"],
    required: ["first_name", "name"],
    sensitive: ["salary", "nid", "phone"],
    softDelete: { column: "status", value: "Archived" },
    encrypted: ["nid"], genderColumn: "gender",
  },
  branches: {
    table: "branches", module: "branches", label: "Branch",
    search: ["id", "name", "code"], filters: ["status"],
    writable: ["name", "code", "address", "phone", "email", "head_name", "institution_type", "is_main", "status"],
    required: ["name"],
  },
  shifts: {
    table: "shifts", module: "academic", label: "Shift",
    search: ["name"], filters: ["status"], writable: ["name", "start_time", "end_time", "status"], required: ["name"],
  },
  studentGroups: {
    table: "student_groups", module: "academic", label: "Group",
    search: ["name"], filters: ["status"], writable: ["name", "applicable_classes", "status"], required: ["name"],
  },
  rooms: {
    table: "rooms", module: "academic", label: "Room",
    search: ["name", "building"], filters: ["status", "type"], writable: ["name", "building", "capacity", "type", "status"], required: ["name"],
  },
  classes: {
    table: "classes", module: "academic", label: "Class",
    search: ["id", "name", "level", "name_bn"], filters: ["status", "level", "institution_type", "branch_id"],
    writable: ["id", "name", "name_bn", "level", "sections", "students", "teacher_id", "status", "institution_type",
      "sort_order", "shift", "branch_id", "grade_scale_id", "has_groups"],
    required: ["name"], orderBy: "sort_order, name",
  },
  subjects: {
    table: "subjects", module: "academic", label: "Subject",
    search: ["id", "name", "code", "type", "name_bn", "kitab_name"], filters: ["status", "type", "teacher_id", "institution_type"],
    writable: ["id", "name", "name_bn", "name_ar", "code", "type", "class_range", "teacher_id", "credit", "status",
      "full_marks", "pass_marks", "components", "is_optional", "is_religious", "group_name", "kitab_name", "institution_type"],
    required: ["name", "code"],
  },
  classSubjects: {
    table: "class_subjects", module: "academic", label: "Class subject mapping",
    search: ["group_name"], filters: ["class_id", "subject_id", "group_name"],
    writable: ["class_id", "subject_id", "group_name", "is_compulsory", "is_fourth_subject_eligible", "sort_order"],
    required: ["class_id", "subject_id"], defaults: { group_name: "" }, orderBy: "sort_order, created_at",
  },
  classTeacherHistory: {
    table: "class_teacher_history", module: "academic", label: "Class teacher history",
    search: ["section"], filters: ["class_id", "teacher_id"],
    writable: ["class_id", "section", "teacher_id", "from_date", "to_date", "note"], required: ["class_id"],
  },
  academicYears: {
    table: "academic_years", module: "academic", label: "Academic session",
    search: ["id", "name"], filters: ["status", "is_current"],
    writable: ["id", "name", "start_date", "end_date", "sessions", "status", "is_current", "calendar_type"],
    required: ["name", "start_date", "end_date"],
    immutable: (row) => row.status === "Archived",
  },
  academicEvents: {
    table: "academic_events", module: "academic", label: "Calendar event",
    search: ["title", "description"], filters: ["type", "audience"], dateColumn: "start_date",
    writable: ["title", "type", "start_date", "end_date", "audience", "hijri_label", "description", "is_public", "images"],
    required: ["title", "start_date"], orderBy: "start_date DESC",
  },
  homework: {
    table: "homework", module: "homework", label: "Homework",
    search: ["title", "description", "class_name"], filters: ["kind", "class_id", "section", "subject_id", "teacher_id", "status"],
    dateColumn: "due_date",
    writable: ["kind", "class_id", "class_name", "section", "subject_id", "teacher_id", "title", "description",
      "attachment_url", "assigned_date", "due_date", "total_marks", "status", "submissions", "created_by"],
    required: ["title"], scopeColumn: { id: "class_id", name: "class_name" },
  },
  learningResources: {
    table: "learning_resources", module: "homework", label: "Learning resource",
    search: ["title", "description"], filters: ["class_id", "subject_id", "type"],
    writable: ["class_id", "subject_id", "title", "type", "url", "description", "uploaded_by"], required: ["title"],
  },
  syllabus: {
    table: "syllabus_items", module: "homework", label: "Syllabus item",
    search: ["chapter", "topic"], filters: ["class_id", "subject_id", "teacher_id", "completed"],
    writable: ["class_id", "subject_id", "teacher_id", "chapter", "topic", "planned_date", "completed", "completed_at"],
    required: ["topic"], orderBy: "planned_date NULLS LAST, created_at",
  },
  substitutes: {
    table: "substitute_assignments", module: "routine", label: "Substitute",
    search: ["note"], filters: ["date", "absent_teacher_id", "substitute_teacher_id"],
    writable: ["routine_entry_id", "date", "absent_teacher_id", "substitute_teacher_id", "note"], required: ["date"],
  },
  assignments: {
    table: "class_assignments", module: "academic", label: "Teacher assignment",
    search: ["id", "section", "room_no"], filters: ["class_id", "subject_id", "teacher_id", "section"],
    writable: ["id", "class_id", "section", "subject_id", "teacher_id", "room_no", "students"],
    required: ["class_id", "section", "subject_id"],
  },
  exams: {
    table: "exams", module: "exams", label: "Exam",
    search: ["id", "name", "status", "exam_type"], filters: ["status", "academic_year_id", "exam_type", "result_status"],
    writable: ["id", "name", "academic_year_id", "start_date", "end_date", "status", "details", "exam_type",
      "class_ids", "grade_scale_id", "weightage", "marks_entry_start", "marks_entry_end", "tie_break_rule", "combined_from"],
    required: ["name"],
    beforeUpdate: async (payload, old) => {
      if (old.result_status === "Published" && payload.grade_scale_id && payload.grade_scale_id !== old.grade_scale_id) {
        const e = new Error("Grading scale cannot change after results are published."); e.status = 409; throw e;
      }
    },
  },
  examSchedules: {
    table: "exam_schedules", module: "exams", label: "Exam routine",
    search: ["room"], filters: ["exam_id", "class_id", "subject_id", "exam_date"],
    writable: ["exam_id", "class_id", "subject_id", "exam_date", "start_time", "end_time", "room", "invigilator_id",
      "full_marks", "pass_marks", "components"],
    required: ["exam_id", "class_id", "subject_id"], orderBy: "exam_date NULLS LAST, start_time",
  },
  gradeScales: {
    table: "grade_scales", module: "settings", label: "Grade scale",
    search: ["name", "template_key"], filters: ["status", "institution_type", "scale_type"],
    writable: ["name", "template_key", "institution_type", "scale_type", "bands", "max_point", "fail_grade",
      "fourth_subject_threshold", "applicable_classes", "is_default", "status"],
    required: ["name"],
  },
  results: {
    table: "results", module: "results", label: "Result",
    search: ["student_id", "class_name", "grade", "roll"], filters: ["exam_id", "student_id", "class_id", "section", "status", "published"],
    writable: ["teacher_comment"], required: [], orderBy: "class_name, class_position NULLS LAST", noDelete: true,
    scopeColumn: { id: "class_id", name: "class_name" },
  },
  resultVersions: {
    table: "result_versions", module: "results", label: "Result version",
    search: ["reason"], filters: ["result_id"], writable: [], required: [], noDelete: true,
  },
  marksEntryStatus: {
    table: "marks_entry_status", module: "marks", label: "Marks entry status",
    search: ["status"], filters: ["exam_id", "class_id", "subject_id", "teacher_id", "status"], writable: [], required: [], noDelete: true,
  },
  feeHeads: {
    table: "fee_heads", module: "fees", label: "Fee head",
    search: ["name", "code", "name_bn"], filters: ["status", "category"],
    writable: ["name", "name_bn", "code", "category", "is_refundable", "status"], required: ["name"],
  },
  feeStructures: {
    table: "fee_structures", module: "fees", label: "Fee structure",
    search: ["id", "name", "frequency"], filters: ["status", "class_id", "academic_year_id", "fee_head_id"],
    writable: ["id", "name", "class_id", "academic_year_id", "amount", "frequency", "due_day", "components", "status",
      "fee_head_id", "section", "shift", "group_name", "late_fine_type", "late_fine_amount", "grace_days", "installments"],
    required: ["name", "amount"],
  },
  feeInvoices: {
    table: "fee_invoices", module: "fees", label: "Invoice",
    search: ["id", "student_id", "status", "fee_head"], filters: ["status", "student_id", "fee_structure_id", "guardian_id"],
    dateColumn: "billing_month",
    writable: ["id", "student_id", "fee_structure_id", "billing_month", "due_date", "amount", "paid_amount", "status",
      "notes", "fee_head", "late_fine", "guardian_id"],
    required: ["student_id", "amount"],
    noDelete: "Invoices cannot be deleted. Set the status to Cancelled with a note instead.",
    beforeUpdate: async (payload, old) => {
      if (payload.paid_amount !== undefined && Number(payload.paid_amount) !== Number(old.paid_amount)) {
        const e = new Error("Paid amount can only change through payment collection or receipt cancellation."); e.status = 409; throw e;
      }
    },
  },
  feeDiscounts: {
    table: "fee_discounts", module: "fees", label: "Discount / waiver",
    search: ["id", "student_id", "discount_type", "reason"], filters: ["student_id", "discount_type", "status"],
    writable: ["student_id", "fee_head_id", "discount_type", "mode", "value", "reason", "valid_from", "valid_to"],
    required: ["student_id", "discount_type", "value"],
    immutable: (row) => row.status === "Approved",
  },
  cashClosings: {
    table: "cash_closings", module: "fees", label: "Cash closing",
    search: ["collector_name", "note"], filters: ["closing_date", "collector_id"], dateColumn: "closing_date",
    writable: [], required: [], noDelete: true, orderBy: "closing_date DESC",
  },
  refunds: {
    table: "refunds", module: "fees", label: "Refund",
    search: ["id", "student_id", "reason"], filters: ["status", "student_id"], writable: [], required: [], noDelete: true,
  },
  gatewayTransactions: {
    table: "gateway_transactions", module: "fees", label: "Online payment",
    search: ["txn_id", "gateway", "guardian_id"], filters: ["gateway", "status", "posted"], writable: [], required: [], noDelete: true,
  },
  transactions: {
    table: "financial_transactions", module: "accounts", label: "Transaction",
    search: ["id", "description", "category", "reference_no"], filters: ["type", "category", "status", "payment_method", "fund", "approval_status"],
    dateColumn: "transaction_date",
    writable: ["id", "type", "transaction_date", "description", "category", "payment_method", "amount", "status",
      "reference_no", "details", "created_by", "account_head_id", "fund"],
    required: ["type", "description", "category", "amount"],
    noDelete: "Financial records cannot be deleted. Use reversal with approval instead.",
    immutable: (row) => row.reversed,
  },
  accountHeads: {
    table: "account_heads", module: "accounts", label: "Account head",
    search: ["name", "code"], filters: ["type", "fund", "status"],
    writable: ["code", "name", "type", "parent_id", "fund", "status"], required: ["name", "type"], orderBy: "type, code",
  },
  vouchers: {
    table: "vouchers", module: "accounts", label: "Voucher",
    search: ["id", "narration"], filters: ["voucher_type", "status", "fund"], dateColumn: "voucher_date",
    writable: ["voucher_type", "voucher_date", "narration", "entries", "total", "fund", "status", "created_by"],
    required: ["voucher_type"], noDelete: true,
    beforeCreate: async (payload) => {
      const entries = Array.isArray(payload.entries) ? payload.entries : [];
      const debit = entries.reduce((s, e) => s + Number(e.debit || 0), 0);
      const credit = entries.reduce((s, e) => s + Number(e.credit || 0), 0);
      if (!entries.length || Math.abs(debit - credit) > 0.005) {
        const e = new Error("Voucher entries must balance (total debit = total credit)."); e.status = 422; throw e;
      }
      payload.total = debit;
    },
    immutable: (row) => row.status === "Posted" || row.status === "Reversed",
  },
  bankAccounts: {
    table: "bank_accounts", module: "accounts", label: "Bank account",
    search: ["bank_name", "account_name", "account_no"], filters: ["status"],
    writable: ["bank_name", "account_name", "account_no", "branch", "opening_balance", "status"],
    required: ["bank_name", "account_name", "account_no"], sensitive: ["account_no"],
  },
  bankTransactions: {
    table: "bank_transactions", module: "accounts", label: "Bank transaction",
    search: ["reference", "description"], filters: ["bank_account_id", "txn_type", "reconciled"], dateColumn: "txn_date",
    writable: ["bank_account_id", "txn_type", "amount", "txn_date", "reference", "description", "reconciled", "reconciled_at"],
    required: ["bank_account_id", "txn_type", "amount"], noDelete: true,
  },
  payroll: {
    table: "payroll_records", module: "payroll", label: "Payroll",
    search: ["id", "employee_id", "employee_name", "department"], filters: ["status", "employee_type", "department", "payroll_month"],
    writable: ["id", "employee_type", "employee_id", "employee_name", "role", "department", "payroll_month",
      "basic_salary", "allowances", "deductions", "net_pay", "status", "details"],
    required: ["employee_type", "employee_id", "employee_name", "payroll_month"],
    sensitive: ["basic_salary", "net_pay", "allowances", "deductions"],
    immutable: (row) => row.status === "Paid",
  },
  salaryStructures: {
    table: "salary_structures", module: "payroll", label: "Salary structure",
    search: ["employee_id", "employee_name"], filters: ["employee_type", "employee_id"],
    writable: ["employee_type", "employee_id", "employee_name", "basic", "house_rent", "medical", "transport",
      "other_allowance", "provident_fund", "tax", "other_deduction", "govt_portion", "bonus",
      "per_day_absence_deduction", "bank_account", "effective_from"],
    required: ["employee_type", "employee_id"], sensitive: ["basic", "bank_account"],
  },
  salaryAdvances: {
    table: "salary_advances", module: "payroll", label: "Salary advance",
    search: ["employee_id", "employee_name"], filters: ["employee_type", "status"],
    writable: ["employee_type", "employee_id", "employee_name", "amount", "installment", "recovered", "issue_date", "status", "note"],
    required: ["employee_type", "employee_id", "amount"], noDelete: true,
  },
  routine: {
    table: "routine_entries", module: "routine", label: "Routine entry",
    search: ["section", "day_of_week", "period_code", "room_no", "label"],
    filters: ["class_id", "section", "day_of_week", "teacher_id", "subject_id"],
    writable: ["class_id", "section", "day_of_week", "period_code", "start_time", "end_time", "subject_id",
      "teacher_id", "room_no", "is_break", "label"],
    required: ["class_id", "section", "day_of_week", "period_code"],
    beforeCreate: async (payload) => require("./services/routineGuard").assertNoClash(payload),
    beforeUpdate: async (payload, old) => require("./services/routineGuard").assertNoClash({ ...old, ...payload }, old.id),
  },
  notices: {
    table: "notices", module: "communication", label: "Notice",
    search: ["id", "title", "message", "audience"], filters: ["status", "channel", "audience", "priority", "category"],
    writable: ["id", "title", "message", "channel", "audience", "scheduled_at", "status", "created_by", "priority",
      "category", "target_class", "target_section", "target_student_id", "attachment_url", "language", "show_on_board"],
    required: ["title", "message"],
  },
  messageTemplates: {
    table: "message_templates", module: "communication", label: "Message template",
    search: ["template_key", "name", "body"], filters: ["channel", "language", "status"],
    writable: ["template_key", "name", "channel", "language", "subject", "body", "status"], required: ["template_key", "name", "body"],
  },
  messageLogs: {
    table: "message_logs", module: "communication", label: "Message log",
    search: ["recipient", "body", "event_type"], filters: ["channel", "status", "event_type", "recipient_type", "student_id"],
    dateColumn: "created_at", writable: [], required: [], noDelete: true, sensitive: ["recipient"],
  },
  complaints: {
    table: "complaints", module: "communication", label: "Complaint",
    search: ["id", "subject", "description"], filters: ["status", "category", "guardian_id", "student_id", "assigned_to"],
    writable: ["guardian_id", "student_id", "category", "subject", "description", "assigned_to", "status", "response", "resolved_at"],
    required: ["subject"],
  },
  ptmSlots: {
    table: "ptm_slots", module: "communication", label: "PTM slot",
    search: ["note"], filters: ["teacher_id", "slot_date", "status", "guardian_id"],
    writable: ["teacher_id", "slot_date", "start_time", "end_time", "guardian_id", "student_id", "status", "note"],
    required: ["slot_date", "start_time", "end_time"], orderBy: "slot_date, start_time",
  },
  attendance: {
    table: "attendance", module: "attendance", label: "Attendance",
    search: ["student_id", "class_name", "status"], filters: ["student_id", "class_name", "attendance_date", "status", "source"],
    writable: ["student_id", "class_name", "attendance_date", "status", "note", "marked_by", "source"],
    required: ["student_id", "class_name", "attendance_date", "status"],
    scopeColumn: { name: "class_name" }, noDelete: true,
  },
  staffAttendance: {
    table: "staff_attendance", module: "staff_attendance", label: "Staff attendance",
    search: ["employee_id", "employee_name"], filters: ["employee_type", "employee_id", "attendance_date", "status", "source"],
    dateColumn: "attendance_date",
    writable: ["employee_type", "employee_id", "employee_name", "attendance_date", "status", "in_time", "out_time", "early_leave", "source", "note"],
    required: ["employee_type", "employee_id", "attendance_date", "status"], orderBy: "attendance_date DESC", noDelete: true,
  },
  devices: {
    table: "attendance_devices", module: "devices", label: "Attendance device",
    search: ["name", "serial_no", "location"], filters: ["device_type", "status"],
    writable: ["name", "device_type", "serial_no", "location", "direction", "status"], required: ["name", "device_type"],
  },
  biometricEnrollments: {
    table: "biometric_enrollments", module: "devices", label: "Credential",
    search: ["person_id", "credential_value", "device_user_id"], filters: ["person_type", "person_id", "credential_type", "status"],
    writable: ["person_type", "person_id", "credential_type", "credential_value", "device_user_id", "status"],
    required: ["person_type", "person_id", "credential_type", "credential_value"],
  },
  deviceEvents: {
    table: "device_events", module: "devices", label: "Device event",
    search: ["person_id", "credential_value", "message"], filters: ["device_id", "person_type", "person_id", "event_type", "status"],
    dateColumn: "event_time", writable: [], required: [], noDelete: true, orderBy: "event_time DESC",
  },
  leaveTypes: {
    table: "leave_types", module: "leave", label: "Leave type",
    search: ["name"], filters: ["applies_to", "status"],
    writable: ["name", "applies_to", "days_per_year", "is_paid", "status"], required: ["name"],
  },
  leaveRequests: {
    table: "leave_requests", module: "leave", label: "Leave request",
    search: ["id", "applicant_id", "applicant_name", "reason"], filters: ["applicant_type", "applicant_id", "status", "leave_type_id"],
    dateColumn: "from_date",
    writable: ["applicant_type", "applicant_id", "applicant_name", "leave_type_id", "leave_type", "from_date", "to_date",
      "days", "reason", "attachment_url"],
    required: ["applicant_type", "applicant_id", "from_date", "to_date"],
    immutable: (row) => row.status !== "Pending",
    selfService: true,
  },
  libraryBooks: {
    table: "library_books", module: "library", label: "Book",
    search: ["id", "isbn", "title", "author", "category"], filters: ["category", "language", "status"],
    writable: ["isbn", "title", "author", "publisher", "category", "language", "shelf", "total_copies", "available_copies", "price", "status"],
    required: ["title"],
  },
  libraryIssues: {
    table: "library_issues", module: "library", label: "Book issue",
    search: ["id", "borrower_id", "borrower_name"], filters: ["book_id", "borrower_type", "borrower_id", "status"],
    writable: ["note", "fine_paid"], required: [], noDelete: true, dateColumn: "issue_date",
  },
  inventorySuppliers: {
    table: "inventory_suppliers", module: "inventory", label: "Supplier",
    search: ["name", "contact_person", "phone"], filters: ["status"],
    writable: ["name", "contact_person", "phone", "email", "address", "status"], required: ["name"],
  },
  inventoryItems: {
    table: "inventory_items", module: "inventory", label: "Inventory item",
    search: ["id", "name", "category", "location"], filters: ["category", "status"],
    writable: ["name", "category", "unit", "reorder_level", "unit_price", "location", "status"], required: ["name"],
  },
  inventoryTransactions: {
    table: "inventory_transactions", module: "inventory", label: "Stock movement",
    search: ["issued_to", "note"], filters: ["item_id", "txn_type", "supplier_id"], dateColumn: "txn_date",
    writable: [], required: [], noDelete: true,
  },
  assets: {
    table: "assets", module: "inventory", label: "Asset",
    search: ["id", "name", "category", "location"], filters: ["category", "condition", "status"],
    writable: ["name", "category", "location", "purchase_date", "purchase_value", "condition", "last_maintenance",
      "next_maintenance", "maintenance_log", "status"],
    required: ["name"], softDelete: ARCHIVE,
  },
  visitors: {
    table: "visitors", module: "inventory", label: "Visitor",
    search: ["name", "phone", "purpose", "whom_to_meet"], filters: [], dateColumn: "check_in",
    writable: ["name", "phone", "purpose", "whom_to_meet", "id_proof", "check_in", "check_out", "note"],
    required: ["name", "purpose"], orderBy: "check_in DESC",
  },
  textbookDistributions: {
    table: "textbook_distributions", module: "students", label: "Textbook distribution",
    search: ["student_id"], filters: ["student_id", "academic_year_id", "acknowledged"],
    writable: ["student_id", "academic_year_id", "books", "distributed_on", "acknowledged"], required: ["student_id"],
  },
  clubs: {
    table: "clubs", module: "academic", label: "House / Club / ECA",
    search: ["name"], filters: ["kind", "advisor_id"],
    writable: ["name", "kind", "advisor_id", "points", "members", "achievements"], required: ["name"],
  },
  vehicles: {
    table: "transport_vehicles", module: "transport", label: "Vehicle",
    search: ["registration_no", "driver_name", "driver_phone"], filters: ["vehicle_type", "status"],
    writable: ["registration_no", "vehicle_type", "capacity", "driver_name", "driver_phone", "helper_name", "gps_device_id", "status"],
    required: ["registration_no"],
  },
  routes: {
    table: "transport_routes", module: "transport", label: "Route",
    search: ["name"], filters: ["vehicle_id", "status"],
    writable: ["name", "vehicle_id", "stops", "monthly_fare", "morning_departure", "evening_departure", "status"], required: ["name"],
  },
  transportAssignments: {
    table: "transport_assignments", module: "transport", label: "Transport assignment",
    search: ["student_id", "stop_name"], filters: ["student_id", "route_id", "status"],
    writable: ["student_id", "route_id", "stop_name", "monthly_fee", "start_date", "status"], required: ["student_id", "route_id"],
  },
  halaqas: {
    table: "halaqas", module: "madrasa", label: "Halaqa",
    search: ["name", "room"], filters: ["ustad_id", "halaqa_type", "status"],
    writable: ["name", "ustad_id", "halaqa_type", "room", "capacity", "status"], required: ["name"],
  },
  halaqaMembers: {
    table: "halaqa_members", module: "madrasa", label: "Halaqa member",
    search: ["student_id"], filters: ["halaqa_id", "student_id"],
    writable: ["halaqa_id", "student_id", "joined_on"], required: ["halaqa_id", "student_id"],
  },
  hifzLogs: {
    table: "hifz_logs", module: "madrasa", label: "Hifz log",
    search: ["student_id", "comment"], filters: ["student_id", "ustad_id", "log_type", "log_date"], dateColumn: "log_date",
    writable: ["student_id", "ustad_id", "log_date", "log_type", "sabak_para", "sabak_from", "sabak_to", "sabqi",
      "amukhta_para", "mistakes", "tajweed_rating", "comment"],
    required: ["student_id"], orderBy: "log_date DESC, created_at DESC",
  },
  hifzProgress: {
    table: "hifz_progress", module: "madrasa", label: "Hifz progress",
    search: ["student_id"], filters: ["student_id", "status"],
    writable: ["student_id", "para_no", "status", "completed_at"], required: ["student_id", "para_no"], orderBy: "student_id, para_no",
  },
  salahAttendance: {
    table: "salah_attendance", module: "madrasa", label: "Salah attendance",
    search: ["student_id"], filters: ["student_id", "attendance_date", "wakt", "status"], dateColumn: "attendance_date",
    writable: ["student_id", "attendance_date", "wakt", "status", "marked_by"], required: ["student_id", "attendance_date", "wakt", "status"],
  },
  hostelRooms: {
    table: "hostel_rooms", module: "hostel", label: "Hostel room",
    search: ["building", "room_no"], filters: ["building", "gender", "status"],
    writable: ["building", "room_no", "capacity", "gender", "monthly_fee", "status"], required: ["building", "room_no"],
  },
  hostelAllocations: {
    table: "hostel_allocations", module: "hostel", label: "Seat allocation",
    search: ["student_id", "seat_no"], filters: ["room_id", "student_id", "status", "is_lillah"],
    writable: ["room_id", "student_id", "seat_no", "from_date", "to_date", "is_lillah", "status"], required: ["room_id", "student_id"],
  },
  mealRecords: {
    table: "meal_records", module: "hostel", label: "Meal record",
    search: ["menu", "note"], filters: ["meal_date", "meal_type"], dateColumn: "meal_date",
    writable: ["meal_date", "meal_type", "meal_count", "bazar_cost", "menu", "note"], required: ["meal_date", "meal_type"],
    orderBy: "meal_date DESC",
  },
  donors: {
    table: "donors", module: "donations", label: "Donor",
    search: ["name", "mobile", "email"], filters: ["donor_type", "status"],
    writable: ["name", "mobile", "email", "address", "donor_type", "status"], required: ["name"], sensitive: ["mobile"],
  },
  donations: {
    table: "donations", module: "donations", label: "Donation",
    search: ["id", "donor_name", "reference_no"], filters: ["donor_id", "fund", "method"], dateColumn: "donation_date",
    writable: ["donor_id", "donor_name", "fund", "amount", "donation_date", "method", "reference_no", "note"],
    required: ["amount", "fund"], noDelete: true,
  },
  onlineClasses: {
    table: "online_classes", module: "online_classes", label: "Online class",
    search: ["title", "provider"], filters: ["class_id", "subject_id", "teacher_id", "status"],
    writable: ["class_id", "section", "subject_id", "teacher_id", "title", "provider", "meeting_url", "recording_url",
      "scheduled_at", "duration_minutes", "status"],
    required: ["title"], orderBy: "scheduled_at DESC NULLS LAST",
  },
  idCardPrintJobs: {
    table: "id_card_print_jobs", module: "idcards", label: "Print job",
    search: ["id", "template_name", "created_by_name"], filters: ["holder_type", "status", "job_type"], dateColumn: "created_at",
    writable: [], required: [], noDelete: true,
  },
  approvalDelegations: {
    table: "approval_delegations", module: "approvals", label: "Delegation",
    search: ["from_user_id", "to_user_id"], filters: ["status", "from_user_id", "to_user_id"],
    writable: ["from_user_id", "to_user_id", "request_types", "start_date", "end_date", "status"],
    required: ["from_user_id", "to_user_id", "start_date", "end_date"],
  },
  savedFilters: {
    table: "saved_report_filters", module: "reports", label: "Saved filter",
    search: ["name", "report_type"], filters: ["user_id", "report_type"],
    writable: ["user_id", "report_type", "name", "filters"], required: ["user_id", "report_type", "name"],
  },
  users: {
    table: "users", module: "users", label: "User",
    search: ["id", "name", "email", "role", "phone"], filters: ["status", "role", "linked_type"],
    writable: ["name", "email", "phone", "password_hash", "role", "roles", "status", "scope", "linked_type",
      "linked_id", "two_factor_enabled", "preferred_language", "permissions", "gender_scope", "is_support", "access_expires_at"],
    required: ["name", "email", "role"],
  },
  roles: {
    table: "roles", module: "users", label: "Role",
    search: ["id", "name", "display_name"], filters: ["status"],
    writable: ["name", "display_name", "description", "color", "permissions", "matrix", "scope_type", "can_view_sensitive", "status", "allowed_ips"],
    arrayColumns: ["allowed_ips"],
    required: ["name"],
    beforeUpdate: async (payload, old) => {
      if (["super admin", "school admin"].includes(String(old.name).toLowerCase()) && payload.status === "Inactive") {
        const e = new Error("The administrator role cannot be deactivated."); e.status = 403; throw e;
      }
    },
  },

  // ---- SRS gap closure (migration 007) ----
  approvalRules: {
    table: "approval_rules", module: "approvals", label: "Approval rule",
    search: ["request_type"], filters: ["request_type", "status"],
    writable: ["request_type", "min_amount", "levels", "status"], required: ["request_type", "levels"], orderBy: "request_type, min_amount",
  },
  studentGroupHistory: {
    table: "student_group_history", module: "students", label: "Group change",
    search: ["student_id", "to_group"], filters: ["student_id"], writable: [], required: [], noDelete: true, orderBy: "changed_at DESC",
  },
  branchTransfers: {
    table: "branch_transfers", module: "branches", label: "Branch transfer",
    search: ["person_id", "reason"], filters: ["person_type", "person_id", "to_branch_id"], dateColumn: "effective_date",
    writable: [], required: [], noDelete: true,
  },
  specialSchedules: {
    table: "special_schedules", module: "routine", label: "Special schedule",
    search: ["name"], filters: ["status", "shift"],
    writable: ["name", "from_date", "to_date", "shift", "periods", "note", "status"], required: ["name", "from_date", "to_date"], orderBy: "from_date DESC",
  },
  homeworkSubmissions: {
    table: "homework_submissions", module: "homework", label: "Homework submission",
    search: ["student_id", "remarks"], filters: ["homework_id", "student_id", "status"],
    writable: ["homework_id", "student_id", "status", "marks", "remarks", "submitted_at", "marked_by"], required: ["homework_id", "student_id"],
  },
  onlineClassAttendance: {
    table: "online_class_attendance", module: "online_classes", label: "Live class attendance",
    search: ["student_id"], filters: ["online_class_id", "student_id"], writable: [], required: [], noDelete: true, orderBy: "joined_at DESC",
  },
  quizzes: {
    table: "quizzes", module: "online_classes", label: "Quiz",
    search: ["title"], filters: ["class_id", "subject_id", "teacher_id", "status"],
    writable: ["title", "class_id", "section", "subject_id", "teacher_id", "questions", "duration_minutes", "opens_at", "closes_at", "status"],
    required: ["title"],
  },
  quizAttempts: {
    table: "quiz_attempts", module: "online_classes", label: "Quiz attempt",
    search: ["student_id"], filters: ["quiz_id", "student_id"], writable: [], required: [], noDelete: true, orderBy: "submitted_at DESC",
  },
  coursework: {
    table: "coursework", module: "homework", label: "Coursework",
    search: ["title", "description"], filters: ["class_id", "subject_id", "teacher_id", "status", "kind"], dateColumn: "deadline",
    writable: ["title", "kind", "class_id", "subject_id", "teacher_id", "description", "deadline", "max_marks", "status"], required: ["title"],
  },
  courseworkSubmissions: {
    table: "coursework_submissions", module: "homework", label: "Coursework submission",
    search: ["student_id", "feedback"], filters: ["coursework_id", "student_id", "status"],
    writable: ["coursework_id", "student_id", "submitted_on", "marks", "grade", "feedback", "status"], required: ["coursework_id", "student_id"],
  },
  examSeatPlans: {
    table: "exam_seat_plans", module: "exams", label: "Seat",
    search: ["student_id", "student_name", "room"], filters: ["exam_id", "room", "class_name"],
    writable: ["exam_id", "room", "seat_no", "student_id", "student_name", "class_name", "roll"], required: ["exam_id", "room", "seat_no", "student_id"],
    orderBy: "room, seat_no",
  },
  boardRegistrations: {
    table: "board_registrations", module: "students", label: "Board registration",
    search: ["student_id", "registration_no", "candidate_no", "board"], filters: ["board", "exam_level", "exam_year", "form_fillup_status", "status"],
    writable: ["student_id", "board", "exam_level", "exam_year", "exam_session", "registration_no", "candidate_no", "centre", "subjects",
      "entry_fee", "predicted_grades", "form_fillup_status", "block_reason", "status"],
    required: ["student_id", "board", "exam_level"],
  },
  boardResults: {
    table: "board_results", module: "results", label: "Board result",
    search: ["student_id", "roll_no", "registration_no"], filters: ["exam_level", "passing_year", "board", "student_id"],
    writable: ["student_id", "board", "exam_level", "passing_year", "roll_no", "registration_no", "gpa", "grade", "subjects"],
    required: ["student_id", "exam_level", "passing_year"],
  },
  stipendBeneficiaries: {
    table: "stipend_beneficiaries", module: "students", label: "Stipend beneficiary",
    search: ["student_id", "mobile_banking_number", "account_holder"], filters: ["program", "academic_year_id", "status", "mobile_banking_provider"],
    writable: ["student_id", "program", "academic_year_id", "mobile_banking_provider", "mobile_banking_number", "account_holder", "amount", "status"],
    required: ["student_id"], sensitive: ["mobile_banking_number"],
  },
  housePoints: {
    table: "house_points", module: "academic", label: "House points",
    search: ["reason", "student_id"], filters: ["club_id", "student_id"], dateColumn: "awarded_on",
    writable: ["club_id", "student_id", "points", "reason", "awarded_by", "awarded_on"], required: ["club_id", "points"], orderBy: "awarded_on DESC",
  },
  dailyLogs: {
    table: "daily_logs", module: "students", label: "Daily log",
    search: ["student_id", "activity", "note"], filters: ["student_id", "log_date", "teacher_id"], dateColumn: "log_date",
    writable: ["student_id", "log_date", "meal", "nap", "activity", "mood", "photo_url", "note", "teacher_id"], required: ["student_id"],
    orderBy: "log_date DESC",
  },
  hifzTargets: {
    table: "hifz_targets", module: "madrasa", label: "Hifz target",
    search: ["student_id"], filters: ["student_id", "target_month"],
    writable: ["student_id", "target_month", "target_pages", "note"], required: ["student_id", "target_month"], orderBy: "target_month DESC",
  },
  reportSchedules: {
    table: "report_schedules", module: "reports", label: "Report schedule",
    search: ["name", "report_type"], filters: ["frequency", "status"],
    writable: ["name", "report_type", "frequency", "send_hour", "recipients", "status"], required: ["name", "report_type"],
    arrayColumns: ["recipients"],
  },
  webhooks: {
    table: "webhooks", module: "settings", label: "Webhook",
    search: ["name", "url"], filters: ["status"],
    writable: ["name", "url", "events", "secret", "status"], required: ["name", "url", "secret"], sensitive: ["secret"],
    arrayColumns: ["events"],
    afterCreate: async () => require("./services/webhooks").invalidate(),
    afterUpdate: async () => require("./services/webhooks").invalidate(),
  },
  webhookDeliveries: {
    table: "webhook_deliveries", module: "settings", label: "Webhook delivery",
    search: ["event"], filters: ["webhook_id", "event", "status_code"], writable: [], required: [], noDelete: true,
  },
  userSessions: {
    table: "user_sessions", module: "users", label: "Session",
    search: ["user_id", "ip", "user_agent"], filters: ["user_id"], writable: [], required: [], noDelete: true, orderBy: "last_seen_at DESC",
  },
};
