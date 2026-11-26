-- 011: remaining scope from the 26 Nov 2026 progress reports (all additive; existing behaviour unchanged by default).

-- RP-19: Super Admin self-approval override as an explicit policy switch. TRUE keeps today's behaviour
-- (an administrator may decide own requests, flagged "Own request"); FALSE enforces strict maker-checker
-- for administrators too.
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS admin_self_approval BOOLEAN NOT NULL DEFAULT TRUE;

-- NF-43: mandatory two-step sign-in (SMS OTP) for administrator accounts. Off by default because it needs a
-- working SMS provider; accounts without a mobile number are let in and told to add one.
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS enforce_admin_two_factor BOOLEAN NOT NULL DEFAULT FALSE;

-- EM-08: club / house / ECA session attendance.
CREATE TABLE IF NOT EXISTS club_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  session_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'Present' CHECK (status IN ('Present', 'Absent', 'Late', 'Excused')),
  activity TEXT,
  note TEXT,
  marked_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (club_id, student_id, session_date)
);
CREATE INDEX IF NOT EXISTS club_attendance_student_idx ON club_attendance (student_id, session_date DESC);

-- OM-05 / OPS-01 / OM-05v1: photo gallery (albums of event photos) for the website, guardian portal and app.
CREATE TABLE IF NOT EXISTS gallery_albums (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  title_bn TEXT,
  description TEXT,
  event_date DATE,
  cover_url TEXT,
  audience TEXT NOT NULL DEFAULT 'Guardians' CHECK (audience IN ('Public', 'Guardians', 'Staff')),
  status TEXT NOT NULL DEFAULT 'Published' CHECK (status IN ('Draft', 'Published')),
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS gallery_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  album_id TEXT NOT NULL,
  image_url TEXT NOT NULL,
  caption TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS gallery_photos_album_idx ON gallery_photos (album_id, sort_order);

-- Deleting an album removes its photo rows too (album_id is TEXT like the other generic-CRUD links).
CREATE OR REPLACE FUNCTION delete_gallery_album_photos() RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM gallery_photos WHERE album_id = OLD.id::text;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS gallery_albums_delete_photos ON gallery_albums;
CREATE TRIGGER gallery_albums_delete_photos AFTER DELETE ON gallery_albums
  FOR EACH ROW EXECUTE FUNCTION delete_gallery_album_photos();

-- updated_at triggers for the new tables (same helper as the earlier migrations).
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['club_attendance', 'gallery_albums', 'gallery_photos'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I_set_updated_at ON %I', t, t);
    EXECUTE format('CREATE TRIGGER %I_set_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()', t, t);
  END LOOP;
END $$;
