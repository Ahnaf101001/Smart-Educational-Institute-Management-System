CREATE TABLE institute_profile (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  name TEXT NOT NULL DEFAULT 'EduManage School & College',
  type TEXT NOT NULL DEFAULT 'School + College + Madrasa',
  eiin TEXT NOT NULL DEFAULT '123456',
  phone TEXT NOT NULL DEFAULT '01XX-XXXXXXXX',
  email TEXT NOT NULL DEFAULT 'info@school.edu',
  website TEXT NOT NULL DEFAULT 'www.school.edu',
  established_year TEXT NOT NULL DEFAULT '1995',
  capacity TEXT NOT NULL DEFAULT '3000',
  address TEXT NOT NULL DEFAULT '123 Education Road, Dhaka, Bangladesh',
  logo_url TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE system_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  email_notif BOOLEAN NOT NULL DEFAULT TRUE,
  sms_notif BOOLEAN NOT NULL DEFAULT TRUE,
  system_alerts BOOLEAN NOT NULL DEFAULT TRUE,
  newsletter BOOLEAN NOT NULL DEFAULT FALSE,
  auto_backup TEXT NOT NULL DEFAULT 'Daily at 2:00 AM',
  backup_retention TEXT NOT NULL DEFAULT '30 days',
  session_timeout TEXT NOT NULL DEFAULT '30 minutes',
  two_factor_auth TEXT NOT NULL DEFAULT 'Enabled for Admins',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE SEQUENCE IF NOT EXISTS role_id_seq START 1;
CREATE TABLE roles (
  id TEXT PRIMARY KEY DEFAULT ('ROL-' || LPAD(nextval('role_id_seq')::TEXT, 3, '0')),
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL DEFAULT 'bg-slate-100 text-slate-700',
  permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default roles
INSERT INTO roles (name, color, permissions) VALUES
('Super Admin', 'bg-red-50 text-red-600', '["Dashboard", "Students", "Teachers", "Fees", "Accounts", "Reports", "Settings", "All Modules"]'::jsonb),
('Institute Admin', 'bg-purple-50 text-purple-600', '["Dashboard", "Students", "Teachers", "Admission", "Fees", "Accounts", "Reports"]'::jsonb),
('Teacher', 'bg-blue-50 text-blue-600', '["Dashboard", "Attendance (own classes)", "Marks Entry", "Routine"]'::jsonb),
('Accountant', 'bg-emerald-50 text-emerald-600', '["Dashboard", "Fee Collection", "Accounts", "Payroll", "Financial Reports"]'::jsonb),
('Staff', 'bg-slate-100 text-slate-700', '["Dashboard (limited)", "View own profile"]'::jsonb);

-- Remove the hardcoded role check constraint from users table
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

-- Seed the initial config rows
INSERT INTO institute_profile (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
INSERT INTO system_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
