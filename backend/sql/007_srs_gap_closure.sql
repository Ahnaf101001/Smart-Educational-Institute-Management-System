-- 007: Closes the remaining requirement gaps found in the SRS v1.0 / v3.0 /
-- feature-list audit. Every statement is idempotent.

-- ---------------------------------------------------------------- access (RP-10/11/13, GA-01/05)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS gender_scope TEXT NOT NULL DEFAULT 'All',
  ADD COLUMN IF NOT EXISTS is_support BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS access_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pin_hash TEXT,
  ADD COLUMN IF NOT EXISTS quiet_hours JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE roles ADD COLUMN IF NOT EXISTS allowed_ips TEXT[] NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  user_agent TEXT,
  ip TEXT,
  method TEXT NOT NULL DEFAULT 'password',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id, revoked_at);

-- ---------------------------------------------------------------- approvals (RP-15/16/18)
CREATE TABLE IF NOT EXISTS approval_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_type TEXT NOT NULL,
  min_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  -- [{ "label": "Principal", "module": "accounts" }, { "label": "Committee President", "role": "Committee President" }]
  levels JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'Active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE approval_requests
  ADD COLUMN IF NOT EXISTS total_levels INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS level_chain JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS last_reminded_at TIMESTAMPTZ;

-- ---------------------------------------------------------------- settings
ALTER TABLE system_settings
  ADD COLUMN IF NOT EXISTS max_discount_percent NUMERIC(5, 2) NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS allow_discount_stacking BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS approval_escalation_hours INTEGER NOT NULL DEFAULT 48,
  ADD COLUMN IF NOT EXISTS sms_fallback_channel TEXT,
  ADD COLUMN IF NOT EXISTS form_fillup_block_on_test_fail BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS late_days_per_deduction INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS half_day_counts_as NUMERIC(3, 2) NOT NULL DEFAULT 0.5,
  ADD COLUMN IF NOT EXISTS teacher_quiet_hours JSONB NOT NULL DEFAULT '{"enabled": false, "start": "18:00", "end": "08:00"}'::jsonb;

-- ---------------------------------------------------------------- students (ST-01, ST-11, ACA-02, PC-13)
ALTER TABLE students
  ADD COLUMN IF NOT EXISTS division TEXT,
  ADD COLUMN IF NOT EXISTS district TEXT,
  ADD COLUMN IF NOT EXISTS upazila TEXT,
  ADD COLUMN IF NOT EXISTS post_office TEXT,
  ADD COLUMN IF NOT EXISTS allergies TEXT,
  ADD COLUMN IF NOT EXISTS special_needs TEXT,
  ADD COLUMN IF NOT EXISTS medical_notes TEXT;

ALTER TABLE guardians ADD COLUMN IF NOT EXISTS notification_prefs JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS student_group_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id TEXT NOT NULL,
  from_group TEXT,
  to_group TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE OR REPLACE FUNCTION track_group_change() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.group_name IS DISTINCT FROM OLD.group_name THEN
    INSERT INTO student_group_history (student_id, from_group, to_group) VALUES (NEW.id, OLD.group_name, NEW.group_name);
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_student_group_history ON students;
CREATE TRIGGER trg_student_group_history AFTER UPDATE OF group_name ON students
  FOR EACH ROW EXECUTE FUNCTION track_group_change();

CREATE TABLE IF NOT EXISTS branch_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_type TEXT NOT NULL CHECK (person_type IN ('Student', 'Teacher', 'Staff')),
  person_id TEXT NOT NULL,
  from_branch_id TEXT,
  to_branch_id TEXT NOT NULL,
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reason TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------- academic (AC-10, AC-12, OC-02, ONL-03, EM-05)
CREATE TABLE IF NOT EXISTS special_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  from_date DATE NOT NULL,
  to_date DATE NOT NULL,
  shift TEXT,
  periods JSONB NOT NULL DEFAULT '[]'::jsonb,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'Active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS homework_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  homework_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Submitted' CHECK (status IN ('Submitted', 'Not Submitted', 'Late', 'Excused')),
  marks NUMERIC(6, 2),
  remarks TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  marked_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (homework_id, student_id)
);

CREATE TABLE IF NOT EXISTS online_class_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  online_class_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  joined_by TEXT,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (online_class_id, student_id)
);

CREATE TABLE IF NOT EXISTS quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  class_id TEXT,
  section TEXT,
  subject_id TEXT,
  teacher_id TEXT,
  -- [{ "q": "...", "options": ["a","b","c","d"], "answer": 1, "marks": 1 }]
  questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  duration_minutes INTEGER NOT NULL DEFAULT 20,
  opens_at TIMESTAMPTZ,
  closes_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Published', 'Closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS quiz_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  answers JSONB NOT NULL DEFAULT '[]'::jsonb,
  score NUMERIC(6, 2) NOT NULL DEFAULT 0,
  max_score NUMERIC(6, 2) NOT NULL DEFAULT 0,
  submitted_by TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (quiz_id, student_id)
);

CREATE TABLE IF NOT EXISTS coursework (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'Coursework',
  class_id TEXT,
  subject_id TEXT,
  teacher_id TEXT,
  description TEXT,
  deadline DATE,
  max_marks NUMERIC(6, 2) NOT NULL DEFAULT 100,
  status TEXT NOT NULL DEFAULT 'Open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS coursework_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coursework_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  submitted_on DATE,
  marks NUMERIC(6, 2),
  grade TEXT,
  feedback TEXT,
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Submitted', 'Late', 'Graded', 'Missing')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (coursework_id, student_id)
);

-- ---------------------------------------------------------------- exams (EX-03 seat plan, EM-06 skills)
CREATE TABLE IF NOT EXISTS exam_seat_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id TEXT NOT NULL,
  room TEXT NOT NULL,
  seat_no INTEGER NOT NULL,
  student_id TEXT NOT NULL,
  student_name TEXT,
  class_name TEXT,
  roll TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (exam_id, student_id),
  UNIQUE (exam_id, room, seat_no)
);
ALTER TABLE results ADD COLUMN IF NOT EXISTS skill_ratings JSONB NOT NULL DEFAULT '{}'::jsonb;

-- ---------------------------------------------------------------- board & government (BM-05..09, AM-03/04, QM-04, EM-02..04)
CREATE TABLE IF NOT EXISTS board_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id TEXT NOT NULL,
  board TEXT NOT NULL,
  exam_level TEXT NOT NULL,
  exam_year TEXT,
  exam_session TEXT,
  registration_no TEXT,
  candidate_no TEXT,
  centre TEXT,
  subjects JSONB NOT NULL DEFAULT '[]'::jsonb,
  entry_fee NUMERIC(12, 2) NOT NULL DEFAULT 0,
  predicted_grades JSONB NOT NULL DEFAULT '{}'::jsonb,
  form_fillup_status TEXT NOT NULL DEFAULT 'Pending' CHECK (form_fillup_status IN ('Pending', 'Eligible', 'Blocked', 'Submitted')),
  block_reason TEXT,
  status TEXT NOT NULL DEFAULT 'Draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, exam_level, exam_year)
);
CREATE TABLE IF NOT EXISTS board_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id TEXT NOT NULL,
  board TEXT,
  exam_level TEXT NOT NULL,
  passing_year TEXT NOT NULL,
  roll_no TEXT,
  registration_no TEXT,
  gpa NUMERIC(4, 2),
  grade TEXT,
  subjects JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, exam_level, passing_year)
);
CREATE TABLE IF NOT EXISTS stipend_beneficiaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id TEXT NOT NULL,
  program TEXT NOT NULL DEFAULT 'Upobritti',
  academic_year_id TEXT,
  mobile_banking_provider TEXT,
  mobile_banking_number TEXT,
  account_holder TEXT,
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------- English medium / pre-school (EM-07, EM-10)
CREATE TABLE IF NOT EXISTS house_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id TEXT NOT NULL,
  student_id TEXT,
  points INTEGER NOT NULL,
  reason TEXT,
  awarded_by TEXT,
  awarded_on DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE OR REPLACE FUNCTION sync_house_points() RETURNS TRIGGER AS $$
DECLARE target TEXT := COALESCE(NEW.club_id, OLD.club_id);
BEGIN
  UPDATE clubs SET points = (SELECT COALESCE(SUM(points), 0) FROM house_points WHERE club_id = target) WHERE id::text = target;
  RETURN NULL;
END $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_house_points ON house_points;
CREATE TRIGGER trg_house_points AFTER INSERT OR UPDATE OR DELETE ON house_points FOR EACH ROW EXECUTE FUNCTION sync_house_points();

CREATE TABLE IF NOT EXISTS daily_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id TEXT NOT NULL,
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  meal TEXT,
  nap TEXT,
  activity TEXT,
  mood TEXT,
  photo_url TEXT,
  note TEXT,
  teacher_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, log_date)
);

-- ---------------------------------------------------------------- madrasa (QM-16)
CREATE TABLE IF NOT EXISTS hifz_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id TEXT NOT NULL,
  target_month TEXT NOT NULL,
  target_pages NUMERIC(6, 1) NOT NULL DEFAULT 20,
  note TEXT,
  alerted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, target_month)
);

-- ---------------------------------------------------------------- staff attendance location (AT-10)
ALTER TABLE staff_attendance
  ADD COLUMN IF NOT EXISTS latitude NUMERIC(9, 6),
  ADD COLUMN IF NOT EXISTS longitude NUMERIC(9, 6),
  ADD COLUMN IF NOT EXISTS late_minutes INTEGER NOT NULL DEFAULT 0;

-- ---------------------------------------------------------------- integrations (OM-11, NF-20, NF-22)
CREATE TABLE IF NOT EXISTS report_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  report_type TEXT NOT NULL,
  frequency TEXT NOT NULL DEFAULT 'Daily' CHECK (frequency IN ('Daily', 'Weekly', 'Monthly')),
  send_hour INTEGER NOT NULL DEFAULT 20,
  recipients TEXT[] NOT NULL DEFAULT '{}',
  last_run_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'Active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  key_prefix TEXT NOT NULL UNIQUE,
  api_key_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'Principal',
  can_write BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'Active',
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  events TEXT[] NOT NULL DEFAULT '{*}',
  secret TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Active',
  last_status INTEGER,
  last_error TEXT,
  last_delivery_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id TEXT NOT NULL,
  event TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status_code INTEGER,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- WhatsApp channel (NF-20 / §34)
ALTER TABLE message_logs DROP CONSTRAINT IF EXISTS message_logs_channel_check;
ALTER TABLE message_logs ADD CONSTRAINT message_logs_channel_check CHECK (channel IN ('SMS', 'Email', 'Push', 'Portal', 'WhatsApp'));

-- updated_at triggers for the new tables (same helper used by earlier migrations)
DO $$
DECLARE t TEXT;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at') THEN
    FOREACH t IN ARRAY ARRAY['approval_rules','student_group_history','branch_transfers','special_schedules','homework_submissions',
      'online_class_attendance','quizzes','quiz_attempts','coursework','coursework_submissions','exam_seat_plans','board_registrations',
      'board_results','stipend_beneficiaries','house_points','daily_logs','hifz_targets','report_schedules','api_keys','webhooks'] LOOP
      EXECUTE format('DROP TRIGGER IF EXISTS trg_%1$s_updated_at ON %1$s', t);
      EXECUTE format('CREATE TRIGGER trg_%1$s_updated_at BEFORE UPDATE ON %1$s FOR EACH ROW EXECUTE FUNCTION set_updated_at()', t);
    END LOOP;
  END IF;
END $$;
