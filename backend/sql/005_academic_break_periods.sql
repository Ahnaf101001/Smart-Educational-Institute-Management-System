ALTER TABLE academic_settings
  ADD COLUMN IF NOT EXISTS break_after_periods JSONB NOT NULL DEFAULT '[3, 6]'::jsonb;

ALTER TABLE academic_settings
  ADD COLUMN IF NOT EXISTS break_duration_minutes INTEGER NOT NULL DEFAULT 15;
