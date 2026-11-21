-- AeroSchool Guardian Mobile App support.
-- * Admin-created guardian accounts log in with email + temporary password and must
--   change that password on first sign-in.
-- * Per-link permissions let the school hide results or fees from one guardian of a
--   student (e.g. a non-custodial parent) without unlinking them.

ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ;

ALTER TABLE guardian_students ADD COLUMN IF NOT EXISTS can_view_results BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE guardian_students ADD COLUMN IF NOT EXISTS can_view_fees BOOLEAN NOT NULL DEFAULT TRUE;

-- Guardian login emails must be unique (case-insensitive) across all users.
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_unique ON users (LOWER(email)) WHERE email IS NOT NULL;
