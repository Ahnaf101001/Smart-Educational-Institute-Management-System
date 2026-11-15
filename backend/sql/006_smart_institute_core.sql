-- =====================================================================
-- Smart Educational Institute Management System – core expansion
-- Implements the data model from SRS v3.0 (consolidated), SRS v1.0
-- (School & Madrasa) and the AeroSchool feature list.
-- Supports: General line / Bangla Medium, English Version, English Medium,
-- Alia Madrasa, Qawmi Madrasa, Kindergarten and College.
-- =====================================================================

-- Generic sequence-backed id helper -----------------------------------
CREATE OR REPLACE FUNCTION make_prefixed_id(prefix TEXT, seq TEXT, width INT DEFAULT 5)
RETURNS TEXT AS $$
BEGIN
  RETURN prefix || '-' || LPAD(nextval(seq)::TEXT, width, '0');
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------
-- 1. Institution profile, settings & branches (SYS-01..08)
-- ---------------------------------------------------------------------
ALTER TABLE institute_profile
  ADD COLUMN IF NOT EXISTS name_bn TEXT,
  ADD COLUMN IF NOT EXISTS name_ar TEXT,
  ADD COLUMN IF NOT EXISTS institution_types JSONB NOT NULL DEFAULT '["Bangla Medium"]'::jsonb,
  ADD COLUMN IF NOT EXISTS primary_type TEXT NOT NULL DEFAULT 'Bangla Medium',
  ADD COLUMN IF NOT EXISTS motto TEXT,
  ADD COLUMN IF NOT EXISTS principal_name TEXT,
  ADD COLUMN IF NOT EXISTS principal_title TEXT DEFAULT 'Principal',
  ADD COLUMN IF NOT EXISTS signature_url TEXT,
  ADD COLUMN IF NOT EXISTS seal_url TEXT,
  ADD COLUMN IF NOT EXISTS brand_color TEXT DEFAULT '#223f91',
  ADD COLUMN IF NOT EXISTS accent_color TEXT DEFAULT '#1673f8',
  ADD COLUMN IF NOT EXISTS board TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact TEXT;

ALTER TABLE system_settings
  ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'bn',
  ADD COLUMN IF NOT EXISTS digit_system TEXT NOT NULL DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS date_format TEXT NOT NULL DEFAULT 'DD/MM/YYYY',
  ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'Asia/Dhaka',
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'BDT',
  ADD COLUMN IF NOT EXISTS calendar_type TEXT NOT NULL DEFAULT 'Gregorian',
  ADD COLUMN IF NOT EXISTS attendance_edit_window_days INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS attendance_cutoff_time TEXT NOT NULL DEFAULT '09:15',
  ADD COLUMN IF NOT EXISTS consecutive_absence_threshold INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS notify_absent BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS notify_late BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS notify_entry_exit BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS notify_result BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS notify_fee_reminder BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS fee_reminder_day INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS invoice_generation_day INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS sms_provider TEXT,
  ADD COLUMN IF NOT EXISTS sms_sender_id TEXT,
  ADD COLUMN IF NOT EXISTS sms_cost_per_part NUMERIC(8, 4) NOT NULL DEFAULT 0.35,
  ADD COLUMN IF NOT EXISTS payment_gateways JSONB NOT NULL DEFAULT '{"cash": true, "bkash": false, "nagad": false, "rocket": false, "sslcommerz": false}'::jsonb,
  ADD COLUMN IF NOT EXISTS require_new_card_each_session BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS card_print_requires_approval BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS card_validity_months INTEGER NOT NULL DEFAULT 12,
  ADD COLUMN IF NOT EXISTS card_number_prefix TEXT NOT NULL DEFAULT 'SC',
  ADD COLUMN IF NOT EXISTS staff_card_number_prefix TEXT NOT NULL DEFAULT 'EC',
  ADD COLUMN IF NOT EXISTS student_id_format TEXT NOT NULL DEFAULT 'STU-{YEAR}-{SEQ}',
  ADD COLUMN IF NOT EXISTS admit_card_block_on_due BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS result_hide_on_due BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS allow_self_approval BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS expense_approval_threshold NUMERIC(12, 2) NOT NULL DEFAULT 5000,
  ADD COLUMN IF NOT EXISTS committee_approval_threshold NUMERIC(12, 2) NOT NULL DEFAULT 10000,
  ADD COLUMN IF NOT EXISTS session_timeout_minutes INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS max_login_attempts INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS enabled_modules JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS public_admission_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS public_result_enabled BOOLEAN NOT NULL DEFAULT TRUE;

CREATE SEQUENCE IF NOT EXISTS branch_seq START 1;
CREATE TABLE IF NOT EXISTS branches (
  id TEXT PRIMARY KEY DEFAULT make_prefixed_id('BR', 'branch_seq', 3),
  name TEXT NOT NULL UNIQUE,
  code TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  head_name TEXT,
  institution_type TEXT,
  is_main BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'Active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE SEQUENCE IF NOT EXISTS shift_seq START 1;
CREATE TABLE IF NOT EXISTS shifts (
  id TEXT PRIMARY KEY DEFAULT make_prefixed_id('SFT', 'shift_seq', 3),
  name TEXT NOT NULL UNIQUE,
  start_time TEXT,
  end_time TEXT,
  status TEXT NOT NULL DEFAULT 'Active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE SEQUENCE IF NOT EXISTS group_seq START 1;
CREATE TABLE IF NOT EXISTS student_groups (
  id TEXT PRIMARY KEY DEFAULT make_prefixed_id('GRP', 'group_seq', 3),
  name TEXT NOT NULL UNIQUE,
  applicable_classes TEXT,
  status TEXT NOT NULL DEFAULT 'Active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE SEQUENCE IF NOT EXISTS room_seq START 1;
CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY DEFAULT make_prefixed_id('ROOM', 'room_seq', 3),
  name TEXT NOT NULL UNIQUE,
  building TEXT,
  capacity INTEGER NOT NULL DEFAULT 40,
  type TEXT NOT NULL DEFAULT 'Classroom',
  status TEXT NOT NULL DEFAULT 'Active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------
-- 2. Users, roles, RBAC, audit and approvals (RP-01..10, APR-01..08)
-- ---------------------------------------------------------------------
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS roles JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS scope JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS linked_type TEXT,
  ADD COLUMN IF NOT EXISTS linked_id TEXT,
  ADD COLUMN IF NOT EXISTS failed_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS otp_hash TEXT,
  ADD COLUMN IF NOT EXISTS otp_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS otp_sent_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS preferred_language TEXT NOT NULL DEFAULT 'bn';

ALTER TABLE roles
  ADD COLUMN IF NOT EXISTS matrix JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS scope_type TEXT NOT NULL DEFAULT 'All',
  ADD COLUMN IF NOT EXISTS can_view_sensitive BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_system BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'Active';

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT,
  user_name TEXT,
  entity TEXT NOT NULL,
  entity_id TEXT,
  action TEXT NOT NULL,
  old_value JSONB,
  new_value JSONB,
  reason TEXT,
  ip TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);

-- Audit rows are tamper-evident: no updates or deletes allowed.
CREATE OR REPLACE FUNCTION audit_logs_immutable()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only';
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS audit_logs_no_update ON audit_logs;
CREATE TRIGGER audit_logs_no_update BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION audit_logs_immutable();

CREATE SEQUENCE IF NOT EXISTS approval_seq START 1;
CREATE TABLE IF NOT EXISTS approval_requests (
  id TEXT PRIMARY KEY DEFAULT make_prefixed_id('APR', 'approval_seq', 6),
  request_type TEXT NOT NULL,
  title TEXT NOT NULL,
  reference_table TEXT,
  reference_id TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  amount NUMERIC(12, 2),
  urgency TEXT NOT NULL DEFAULT 'Normal',
  maker_id TEXT,
  maker_name TEXT,
  checker_id TEXT,
  checker_name TEXT,
  required_role TEXT,
  level INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'Pending'
    CHECK (status IN ('Pending', 'Approved', 'Rejected', 'Clarification', 'Cancelled')),
  reason TEXT,
  decision_note TEXT,
  history JSONB NOT NULL DEFAULT '[]'::jsonb,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_approvals_status ON approval_requests(status, request_type);

CREATE TABLE IF NOT EXISTS approval_delegations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id TEXT NOT NULL,
  to_user_id TEXT NOT NULL,
  request_types JSONB NOT NULL DEFAULT '[]'::jsonb,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'Active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS saved_report_filters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  report_type TEXT NOT NULL,
  name TEXT NOT NULL,
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------
-- 3. Academic structure (AC-01..14, ACA-01..10)
-- ---------------------------------------------------------------------
ALTER TABLE academic_years
  ADD COLUMN IF NOT EXISTS is_current BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS calendar_type TEXT NOT NULL DEFAULT 'Gregorian',
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;

ALTER TABLE classes
  ADD COLUMN IF NOT EXISTS name_bn TEXT,
  ADD COLUMN IF NOT EXISTS institution_type TEXT,
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shift TEXT,
  ADD COLUMN IF NOT EXISTS branch_id TEXT,
  ADD COLUMN IF NOT EXISTS grade_scale_id TEXT,
  ADD COLUMN IF NOT EXISTS has_groups BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE subjects
  ADD COLUMN IF NOT EXISTS name_bn TEXT,
  ADD COLUMN IF NOT EXISTS name_ar TEXT,
  ADD COLUMN IF NOT EXISTS full_marks NUMERIC(6, 2) NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS pass_marks NUMERIC(6, 2) NOT NULL DEFAULT 33,
  ADD COLUMN IF NOT EXISTS components JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS is_optional BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_religious BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS group_name TEXT,
  ADD COLUMN IF NOT EXISTS kitab_name TEXT,
  ADD COLUMN IF NOT EXISTS institution_type TEXT;

CREATE TABLE IF NOT EXISTS class_subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  group_name TEXT NOT NULL DEFAULT '',
  is_compulsory BOOLEAN NOT NULL DEFAULT TRUE,
  is_fourth_subject_eligible BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (class_id, subject_id, group_name)
);

CREATE TABLE IF NOT EXISTS class_teacher_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  section TEXT,
  teacher_id TEXT REFERENCES teachers(id) ON DELETE SET NULL,
  from_date DATE NOT NULL DEFAULT CURRENT_DATE,
  to_date DATE,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE SEQUENCE IF NOT EXISTS event_seq START 1;
CREATE TABLE IF NOT EXISTS academic_events (
  id TEXT PRIMARY KEY DEFAULT make_prefixed_id('EVT', 'event_seq', 5),
  title TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'Event'
    CHECK (type IN ('Holiday', 'Exam', 'Event', 'Meeting', 'Admission', 'Activity', 'Other')),
  start_date DATE NOT NULL,
  end_date DATE,
  audience TEXT NOT NULL DEFAULT 'All',
  hijri_label TEXT,
  description TEXT,
  is_public BOOLEAN NOT NULL DEFAULT TRUE,
  images JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE SEQUENCE IF NOT EXISTS homework_seq START 1;
CREATE TABLE IF NOT EXISTS homework (
  id TEXT PRIMARY KEY DEFAULT make_prefixed_id('HW', 'homework_seq', 6),
  kind TEXT NOT NULL DEFAULT 'Homework' CHECK (kind IN ('Homework', 'Assignment', 'Project')),
  class_id TEXT REFERENCES classes(id) ON DELETE CASCADE,
  class_name TEXT,
  section TEXT,
  subject_id TEXT REFERENCES subjects(id) ON DELETE SET NULL,
  teacher_id TEXT REFERENCES teachers(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  attachment_url TEXT,
  assigned_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  total_marks NUMERIC(6, 2),
  status TEXT NOT NULL DEFAULT 'Published',
  submissions JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS learning_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id TEXT REFERENCES classes(id) ON DELETE CASCADE,
  subject_id TEXT REFERENCES subjects(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'Note',
  url TEXT,
  description TEXT,
  uploaded_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS syllabus_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id TEXT REFERENCES classes(id) ON DELETE CASCADE,
  subject_id TEXT REFERENCES subjects(id) ON DELETE CASCADE,
  teacher_id TEXT REFERENCES teachers(id) ON DELETE SET NULL,
  chapter TEXT,
  topic TEXT NOT NULL,
  planned_date DATE,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS substitute_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  routine_entry_id UUID REFERENCES routine_entries(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  absent_teacher_id TEXT REFERENCES teachers(id) ON DELETE SET NULL,
  substitute_teacher_id TEXT REFERENCES teachers(id) ON DELETE SET NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------
-- 4. Students, guardians, enrollment, documents (ST-01..11, GD-01..07)
-- ---------------------------------------------------------------------
ALTER TABLE students
  ADD COLUMN IF NOT EXISTS name_bn TEXT,
  ADD COLUMN IF NOT EXISTS name_ar TEXT,
  ADD COLUMN IF NOT EXISTS photo_url TEXT,
  ADD COLUMN IF NOT EXISTS blood_group TEXT,
  ADD COLUMN IF NOT EXISTS birth_cert_no TEXT,
  ADD COLUMN IF NOT EXISTS religion TEXT,
  ADD COLUMN IF NOT EXISTS nationality TEXT DEFAULT 'Bangladeshi',
  ADD COLUMN IF NOT EXISTS shift TEXT,
  ADD COLUMN IF NOT EXISTS group_name TEXT,
  ADD COLUMN IF NOT EXISTS version TEXT,
  ADD COLUMN IF NOT EXISTS branch_id TEXT,
  ADD COLUMN IF NOT EXISTS academic_year_id TEXT,
  ADD COLUMN IF NOT EXISTS previous_school TEXT,
  ADD COLUMN IF NOT EXISTS fourth_subject_id TEXT,
  ADD COLUMN IF NOT EXISTS rfid_uid TEXT,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_students_birth_cert ON students(birth_cert_no);

CREATE SEQUENCE IF NOT EXISTS guardian_seq START 1;
CREATE TABLE IF NOT EXISTS guardians (
  id TEXT PRIMARY KEY DEFAULT make_prefixed_id('GDN', 'guardian_seq', 5),
  name TEXT NOT NULL,
  name_bn TEXT,
  relation_default TEXT NOT NULL DEFAULT 'Father',
  mobile TEXT NOT NULL UNIQUE,
  alt_mobile TEXT,
  email TEXT,
  nid TEXT,
  occupation TEXT,
  income_range TEXT,
  address TEXT,
  emergency_contact TEXT,
  photo_url TEXT,
  portal_access BOOLEAN NOT NULL DEFAULT TRUE,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'Active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS guardian_students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guardian_id TEXT NOT NULL REFERENCES guardians(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  relation TEXT NOT NULL DEFAULT 'Father',
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  access_status TEXT NOT NULL DEFAULT 'Enabled' CHECK (access_status IN ('Enabled', 'Disabled')),
  receives_notifications BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (guardian_id, student_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_primary_guardian
  ON guardian_students(student_id) WHERE is_primary;

CREATE TABLE IF NOT EXISTS enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  academic_year_id TEXT REFERENCES academic_years(id) ON DELETE SET NULL,
  session_name TEXT,
  class_id TEXT REFERENCES classes(id) ON DELETE SET NULL,
  class_name TEXT,
  section TEXT,
  shift TEXT,
  group_name TEXT,
  roll TEXT,
  status TEXT NOT NULL DEFAULT 'Active'
    CHECK (status IN ('Active', 'Promoted', 'Detained', 'Transferred', 'Dropped', 'Passed Out', 'Closed')),
  promoted_from UUID,
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  result_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_enrollment_student_session
  ON enrollments(student_id, academic_year_id) WHERE status = 'Active';
CREATE UNIQUE INDEX IF NOT EXISTS uq_enrollment_roll
  ON enrollments(academic_year_id, class_id, COALESCE(section, ''), COALESCE(shift, ''), roll)
  WHERE status = 'Active' AND roll IS NOT NULL AND roll <> '';

CREATE TABLE IF NOT EXISTS student_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type TEXT NOT NULL DEFAULT 'Student',
  owner_id TEXT NOT NULL,
  document_type TEXT NOT NULL,
  file_name TEXT,
  file_url TEXT NOT NULL,
  mime_type TEXT,
  size_bytes INTEGER,
  uploaded_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_documents_owner ON student_documents(owner_type, owner_id);

CREATE TABLE IF NOT EXISTS student_status_history (
  id BIGSERIAL PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  reason TEXT,
  changed_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE SEQUENCE IF NOT EXISTS certificate_seq START 1;
CREATE TABLE IF NOT EXISTS certificates (
  id TEXT PRIMARY KEY DEFAULT make_prefixed_id('CERT', 'certificate_seq', 6),
  certificate_type TEXT NOT NULL
    CHECK (certificate_type IN ('Transfer Certificate', 'Testimonial', 'Character Certificate',
      'Study Certificate', 'Sanad', 'Hifz Sanad', 'Experience Certificate', 'Employment Letter')),
  holder_type TEXT NOT NULL DEFAULT 'Student',
  holder_id TEXT NOT NULL,
  holder_name TEXT,
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Issued', 'Rejected', 'Cancelled')),
  issued_at TIMESTAMPTZ,
  requested_by TEXT,
  approved_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------
-- 5. Admission (AD-01..11)
-- ---------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS circular_seq START 1;
CREATE TABLE IF NOT EXISTS admission_circulars (
  id TEXT PRIMARY KEY DEFAULT make_prefixed_id('CIR', 'circular_seq', 4),
  title TEXT NOT NULL,
  academic_year_id TEXT REFERENCES academic_years(id) ON DELETE SET NULL,
  class_name TEXT NOT NULL,
  seats INTEGER NOT NULL DEFAULT 0,
  admission_fee NUMERIC(12, 2) NOT NULL DEFAULT 0,
  application_fee NUMERIC(12, 2) NOT NULL DEFAULT 0,
  eligibility TEXT,
  required_documents JSONB NOT NULL DEFAULT '[]'::jsonb,
  start_date DATE,
  deadline DATE,
  test_required BOOLEAN NOT NULL DEFAULT FALSE,
  test_date DATE,
  test_venue TEXT,
  selection_method TEXT NOT NULL DEFAULT 'Merit' CHECK (selection_method IN ('Merit', 'Lottery', 'First Come')),
  status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Published', 'Closed')),
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE admissions
  ADD COLUMN IF NOT EXISTS circular_id TEXT,
  ADD COLUMN IF NOT EXISTS birth_cert_no TEXT,
  ADD COLUMN IF NOT EXISTS guardian_mobile TEXT,
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'Office',
  ADD COLUMN IF NOT EXISTS test_marks NUMERIC(6, 2),
  ADD COLUMN IF NOT EXISTS test_attendance TEXT,
  ADD COLUMN IF NOT EXISTS merit_position INTEGER,
  ADD COLUMN IF NOT EXISTS admit_card_no TEXT,
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'Unpaid',
  ADD COLUMN IF NOT EXISTS payment_ref TEXT,
  ADD COLUMN IF NOT EXISTS payment_amount NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS duplicate_flag BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS duplicate_of TEXT,
  ADD COLUMN IF NOT EXISTS override_reason TEXT,
  ADD COLUMN IF NOT EXISTS status_history JSONB NOT NULL DEFAULT '[]'::jsonb;
CREATE INDEX IF NOT EXISTS idx_admissions_birth_cert ON admissions(birth_cert_no);
CREATE INDEX IF NOT EXISTS idx_admissions_mobile ON admissions(guardian_mobile);

-- ---------------------------------------------------------------------
-- 6. Attendance: students, staff, devices, entry/exit, leave (AT, ATT, HR-05)
-- ---------------------------------------------------------------------
ALTER TABLE attendance
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'Manual',
  ADD COLUMN IF NOT EXISTS in_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS out_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS locked BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS notified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS section TEXT;

CREATE TABLE IF NOT EXISTS period_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  attendance_date DATE NOT NULL,
  period_code TEXT NOT NULL,
  subject_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('Present', 'Absent', 'Late', 'Leave')),
  marked_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, attendance_date, period_code)
);

CREATE TABLE IF NOT EXISTS staff_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_type TEXT NOT NULL CHECK (employee_type IN ('Teacher', 'Staff')),
  employee_id TEXT NOT NULL,
  employee_name TEXT,
  attendance_date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Present', 'Absent', 'Late', 'Leave', 'Half Day')),
  in_time TIMESTAMPTZ,
  out_time TIMESTAMPTZ,
  early_leave BOOLEAN NOT NULL DEFAULT FALSE,
  source TEXT NOT NULL DEFAULT 'Manual',
  note TEXT,
  marked_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (employee_type, employee_id, attendance_date)
);

CREATE SEQUENCE IF NOT EXISTS device_seq START 1;
CREATE TABLE IF NOT EXISTS attendance_devices (
  id TEXT PRIMARY KEY DEFAULT make_prefixed_id('DEV', 'device_seq', 3),
  name TEXT NOT NULL,
  device_type TEXT NOT NULL CHECK (device_type IN ('Face Recognition', 'Fingerprint', 'RFID', 'QR Scanner', 'Mobile App')),
  serial_no TEXT UNIQUE,
  location TEXT,
  direction TEXT NOT NULL DEFAULT 'Both' CHECK (direction IN ('In', 'Out', 'Both')),
  api_key_hash TEXT,
  api_key_hint TEXT,
  status TEXT NOT NULL DEFAULT 'Active',
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS biometric_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_type TEXT NOT NULL CHECK (person_type IN ('Student', 'Teacher', 'Staff')),
  person_id TEXT NOT NULL,
  credential_type TEXT NOT NULL CHECK (credential_type IN ('RFID Card', 'Fingerprint', 'Face', 'QR')),
  credential_value TEXT NOT NULL,
  device_user_id TEXT,
  status TEXT NOT NULL DEFAULT 'Active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (credential_type, credential_value)
);

CREATE TABLE IF NOT EXISTS device_events (
  id BIGSERIAL PRIMARY KEY,
  device_id TEXT REFERENCES attendance_devices(id) ON DELETE SET NULL,
  person_type TEXT,
  person_id TEXT,
  credential_value TEXT,
  event_type TEXT NOT NULL DEFAULT 'IN' CHECK (event_type IN ('IN', 'OUT')),
  event_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'Processed' CHECK (status IN ('Processed', 'Unmatched', 'Duplicate', 'Error')),
  message TEXT,
  raw JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_device_events_time ON device_events(event_time DESC);

CREATE SEQUENCE IF NOT EXISTS leave_type_seq START 1;
CREATE TABLE IF NOT EXISTS leave_types (
  id TEXT PRIMARY KEY DEFAULT make_prefixed_id('LT', 'leave_type_seq', 3),
  name TEXT NOT NULL,
  applies_to TEXT NOT NULL DEFAULT 'Staff' CHECK (applies_to IN ('Student', 'Staff', 'Both')),
  days_per_year INTEGER NOT NULL DEFAULT 0,
  is_paid BOOLEAN NOT NULL DEFAULT TRUE,
  status TEXT NOT NULL DEFAULT 'Active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (name, applies_to)
);

CREATE SEQUENCE IF NOT EXISTS leave_seq START 1;
CREATE TABLE IF NOT EXISTS leave_requests (
  id TEXT PRIMARY KEY DEFAULT make_prefixed_id('LV', 'leave_seq', 6),
  applicant_type TEXT NOT NULL CHECK (applicant_type IN ('Student', 'Teacher', 'Staff')),
  applicant_id TEXT NOT NULL,
  applicant_name TEXT,
  leave_type_id TEXT REFERENCES leave_types(id) ON DELETE SET NULL,
  leave_type TEXT,
  from_date DATE NOT NULL,
  to_date DATE NOT NULL,
  days INTEGER NOT NULL DEFAULT 1,
  reason TEXT,
  attachment_url TEXT,
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected', 'Cancelled')),
  requested_by TEXT,
  decided_by TEXT,
  decided_at TIMESTAMPTZ,
  decision_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (to_date >= from_date)
);

-- ---------------------------------------------------------------------
-- 7. Grading engine, exams, results (EX-01..20, PC-18..25)
-- ---------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS grade_scale_seq START 1;
CREATE TABLE IF NOT EXISTS grade_scales (
  id TEXT PRIMARY KEY DEFAULT make_prefixed_id('GS', 'grade_scale_seq', 3),
  name TEXT NOT NULL UNIQUE,
  template_key TEXT,
  institution_type TEXT,
  scale_type TEXT NOT NULL DEFAULT 'GPA' CHECK (scale_type IN ('GPA', 'Letter', 'Division')),
  bands JSONB NOT NULL DEFAULT '[]'::jsonb,
  max_point NUMERIC(4, 2) NOT NULL DEFAULT 5,
  fail_grade TEXT NOT NULL DEFAULT 'F',
  fourth_subject_threshold NUMERIC(4, 2) NOT NULL DEFAULT 2,
  applicable_classes JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'Active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE exams
  ADD COLUMN IF NOT EXISTS exam_type TEXT NOT NULL DEFAULT 'Term',
  ADD COLUMN IF NOT EXISTS class_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS grade_scale_id TEXT,
  ADD COLUMN IF NOT EXISTS weightage NUMERIC(5, 2) NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS marks_entry_start DATE,
  ADD COLUMN IF NOT EXISTS marks_entry_end DATE,
  ADD COLUMN IF NOT EXISTS result_status TEXT NOT NULL DEFAULT 'Draft',
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS publish_version INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tie_break_rule TEXT NOT NULL DEFAULT 'total,gpa,roll',
  ADD COLUMN IF NOT EXISTS combined_from JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS exam_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id TEXT NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  exam_date DATE,
  start_time TEXT,
  end_time TEXT,
  room TEXT,
  invigilator_id TEXT REFERENCES teachers(id) ON DELETE SET NULL,
  full_marks NUMERIC(6, 2) NOT NULL DEFAULT 100,
  pass_marks NUMERIC(6, 2) NOT NULL DEFAULT 33,
  components JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (exam_id, class_id, subject_id)
);

ALTER TABLE marks
  ADD COLUMN IF NOT EXISTS component_marks JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS is_absent BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_exempt BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS grace_marks NUMERIC(6, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS entered_by TEXT;

CREATE TABLE IF NOT EXISTS marks_entry_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id TEXT NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  class_id TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  teacher_id TEXT,
  status TEXT NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'Submitted', 'Locked', 'Unlock Requested')),
  submitted_by TEXT,
  submitted_at TIMESTAMPTZ,
  locked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (exam_id, class_id, subject_id)
);

CREATE TABLE IF NOT EXISTS results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id TEXT NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_id TEXT,
  class_name TEXT,
  section TEXT,
  roll TEXT,
  total_marks NUMERIC(8, 2) NOT NULL DEFAULT 0,
  max_marks NUMERIC(8, 2) NOT NULL DEFAULT 0,
  percentage NUMERIC(6, 2) NOT NULL DEFAULT 0,
  gpa NUMERIC(4, 2) NOT NULL DEFAULT 0,
  gpa_without_fourth NUMERIC(4, 2) NOT NULL DEFAULT 0,
  grade TEXT,
  division TEXT,
  status TEXT NOT NULL DEFAULT 'Pass',
  class_position INTEGER,
  section_position INTEGER,
  failed_subjects INTEGER NOT NULL DEFAULT 0,
  subjects JSONB NOT NULL DEFAULT '[]'::jsonb,
  version INTEGER NOT NULL DEFAULT 1,
  published BOOLEAN NOT NULL DEFAULT FALSE,
  published_at TIMESTAMPTZ,
  teacher_comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (exam_id, student_id)
);

CREATE TABLE IF NOT EXISTS result_versions (
  id BIGSERIAL PRIMARY KEY,
  result_id UUID NOT NULL REFERENCES results(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  snapshot JSONB NOT NULL,
  reason TEXT,
  changed_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------
-- 8. Fees, discounts, receipts, gateway, cash closing (FE, FIN)
-- ---------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS fee_head_seq START 1;
CREATE TABLE IF NOT EXISTS fee_heads (
  id TEXT PRIMARY KEY DEFAULT make_prefixed_id('FH', 'fee_head_seq', 3),
  name TEXT NOT NULL UNIQUE,
  name_bn TEXT,
  code TEXT,
  category TEXT NOT NULL DEFAULT 'Tuition',
  is_refundable BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'Active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE fee_structures
  ADD COLUMN IF NOT EXISTS fee_head_id TEXT,
  ADD COLUMN IF NOT EXISTS section TEXT,
  ADD COLUMN IF NOT EXISTS shift TEXT,
  ADD COLUMN IF NOT EXISTS group_name TEXT,
  ADD COLUMN IF NOT EXISTS late_fine_type TEXT NOT NULL DEFAULT 'None',
  ADD COLUMN IF NOT EXISTS late_fine_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS grace_days INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS installments JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE fee_invoices
  ADD COLUMN IF NOT EXISTS fee_head TEXT,
  ADD COLUMN IF NOT EXISTS late_fine NUMERIC(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS guardian_id TEXT,
  ADD COLUMN IF NOT EXISTS last_reminder_at TIMESTAMPTZ;

CREATE SEQUENCE IF NOT EXISTS discount_seq START 1;
CREATE TABLE IF NOT EXISTS fee_discounts (
  id TEXT PRIMARY KEY DEFAULT make_prefixed_id('DSC', 'discount_seq', 5),
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  fee_head_id TEXT,
  discount_type TEXT NOT NULL
    CHECK (discount_type IN ('Sibling', 'Scholarship', 'Waiver', 'Staff Child', 'Orphan', 'Merit', 'Need Based', 'Lillah', 'Freedom Fighter', 'Other')),
  mode TEXT NOT NULL DEFAULT 'Percent' CHECK (mode IN ('Percent', 'Fixed')),
  value NUMERIC(12, 2) NOT NULL CHECK (value >= 0),
  reason TEXT,
  valid_from DATE,
  valid_to DATE,
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected', 'Expired')),
  requested_by TEXT,
  approved_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE SEQUENCE IF NOT EXISTS receipt_no_seq START 100001;
ALTER TABLE fee_payments
  ADD COLUMN IF NOT EXISTS receipt_no TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'Valid',
  ADD COLUMN IF NOT EXISTS cancelled_reason TEXT,
  ADD COLUMN IF NOT EXISTS cancelled_by TEXT,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS gateway TEXT,
  ADD COLUMN IF NOT EXISTS gateway_txn_id TEXT,
  ADD COLUMN IF NOT EXISTS guardian_id TEXT,
  ADD COLUMN IF NOT EXISTS collector_name TEXT,
  ADD COLUMN IF NOT EXISTS group_ref TEXT;
UPDATE fee_payments SET receipt_no = 'RCPT-' || nextval('receipt_no_seq') WHERE receipt_no IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_fee_payments_receipt ON fee_payments(receipt_no);

CREATE TABLE IF NOT EXISTS gateway_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gateway TEXT NOT NULL,
  txn_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  guardian_id TEXT,
  invoice_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  amount NUMERIC(12, 2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Success', 'Failed', 'Cancelled')),
  posted BOOLEAN NOT NULL DEFAULT FALSE,
  posted_at TIMESTAMPTZ,
  allocations JSONB NOT NULL DEFAULT '[]'::jsonb,
  callback_count INTEGER NOT NULL DEFAULT 0,
  last_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (gateway, txn_id)
);

CREATE TABLE IF NOT EXISTS cash_closings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  closing_date DATE NOT NULL,
  collector_id TEXT NOT NULL,
  collector_name TEXT,
  opening_balance NUMERIC(12, 2) NOT NULL DEFAULT 0,
  system_collection NUMERIC(12, 2) NOT NULL DEFAULT 0,
  cash_counted NUMERIC(12, 2) NOT NULL DEFAULT 0,
  handed_over NUMERIC(12, 2) NOT NULL DEFAULT 0,
  handed_over_to TEXT,
  closing_balance NUMERIC(12, 2) NOT NULL DEFAULT 0,
  mismatch NUMERIC(12, 2) NOT NULL DEFAULT 0,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'Closed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (closing_date, collector_id)
);

CREATE SEQUENCE IF NOT EXISTS refund_seq START 1;
CREATE TABLE IF NOT EXISTS refunds (
  id TEXT PRIMARY KEY DEFAULT make_prefixed_id('RFD', 'refund_seq', 5),
  payment_id TEXT,
  student_id TEXT REFERENCES students(id) ON DELETE SET NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  reason TEXT NOT NULL,
  method TEXT,
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected', 'Paid')),
  requested_by TEXT,
  approved_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------
-- 9. Accounts (ACC-01..07, FIN-14..18)
-- ---------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS account_head_seq START 1;
CREATE TABLE IF NOT EXISTS account_heads (
  id TEXT PRIMARY KEY DEFAULT make_prefixed_id('AH', 'account_head_seq', 4),
  code TEXT UNIQUE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('Income', 'Expense', 'Asset', 'Liability', 'Equity')),
  parent_id TEXT,
  fund TEXT NOT NULL DEFAULT 'General',
  status TEXT NOT NULL DEFAULT 'Active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE SEQUENCE IF NOT EXISTS voucher_seq START 1;
CREATE TABLE IF NOT EXISTS vouchers (
  id TEXT PRIMARY KEY DEFAULT make_prefixed_id('VCH', 'voucher_seq', 6),
  voucher_type TEXT NOT NULL CHECK (voucher_type IN ('Receipt', 'Payment', 'Journal', 'Contra')),
  voucher_date DATE NOT NULL DEFAULT CURRENT_DATE,
  narration TEXT,
  entries JSONB NOT NULL DEFAULT '[]'::jsonb,
  total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  fund TEXT NOT NULL DEFAULT 'General',
  status TEXT NOT NULL DEFAULT 'Posted' CHECK (status IN ('Draft', 'Pending', 'Posted', 'Reversed')),
  reversed_by TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE SEQUENCE IF NOT EXISTS bank_account_seq START 1;
CREATE TABLE IF NOT EXISTS bank_accounts (
  id TEXT PRIMARY KEY DEFAULT make_prefixed_id('BA', 'bank_account_seq', 3),
  bank_name TEXT NOT NULL,
  account_name TEXT NOT NULL,
  account_no TEXT NOT NULL UNIQUE,
  branch TEXT,
  opening_balance NUMERIC(14, 2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bank_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_account_id TEXT NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
  txn_type TEXT NOT NULL CHECK (txn_type IN ('Deposit', 'Withdrawal')),
  amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  txn_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reference TEXT,
  description TEXT,
  reconciled BOOLEAN NOT NULL DEFAULT FALSE,
  reconciled_at DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE financial_transactions
  ADD COLUMN IF NOT EXISTS account_head_id TEXT,
  ADD COLUMN IF NOT EXISTS fund TEXT NOT NULL DEFAULT 'General',
  ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'Approved',
  ADD COLUMN IF NOT EXISTS reversed_of TEXT,
  ADD COLUMN IF NOT EXISTS reversed BOOLEAN NOT NULL DEFAULT FALSE;

-- ---------------------------------------------------------------------
-- 10. HR & payroll (HR-01..10, HRX-01..09)
-- ---------------------------------------------------------------------
ALTER TABLE teachers
  ADD COLUMN IF NOT EXISTS name_bn TEXT,
  ADD COLUMN IF NOT EXISTS designation TEXT DEFAULT 'Assistant Teacher',
  ADD COLUMN IF NOT EXISTS employee_type TEXT DEFAULT 'Permanent',
  ADD COLUMN IF NOT EXISTS gender TEXT,
  ADD COLUMN IF NOT EXISTS blood_group TEXT,
  ADD COLUMN IF NOT EXISTS nid TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS photo_url TEXT,
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS mpo_index TEXT,
  ADD COLUMN IF NOT EXISTS branch_id TEXT,
  ADD COLUMN IF NOT EXISTS rfid_uid TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact TEXT;

ALTER TABLE staff
  ADD COLUMN IF NOT EXISTS name_bn TEXT,
  ADD COLUMN IF NOT EXISTS employee_type TEXT DEFAULT 'Permanent',
  ADD COLUMN IF NOT EXISTS blood_group TEXT,
  ADD COLUMN IF NOT EXISTS nid TEXT,
  ADD COLUMN IF NOT EXISTS education TEXT,
  ADD COLUMN IF NOT EXISTS photo_url TEXT,
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS branch_id TEXT,
  ADD COLUMN IF NOT EXISTS rfid_uid TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact TEXT;

CREATE TABLE IF NOT EXISTS salary_structures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_type TEXT NOT NULL CHECK (employee_type IN ('Teacher', 'Staff')),
  employee_id TEXT NOT NULL,
  employee_name TEXT,
  basic NUMERIC(12, 2) NOT NULL DEFAULT 0,
  house_rent NUMERIC(12, 2) NOT NULL DEFAULT 0,
  medical NUMERIC(12, 2) NOT NULL DEFAULT 0,
  transport NUMERIC(12, 2) NOT NULL DEFAULT 0,
  other_allowance NUMERIC(12, 2) NOT NULL DEFAULT 0,
  provident_fund NUMERIC(12, 2) NOT NULL DEFAULT 0,
  tax NUMERIC(12, 2) NOT NULL DEFAULT 0,
  other_deduction NUMERIC(12, 2) NOT NULL DEFAULT 0,
  govt_portion NUMERIC(12, 2) NOT NULL DEFAULT 0,
  bonus NUMERIC(12, 2) NOT NULL DEFAULT 0,
  per_day_absence_deduction NUMERIC(12, 2) NOT NULL DEFAULT 0,
  bank_account TEXT,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (employee_type, employee_id)
);

CREATE TABLE IF NOT EXISTS salary_advances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_type TEXT NOT NULL,
  employee_id TEXT NOT NULL,
  employee_name TEXT,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  installment NUMERIC(12, 2) NOT NULL DEFAULT 0,
  recovered NUMERIC(12, 2) NOT NULL DEFAULT 0,
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'Active',
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------
-- 11. Communication (CM-01..09, COM-01..07)
-- ---------------------------------------------------------------------
ALTER TABLE notices
  ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'Normal',
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'General',
  ADD COLUMN IF NOT EXISTS target_class TEXT,
  ADD COLUMN IF NOT EXISTS target_section TEXT,
  ADD COLUMN IF NOT EXISTS target_student_id TEXT,
  ADD COLUMN IF NOT EXISTS attachment_url TEXT,
  ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'bn',
  ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'Not Required',
  ADD COLUMN IF NOT EXISTS recipients_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS estimated_cost NUMERIC(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS show_on_board BOOLEAN NOT NULL DEFAULT TRUE;

CREATE TABLE IF NOT EXISTS message_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key TEXT NOT NULL,
  name TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'SMS',
  language TEXT NOT NULL DEFAULT 'bn',
  subject TEXT,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (template_key, channel, language)
);

CREATE TABLE IF NOT EXISTS message_logs (
  id BIGSERIAL PRIMARY KEY,
  channel TEXT NOT NULL CHECK (channel IN ('SMS', 'Email', 'Push', 'Portal')),
  event_type TEXT NOT NULL DEFAULT 'General',
  recipient TEXT,
  recipient_type TEXT,
  recipient_id TEXT,
  student_id TEXT,
  subject TEXT,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Queued' CHECK (status IN ('Queued', 'Sent', 'Delivered', 'Failed', 'Read', 'Skipped')),
  provider TEXT,
  provider_message_id TEXT,
  parts INTEGER NOT NULL DEFAULT 1,
  cost NUMERIC(10, 4) NOT NULL DEFAULT 0,
  attempts INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  related_type TEXT,
  related_id TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_message_logs_status ON message_logs(status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_message_logs_recipient ON message_logs(recipient_type, recipient_id);

CREATE SEQUENCE IF NOT EXISTS complaint_seq START 1;
CREATE TABLE IF NOT EXISTS complaints (
  id TEXT PRIMARY KEY DEFAULT make_prefixed_id('CMP', 'complaint_seq', 5),
  guardian_id TEXT,
  student_id TEXT,
  category TEXT NOT NULL DEFAULT 'General',
  subject TEXT NOT NULL,
  description TEXT,
  assigned_to TEXT,
  status TEXT NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'In Progress', 'Resolved', 'Closed')),
  response TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS messages (
  id BIGSERIAL PRIMARY KEY,
  thread_key TEXT NOT NULL,
  sender_type TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  sender_name TEXT,
  recipient_type TEXT NOT NULL,
  recipient_id TEXT NOT NULL,
  student_id TEXT,
  body TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(thread_key, created_at);

CREATE TABLE IF NOT EXISTS ptm_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id TEXT REFERENCES teachers(id) ON DELETE CASCADE,
  slot_date DATE NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  guardian_id TEXT,
  student_id TEXT,
  status TEXT NOT NULL DEFAULT 'Available' CHECK (status IN ('Available', 'Booked', 'Completed', 'Cancelled')),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------
-- 12. Library, inventory, assets, visitors (OM-01..08)
-- ---------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS book_seq START 1;
CREATE TABLE IF NOT EXISTS library_books (
  id TEXT PRIMARY KEY DEFAULT make_prefixed_id('BK', 'book_seq', 5),
  isbn TEXT,
  title TEXT NOT NULL,
  author TEXT,
  publisher TEXT,
  category TEXT,
  language TEXT,
  shelf TEXT,
  total_copies INTEGER NOT NULL DEFAULT 1 CHECK (total_copies >= 0),
  available_copies INTEGER NOT NULL DEFAULT 1 CHECK (available_copies >= 0),
  price NUMERIC(10, 2),
  status TEXT NOT NULL DEFAULT 'Active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE SEQUENCE IF NOT EXISTS book_issue_seq START 1;
CREATE TABLE IF NOT EXISTS library_issues (
  id TEXT PRIMARY KEY DEFAULT make_prefixed_id('ISS', 'book_issue_seq', 6),
  book_id TEXT NOT NULL REFERENCES library_books(id) ON DELETE CASCADE,
  borrower_type TEXT NOT NULL CHECK (borrower_type IN ('Student', 'Teacher', 'Staff')),
  borrower_id TEXT NOT NULL,
  borrower_name TEXT,
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL,
  return_date DATE,
  fine NUMERIC(10, 2) NOT NULL DEFAULT 0,
  fine_paid BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'Issued' CHECK (status IN ('Issued', 'Returned', 'Lost', 'Overdue')),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE SEQUENCE IF NOT EXISTS supplier_seq START 1;
CREATE TABLE IF NOT EXISTS inventory_suppliers (
  id TEXT PRIMARY KEY DEFAULT make_prefixed_id('SUP', 'supplier_seq', 4),
  name TEXT NOT NULL,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  status TEXT NOT NULL DEFAULT 'Active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE SEQUENCE IF NOT EXISTS item_seq START 1;
CREATE TABLE IF NOT EXISTS inventory_items (
  id TEXT PRIMARY KEY DEFAULT make_prefixed_id('ITM', 'item_seq', 5),
  name TEXT NOT NULL,
  category TEXT,
  unit TEXT NOT NULL DEFAULT 'pcs',
  quantity NUMERIC(12, 2) NOT NULL DEFAULT 0,
  reorder_level NUMERIC(12, 2) NOT NULL DEFAULT 0,
  unit_price NUMERIC(12, 2),
  location TEXT,
  status TEXT NOT NULL DEFAULT 'Active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id TEXT NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  txn_type TEXT NOT NULL CHECK (txn_type IN ('Stock In', 'Stock Out', 'Issue', 'Return', 'Adjustment')),
  quantity NUMERIC(12, 2) NOT NULL CHECK (quantity > 0),
  supplier_id TEXT,
  issued_to TEXT,
  txn_date DATE NOT NULL DEFAULT CURRENT_DATE,
  unit_price NUMERIC(12, 2),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE SEQUENCE IF NOT EXISTS asset_seq START 1;
CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY DEFAULT make_prefixed_id('AST', 'asset_seq', 5),
  name TEXT NOT NULL,
  category TEXT,
  location TEXT,
  purchase_date DATE,
  purchase_value NUMERIC(12, 2),
  condition TEXT NOT NULL DEFAULT 'Good',
  last_maintenance DATE,
  next_maintenance DATE,
  maintenance_log JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'Active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS visitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  purpose TEXT NOT NULL,
  whom_to_meet TEXT,
  id_proof TEXT,
  check_in TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  check_out TIMESTAMPTZ,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS textbook_distributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  academic_year_id TEXT,
  books JSONB NOT NULL DEFAULT '[]'::jsonb,
  distributed_on DATE NOT NULL DEFAULT CURRENT_DATE,
  acknowledged BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS clubs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'Club' CHECK (kind IN ('House', 'Club', 'ECA')),
  advisor_id TEXT,
  points INTEGER NOT NULL DEFAULT 0,
  members JSONB NOT NULL DEFAULT '[]'::jsonb,
  achievements JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------
-- 13. Transport (OM-04, OPS-06/07, GPS tracking)
-- ---------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS vehicle_seq START 1;
CREATE TABLE IF NOT EXISTS transport_vehicles (
  id TEXT PRIMARY KEY DEFAULT make_prefixed_id('VEH', 'vehicle_seq', 3),
  registration_no TEXT NOT NULL UNIQUE,
  vehicle_type TEXT NOT NULL DEFAULT 'Bus',
  capacity INTEGER NOT NULL DEFAULT 40,
  driver_name TEXT,
  driver_phone TEXT,
  helper_name TEXT,
  gps_device_id TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'Active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE SEQUENCE IF NOT EXISTS route_seq START 1;
CREATE TABLE IF NOT EXISTS transport_routes (
  id TEXT PRIMARY KEY DEFAULT make_prefixed_id('RT', 'route_seq', 3),
  name TEXT NOT NULL UNIQUE,
  vehicle_id TEXT REFERENCES transport_vehicles(id) ON DELETE SET NULL,
  stops JSONB NOT NULL DEFAULT '[]'::jsonb,
  monthly_fare NUMERIC(10, 2) NOT NULL DEFAULT 0,
  morning_departure TEXT,
  evening_departure TEXT,
  status TEXT NOT NULL DEFAULT 'Active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transport_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  route_id TEXT NOT NULL REFERENCES transport_routes(id) ON DELETE CASCADE,
  stop_name TEXT,
  monthly_fee NUMERIC(10, 2) NOT NULL DEFAULT 0,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'Active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_transport_active_student
  ON transport_assignments(student_id) WHERE status = 'Active';

CREATE TABLE IF NOT EXISTS vehicle_locations (
  id BIGSERIAL PRIMARY KEY,
  vehicle_id TEXT NOT NULL REFERENCES transport_vehicles(id) ON DELETE CASCADE,
  latitude NUMERIC(10, 7) NOT NULL,
  longitude NUMERIC(10, 7) NOT NULL,
  speed NUMERIC(6, 2),
  heading NUMERIC(6, 2),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_vehicle_locations ON vehicle_locations(vehicle_id, recorded_at DESC);

-- ---------------------------------------------------------------------
-- 14. Madrasa features: halaqa, hifz, salah, hostel, meals, donations
-- ---------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS halaqa_seq START 1;
CREATE TABLE IF NOT EXISTS halaqas (
  id TEXT PRIMARY KEY DEFAULT make_prefixed_id('HLQ', 'halaqa_seq', 3),
  name TEXT NOT NULL UNIQUE,
  ustad_id TEXT REFERENCES teachers(id) ON DELETE SET NULL,
  halaqa_type TEXT NOT NULL DEFAULT 'Hifz' CHECK (halaqa_type IN ('Hifz', 'Nazera', 'Nurani', 'Kitab')),
  room TEXT,
  capacity INTEGER NOT NULL DEFAULT 20,
  status TEXT NOT NULL DEFAULT 'Active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS halaqa_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  halaqa_id TEXT NOT NULL REFERENCES halaqas(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  joined_on DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_id)
);

CREATE TABLE IF NOT EXISTS hifz_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  ustad_id TEXT REFERENCES teachers(id) ON DELETE SET NULL,
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  log_type TEXT NOT NULL DEFAULT 'Hifz' CHECK (log_type IN ('Hifz', 'Nazera')),
  sabak_para INTEGER CHECK (sabak_para BETWEEN 1 AND 30),
  sabak_from TEXT,
  sabak_to TEXT,
  sabqi TEXT,
  amukhta_para TEXT,
  mistakes INTEGER NOT NULL DEFAULT 0,
  tajweed_rating INTEGER CHECK (tajweed_rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_hifz_logs_student ON hifz_logs(student_id, log_date DESC);

CREATE TABLE IF NOT EXISTS hifz_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  para_no INTEGER NOT NULL CHECK (para_no BETWEEN 1 AND 30),
  status TEXT NOT NULL DEFAULT 'Not Started' CHECK (status IN ('Not Started', 'Ongoing', 'Done', 'Revised')),
  completed_at DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, para_no)
);

CREATE TABLE IF NOT EXISTS salah_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  attendance_date DATE NOT NULL,
  wakt TEXT NOT NULL CHECK (wakt IN ('Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha')),
  status TEXT NOT NULL CHECK (status IN ('Jamaat', 'Alone', 'Missed', 'Excused')),
  marked_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, attendance_date, wakt)
);

CREATE SEQUENCE IF NOT EXISTS hostel_room_seq START 1;
CREATE TABLE IF NOT EXISTS hostel_rooms (
  id TEXT PRIMARY KEY DEFAULT make_prefixed_id('HR', 'hostel_room_seq', 4),
  building TEXT NOT NULL,
  room_no TEXT NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 4,
  gender TEXT,
  monthly_fee NUMERIC(10, 2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (building, room_no)
);

CREATE TABLE IF NOT EXISTS hostel_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id TEXT NOT NULL REFERENCES hostel_rooms(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  seat_no TEXT,
  from_date DATE NOT NULL DEFAULT CURRENT_DATE,
  to_date DATE,
  is_lillah BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'Active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_hostel_active_student
  ON hostel_allocations(student_id) WHERE status = 'Active';

CREATE TABLE IF NOT EXISTS meal_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_date DATE NOT NULL,
  meal_type TEXT NOT NULL CHECK (meal_type IN ('Breakfast', 'Lunch', 'Dinner', 'Sehri', 'Iftar')),
  meal_count INTEGER NOT NULL DEFAULT 0,
  bazar_cost NUMERIC(12, 2) NOT NULL DEFAULT 0,
  menu TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (meal_date, meal_type)
);

CREATE SEQUENCE IF NOT EXISTS donor_seq START 1;
CREATE TABLE IF NOT EXISTS donors (
  id TEXT PRIMARY KEY DEFAULT make_prefixed_id('DNR', 'donor_seq', 5),
  name TEXT NOT NULL,
  mobile TEXT,
  email TEXT,
  address TEXT,
  donor_type TEXT NOT NULL DEFAULT 'Individual',
  status TEXT NOT NULL DEFAULT 'Active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE SEQUENCE IF NOT EXISTS donation_seq START 1;
CREATE TABLE IF NOT EXISTS donations (
  id TEXT PRIMARY KEY DEFAULT make_prefixed_id('DON', 'donation_seq', 6),
  donor_id TEXT REFERENCES donors(id) ON DELETE SET NULL,
  donor_name TEXT,
  fund TEXT NOT NULL DEFAULT 'General' CHECK (fund IN ('General', 'Zakat', 'Sadaqah', 'Lillah', 'Development', 'Waqf')),
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  donation_date DATE NOT NULL DEFAULT CURRENT_DATE,
  method TEXT NOT NULL DEFAULT 'Cash',
  reference_no TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------
-- 15. ID cards: templates, issued cards, print jobs (IDC-01..26)
-- ---------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS card_template_seq START 1;
CREATE TABLE IF NOT EXISTS id_card_templates (
  id TEXT PRIMARY KEY DEFAULT make_prefixed_id('TPL', 'card_template_seq', 4),
  template_key TEXT NOT NULL,
  name TEXT NOT NULL,
  audience TEXT NOT NULL CHECK (audience IN ('Student', 'Teacher', 'Staff')),
  category TEXT NOT NULL CHECK (category IN ('Modern', 'Classic', 'Minimal', 'Colorful', 'Formal', 'School-branded')),
  description TEXT,
  orientation TEXT NOT NULL DEFAULT 'portrait' CHECK (orientation IN ('portrait', 'landscape')),
  width_mm NUMERIC(6, 2) NOT NULL DEFAULT 53.98,
  height_mm NUMERIC(6, 2) NOT NULL DEFAULT 85.60,
  front_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  back_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'Published' CHECK (status IN ('Draft', 'Published', 'Archived')),
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  base_template_id TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_card_template_default
  ON id_card_templates(audience) WHERE is_default;

CREATE TABLE IF NOT EXISTS id_card_template_versions (
  id BIGSERIAL PRIMARY KEY,
  template_id TEXT NOT NULL REFERENCES id_card_templates(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  orientation TEXT NOT NULL,
  width_mm NUMERIC(6, 2) NOT NULL,
  height_mm NUMERIC(6, 2) NOT NULL,
  front_config JSONB NOT NULL,
  back_config JSONB NOT NULL,
  published_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (template_id, version)
);

CREATE SEQUENCE IF NOT EXISTS card_number_seq START 1;
CREATE TABLE IF NOT EXISTS id_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  holder_type TEXT NOT NULL CHECK (holder_type IN ('Student', 'Teacher', 'Staff')),
  holder_id TEXT NOT NULL,
  holder_name TEXT,
  template_id TEXT REFERENCES id_card_templates(id) ON DELETE SET NULL,
  template_version INTEGER NOT NULL DEFAULT 1,
  card_number TEXT NOT NULL UNIQUE,
  qr_token TEXT NOT NULL UNIQUE,
  card_version INTEGER NOT NULL DEFAULT 1,
  academic_year_id TEXT,
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until DATE,
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Blocked', 'Expired', 'Replaced')),
  block_reason TEXT,
  replaced_card_id UUID,
  used_placeholder_photo BOOLEAN NOT NULL DEFAULT FALSE,
  snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  print_count INTEGER NOT NULL DEFAULT 0,
  last_printed_at TIMESTAMPTZ,
  issued_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_one_active_card
  ON id_cards(holder_type, holder_id) WHERE status = 'Active';

CREATE SEQUENCE IF NOT EXISTS print_job_seq START 1;
CREATE TABLE IF NOT EXISTS id_card_print_jobs (
  id TEXT PRIMARY KEY DEFAULT make_prefixed_id('PJ', 'print_job_seq', 6),
  holder_type TEXT NOT NULL,
  job_type TEXT NOT NULL DEFAULT 'Bulk' CHECK (job_type IN ('Single', 'Bulk', 'Reprint', 'Replacement')),
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  card_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  card_count INTEGER NOT NULL DEFAULT 0,
  template_id TEXT,
  template_name TEXT,
  template_version INTEGER,
  layout JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'Queued' CHECK (status IN ('Queued', 'Processing', 'Ready', 'Failed', 'Printed')),
  reason TEXT,
  error TEXT,
  file_name TEXT,
  created_by TEXT,
  created_by_name TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------
-- 16. Online classes (ONL-01..03)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS online_classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id TEXT REFERENCES classes(id) ON DELETE CASCADE,
  section TEXT,
  subject_id TEXT REFERENCES subjects(id) ON DELETE SET NULL,
  teacher_id TEXT REFERENCES teachers(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'Google Meet',
  meeting_url TEXT,
  recording_url TEXT,
  scheduled_at TIMESTAMPTZ,
  duration_minutes INTEGER NOT NULL DEFAULT 45,
  status TEXT NOT NULL DEFAULT 'Scheduled',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------
-- updated_at triggers for every new table
-- ---------------------------------------------------------------------
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'branches', 'shifts', 'student_groups', 'rooms', 'approval_requests',
    'approval_delegations', 'saved_report_filters', 'class_subjects',
    'class_teacher_history', 'academic_events', 'homework', 'learning_resources',
    'syllabus_items', 'substitute_assignments', 'guardians', 'guardian_students',
    'enrollments', 'student_documents', 'certificates', 'admission_circulars',
    'period_attendance', 'staff_attendance', 'attendance_devices',
    'biometric_enrollments', 'leave_types', 'leave_requests', 'grade_scales',
    'exam_schedules', 'marks_entry_status', 'results', 'fee_heads',
    'fee_discounts', 'gateway_transactions', 'cash_closings', 'refunds',
    'account_heads', 'vouchers', 'bank_accounts', 'bank_transactions',
    'salary_structures', 'salary_advances', 'message_templates', 'complaints',
    'ptm_slots', 'library_books', 'library_issues', 'inventory_suppliers',
    'inventory_items', 'inventory_transactions', 'assets', 'visitors',
    'textbook_distributions', 'clubs', 'transport_vehicles', 'transport_routes',
    'transport_assignments', 'halaqas', 'halaqa_members', 'hifz_logs',
    'hifz_progress', 'salah_attendance', 'hostel_rooms', 'hostel_allocations',
    'meal_records', 'donors', 'donations', 'id_card_templates', 'id_cards',
    'id_card_print_jobs', 'online_classes'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I_set_updated_at ON %I', t, t);
    EXECUTE format(
      'CREATE TRIGGER %I_set_updated_at BEFORE UPDATE ON %I
       FOR EACH ROW EXECUTE FUNCTION set_updated_at()', t, t);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- Replace the invoice trigger: respect fee heads, discounts and sections
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION auto_generate_student_invoices()
RETURNS TRIGGER AS $$
DECLARE
  fs RECORD;
  inv_due_date DATE;
  inv_billing_month DATE;
  target_class_id TEXT;
  head_name TEXT;
BEGIN
  IF NEW.status IS DISTINCT FROM 'Active' THEN
    RETURN NEW;
  END IF;
  inv_billing_month := date_trunc('month', CURRENT_DATE)::DATE;
  target_class_id := NEW.class_id;
  IF target_class_id IS NULL AND NEW.class_name IS NOT NULL THEN
    SELECT id INTO target_class_id FROM classes WHERE name = split_part(NEW.class_name, '-', 1);
  END IF;

  FOR fs IN
    SELECT * FROM fee_structures
    WHERE status = 'Active'
      AND (class_id = target_class_id OR class_id IS NULL)
      AND (section IS NULL OR section = '' OR section = NEW.section)
      AND (frequency IN ('Monthly', 'One-time', 'Yearly'))
  LOOP
    inv_due_date := make_date(
      date_part('year', CURRENT_DATE)::int,
      date_part('month', CURRENT_DATE)::int,
      LEAST(COALESCE(fs.due_day, 10), 28)
    );
    SELECT name INTO head_name FROM fee_heads WHERE id = fs.fee_head_id;
    INSERT INTO fee_invoices (student_id, fee_structure_id, billing_month, due_date, amount, status, fee_head)
    VALUES (NEW.id, fs.id, inv_billing_month, inv_due_date, fs.amount, 'Due', COALESCE(head_name, fs.name));
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
