-- AeroSchool Guardian App – closes the gaps found in the requirements audit.

-- K18: remember why a guardian–student link was disabled so that automatic
-- disabling (student transferred / dropped / passed out) can be undone when the
-- student becomes Active again, without re-enabling links an admin disabled.
ALTER TABLE guardian_students ADD COLUMN IF NOT EXISTS disabled_reason TEXT;

-- H7: device tokens for background push (Firebase Cloud Messaging).
CREATE TABLE IF NOT EXISTS guardian_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  guardian_id TEXT REFERENCES guardians(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  platform TEXT,
  app_version TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS guardian_devices_guardian_idx ON guardian_devices (guardian_id);

-- F6 / J6: school-controlled visibility for guardians.
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS show_class_position BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS show_teacher_phone_to_guardians BOOLEAN NOT NULL DEFAULT TRUE;

-- I2: separate drop-off stop (falls back to the pickup stop when empty).
ALTER TABLE transport_assignments ADD COLUMN IF NOT EXISTS dropoff_stop TEXT;

-- I5: one bus-arrival alert per route, stop, day and trip.
CREATE TABLE IF NOT EXISTS bus_arrival_alerts (
  route_id TEXT NOT NULL,
  stop_name TEXT NOT NULL,
  alert_date DATE NOT NULL,
  trip TEXT NOT NULL,
  vehicle_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (route_id, stop_name, alert_date, trip)
);

-- G4: where the gateway should send the payer back (web result page or the app's deep link).
ALTER TABLE gateway_transactions ADD COLUMN IF NOT EXISTS return_url TEXT;

-- D4: explicit early-leave attendance status.
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_status_check;
ALTER TABLE attendance ADD CONSTRAINT attendance_status_check
  CHECK (status = ANY (ARRAY['Present', 'Absent', 'Late', 'Leave', 'Early Leave']));

-- E4: explicit class-test type for homework / assessments.
ALTER TABLE homework DROP CONSTRAINT IF EXISTS homework_kind_check;
ALTER TABLE homework ADD CONSTRAINT homework_kind_check
  CHECK (kind = ANY (ARRAY['Homework', 'Assignment', 'Project', 'Class Test']));
