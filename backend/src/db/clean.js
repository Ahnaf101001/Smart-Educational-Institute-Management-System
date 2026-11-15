const { pool, transaction } = require("./pool");

// Removes all business data while keeping the schema, the admin account and
// system configuration (roles, grading scales, ID card templates, message
// templates, fee heads, leave types, chart of accounts, institute profile).
// audit_logs is append-only by design and is intentionally not cleared.
const businessTables = [
  "application_drafts", "notices", "message_logs", "messages", "complaints", "ptm_slots",
  "routine_entries", "substitute_assignments", "payroll_records", "salary_structures", "salary_advances",
  "financial_transactions", "vouchers", "bank_transactions", "bank_accounts",
  "gateway_transactions", "refunds", "cash_closings", "fee_payments", "fee_discounts", "fee_invoices", "fee_structures",
  "approval_requests", "approval_delegations", "saved_report_filters", "password_reset_tokens",
  "result_versions", "results", "marks_entry_status", "marks", "exam_schedules", "exams",
  "period_attendance", "attendance", "staff_attendance", "device_events", "biometric_enrollments", "attendance_devices",
  "leave_requests", "id_card_print_jobs", "id_cards",
  "hifz_logs", "hifz_progress", "salah_attendance", "halaqa_members", "halaqas",
  "hostel_allocations", "hostel_rooms", "meal_records", "donations", "donors",
  "transport_assignments", "vehicle_locations", "transport_routes", "transport_vehicles",
  "library_issues", "library_books", "inventory_transactions", "inventory_items", "inventory_suppliers", "assets", "visitors",
  "textbook_distributions", "clubs", "online_classes", "homework", "learning_resources", "syllabus_items",
  "academic_events", "class_teacher_history", "class_subjects", "class_assignments",
  "certificates", "student_documents", "student_status_history", "enrollments", "guardian_students", "guardians",
  "admission_circulars", "admissions", "students", "subjects", "classes", "academic_settings", "academic_years",
  "staff", "teachers", "branches", "rooms",
];

const sequenceStarts = {
  user_id_seq: 2, student_id_seq: 4001, admission_id_seq: 4101, teacher_id_seq: 1001, staff_id_seq: 1,
  class_id_seq: 1, subject_id_seq: 1, year_id_seq: 1, assignment_id_seq: 1, exam_id_seq: 1, mark_id_seq: 1,
  fee_structure_id_seq: 1, invoice_id_seq: 1, payment_id_seq: 1, transaction_id_seq: 1, payroll_id_seq: 1,
  notice_id_seq: 1, receipt_no_seq: 100001, card_number_seq: 1, print_job_seq: 1, guardian_seq: 1, approval_seq: 1,
};

async function clean() {
  await transaction(async (client) => {
    await client.query(`TRUNCATE TABLE ${businessTables.join(", ")} CASCADE`);
    await client.query("DELETE FROM users WHERE id <> 'USR-1'");
    for (const [sequence, start] of Object.entries(sequenceStarts)) {
      await client.query(`ALTER SEQUENCE IF EXISTS ${sequence} RESTART WITH ${start}`);
    }
  });
  console.log("All business data was removed. Schema, admin access and system configuration were preserved.");
}

if (require.main === module) {
  clean()
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}

module.exports = clean;
