CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE SEQUENCE IF NOT EXISTS user_id_seq START 2;
CREATE SEQUENCE IF NOT EXISTS student_id_seq START 4001;
CREATE SEQUENCE IF NOT EXISTS admission_id_seq START 4101;
CREATE SEQUENCE IF NOT EXISTS teacher_id_seq START 1001;
CREATE SEQUENCE IF NOT EXISTS staff_id_seq START 1;
CREATE SEQUENCE IF NOT EXISTS class_id_seq START 1;
CREATE SEQUENCE IF NOT EXISTS subject_id_seq START 1;
CREATE SEQUENCE IF NOT EXISTS year_id_seq START 1;
CREATE SEQUENCE IF NOT EXISTS assignment_id_seq START 1;
CREATE SEQUENCE IF NOT EXISTS exam_id_seq START 1;
CREATE SEQUENCE IF NOT EXISTS mark_id_seq START 1;
CREATE SEQUENCE IF NOT EXISTS fee_structure_id_seq START 1;
CREATE SEQUENCE IF NOT EXISTS invoice_id_seq START 1;
CREATE SEQUENCE IF NOT EXISTS payment_id_seq START 1;
CREATE SEQUENCE IF NOT EXISTS transaction_id_seq START 1;
CREATE SEQUENCE IF NOT EXISTS payroll_id_seq START 1;
CREATE SEQUENCE IF NOT EXISTS notice_id_seq START 1;
CREATE SEQUENCE IF NOT EXISTS attendance_id_seq START 1;

CREATE TABLE users (
  id TEXT PRIMARY KEY DEFAULT ('USR-' || nextval('user_id_seq')),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin'
    CHECK (role IN ('admin', 'teacher', 'accountant', 'staff')),
  status TEXT NOT NULL DEFAULT 'Active'
    CHECK (status IN ('Active', 'Inactive')),
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE teachers (
  id TEXT PRIMARY KEY DEFAULT ('TCH-' || nextval('teacher_id_seq')),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL,
  department TEXT,
  qualification TEXT,
  phone TEXT,
  email TEXT UNIQUE,
  join_date DATE,
  experience INTEGER NOT NULL DEFAULT 0 CHECK (experience >= 0),
  subjects JSONB NOT NULL DEFAULT '[]'::jsonb,
  salary NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (salary >= 0),
  classes INTEGER NOT NULL DEFAULT 0 CHECK (classes >= 0),
  rating NUMERIC(2, 1) NOT NULL DEFAULT 0 CHECK (rating BETWEEN 0 AND 5),
  status TEXT NOT NULL DEFAULT 'Active',
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE staff (
  id TEXT PRIMARY KEY DEFAULT ('STF-' || LPAD(nextval('staff_id_seq')::TEXT, 3, '0')),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL,
  designation TEXT,
  department TEXT,
  phone TEXT,
  email TEXT UNIQUE,
  join_date DATE,
  shift TEXT,
  salary NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (salary >= 0),
  gender TEXT,
  address TEXT,
  status TEXT NOT NULL DEFAULT 'Active',
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE academic_years (
  id TEXT PRIMARY KEY DEFAULT ('YEAR-' || LPAD(nextval('year_id_seq')::TEXT, 3, '0')),
  name TEXT NOT NULL UNIQUE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  sessions INTEGER NOT NULL DEFAULT 1 CHECK (sessions > 0),
  status TEXT NOT NULL DEFAULT 'Upcoming',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_date >= start_date)
);

CREATE TABLE classes (
  id TEXT PRIMARY KEY DEFAULT ('CLS-' || LPAD(nextval('class_id_seq')::TEXT, 3, '0')),
  name TEXT NOT NULL UNIQUE,
  level TEXT,
  sections JSONB NOT NULL DEFAULT '[]'::jsonb,
  students INTEGER NOT NULL DEFAULT 0 CHECK (students >= 0),
  teacher_id TEXT REFERENCES teachers(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'Active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE subjects (
  id TEXT PRIMARY KEY DEFAULT ('SUB-' || LPAD(nextval('subject_id_seq')::TEXT, 3, '0')),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  type TEXT,
  class_range TEXT,
  teacher_id TEXT REFERENCES teachers(id) ON DELETE SET NULL,
  credit NUMERIC(4, 1) NOT NULL DEFAULT 0 CHECK (credit >= 0),
  status TEXT NOT NULL DEFAULT 'Active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE students (
  id TEXT PRIMARY KEY DEFAULT ('STU-' || nextval('student_id_seq')),
  roll TEXT,
  name TEXT NOT NULL,
  gender TEXT,
  class_name TEXT,
  class_id TEXT REFERENCES classes(id) ON DELETE SET NULL,
  section TEXT,
  parent_contact TEXT,
  date_of_birth DATE,
  admission_date DATE,
  address TEXT,
  email TEXT,
  phone TEXT,
  guardian_name TEXT,
  source_applicant_id TEXT,
  status TEXT NOT NULL DEFAULT 'Active',
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE admissions (
  id TEXT PRIMARY KEY DEFAULT ('APP-' || nextval('admission_id_seq')),
  initials TEXT,
  name TEXT NOT NULL,
  gender TEXT,
  class_name TEXT,
  application_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'Pending',
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  student_id TEXT REFERENCES students(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE students
  ADD CONSTRAINT students_source_applicant_fk
  FOREIGN KEY (source_applicant_id) REFERENCES admissions(id) ON DELETE SET NULL;

CREATE TABLE academic_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  working_days INTEGER NOT NULL DEFAULT 6,
  start_time TEXT NOT NULL DEFAULT '08:00 AM',
  end_time TEXT NOT NULL DEFAULT '02:30 PM',
  periods_per_day INTEGER NOT NULL DEFAULT 8,
  period_duration INTEGER NOT NULL DEFAULT 45,
  break_after_periods JSONB NOT NULL DEFAULT '[3, 6]'::jsonb,
  break_duration_minutes INTEGER NOT NULL DEFAULT 15,
  grading_system TEXT NOT NULL DEFAULT 'GPA (0-5)',
  pass_marks TEXT NOT NULL DEFAULT '33%',
  promotion_policy TEXT NOT NULL DEFAULT 'Annual',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE class_assignments (
  id TEXT PRIMARY KEY DEFAULT ('ASN-' || LPAD(nextval('assignment_id_seq')::TEXT, 3, '0')),
  class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  section TEXT NOT NULL,
  subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  teacher_id TEXT REFERENCES teachers(id) ON DELETE SET NULL,
  room_no TEXT,
  students INTEGER NOT NULL DEFAULT 0 CHECK (students >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (class_id, section, subject_id)
);

CREATE TABLE exams (
  id TEXT PRIMARY KEY DEFAULT ('EXM-' || LPAD(nextval('exam_id_seq')::TEXT, 3, '0')),
  name TEXT NOT NULL,
  academic_year_id TEXT REFERENCES academic_years(id) ON DELETE SET NULL,
  start_date DATE,
  end_date DATE,
  status TEXT NOT NULL DEFAULT 'Scheduled',
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE marks (
  id TEXT PRIMARY KEY DEFAULT ('MRK-' || LPAD(nextval('mark_id_seq')::TEXT, 6, '0')),
  exam_id TEXT REFERENCES exams(id) ON DELETE CASCADE,
  exam TEXT NOT NULL,
  class_id TEXT,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  marks_obtained NUMERIC(6, 2) NOT NULL DEFAULT 0 CHECK (marks_obtained >= 0),
  full_marks NUMERIC(6, 2) NOT NULL DEFAULT 100 CHECK (full_marks > 0),
  pass_marks NUMERIC(6, 2) NOT NULL DEFAULT 33 CHECK (pass_marks >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (exam, student_id, subject_id)
);

CREATE TABLE attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_name TEXT NOT NULL,
  attendance_date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Present', 'Absent', 'Late', 'Leave')),
  note TEXT,
  marked_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, attendance_date)
);

CREATE TABLE fee_structures (
  id TEXT PRIMARY KEY DEFAULT ('FST-' || LPAD(nextval('fee_structure_id_seq')::TEXT, 5, '0')),
  name TEXT NOT NULL,
  class_id TEXT REFERENCES classes(id) ON DELETE CASCADE,
  academic_year_id TEXT REFERENCES academic_years(id) ON DELETE CASCADE,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  frequency TEXT NOT NULL DEFAULT 'Monthly',
  due_day INTEGER CHECK (due_day BETWEEN 1 AND 31),
  components JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'Active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE fee_invoices (
  id TEXT PRIMARY KEY DEFAULT ('INV-' || LPAD(nextval('invoice_id_seq')::TEXT, 6, '0')),
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  fee_structure_id TEXT REFERENCES fee_structures(id) ON DELETE SET NULL,
  billing_month DATE,
  due_date DATE,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  discount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (discount >= 0),
  paid_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
  status TEXT NOT NULL DEFAULT 'Due'
    CHECK (status IN ('Due', 'Overdue', 'Partial', 'Paid', 'Cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE fee_payments (
  id TEXT PRIMARY KEY DEFAULT ('PAY-' || LPAD(nextval('payment_id_seq')::TEXT, 6, '0')),
  invoice_id TEXT NOT NULL REFERENCES fee_invoices(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  payment_method TEXT NOT NULL,
  reference_no TEXT,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  received_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE financial_transactions (
  id TEXT PRIMARY KEY DEFAULT ('TRX-' || LPAD(nextval('transaction_id_seq')::TEXT, 6, '0')),
  type TEXT NOT NULL CHECK (type IN ('Income', 'Expense')),
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  payment_method TEXT,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'Completed',
  reference_no TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE payroll_records (
  id TEXT PRIMARY KEY DEFAULT ('PRL-' || LPAD(nextval('payroll_id_seq')::TEXT, 6, '0')),
  employee_type TEXT NOT NULL CHECK (employee_type IN ('Teacher', 'Staff')),
  employee_id TEXT NOT NULL,
  employee_name TEXT NOT NULL,
  role TEXT,
  department TEXT,
  payroll_month DATE NOT NULL,
  basic_salary NUMERIC(12, 2) NOT NULL DEFAULT 0,
  allowances NUMERIC(12, 2) NOT NULL DEFAULT 0,
  deductions NUMERIC(12, 2) NOT NULL DEFAULT 0,
  net_pay NUMERIC(12, 2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Pending'
    CHECK (status IN ('Pending', 'Paid', 'Cancelled')),
  paid_at TIMESTAMPTZ,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (employee_type, employee_id, payroll_month)
);

CREATE TABLE routine_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  section TEXT NOT NULL,
  day_of_week TEXT NOT NULL,
  period_code TEXT NOT NULL,
  start_time TIME,
  end_time TIME,
  subject_id TEXT REFERENCES subjects(id) ON DELETE SET NULL,
  teacher_id TEXT REFERENCES teachers(id) ON DELETE SET NULL,
  room_no TEXT,
  is_break BOOLEAN NOT NULL DEFAULT FALSE,
  label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (class_id, section, day_of_week, period_code)
);

CREATE TABLE notices (
  id TEXT PRIMARY KEY DEFAULT ('NTC-' || LPAD(nextval('notice_id_seq')::TEXT, 5, '0')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'Notice',
  audience TEXT NOT NULL DEFAULT 'All',
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'Draft',
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE application_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_key TEXT NOT NULL UNIQUE,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_students_class_name ON students(class_name);
CREATE INDEX idx_students_status ON students(status);
CREATE INDEX idx_admissions_status ON admissions(status);
CREATE INDEX idx_marks_exam_student ON marks(exam, student_id);
CREATE INDEX idx_attendance_class_date ON attendance(class_name, attendance_date);
CREATE INDEX idx_invoices_student_status ON fee_invoices(student_id, status);
CREATE INDEX idx_payments_student_date ON fee_payments(student_id, paid_at);
CREATE INDEX idx_transactions_type_date ON financial_transactions(type, transaction_date);
CREATE INDEX idx_payroll_month_status ON payroll_records(payroll_month, status);
CREATE INDEX idx_routine_class_section ON routine_entries(class_id, section);

DO $$
DECLARE table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'users', 'teachers', 'staff', 'academic_years', 'classes', 'subjects',
    'students', 'admissions', 'class_assignments', 'exams', 'marks',
    'attendance', 'fee_structures', 'fee_invoices', 'financial_transactions',
    'payroll_records', 'routine_entries', 'notices', 'application_drafts'
  ]
  LOOP
    EXECUTE format(
      'CREATE TRIGGER %I_set_updated_at BEFORE UPDATE ON %I
       FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
      table_name, table_name
    );
  END LOOP;
END $$;
