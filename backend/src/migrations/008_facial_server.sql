ALTER TABLE drivers ADD COLUMN IF NOT EXISTS face_enrolled BOOLEAN DEFAULT false;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS face_template_ref VARCHAR(255);
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS face_consent_at TIMESTAMPTZ;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS face_consent_version VARCHAR(20);

ALTER TABLE fueling_sessions ADD COLUMN IF NOT EXISTS facial_verified_at TIMESTAMPTZ;
ALTER TABLE fueling_sessions ADD COLUMN IF NOT EXISTS facial_attempt_id INTEGER REFERENCES facial_attempts(id) ON DELETE SET NULL;
ALTER TABLE fueling_sessions ADD COLUMN IF NOT EXISTS facial_consumed_at TIMESTAMPTZ;
ALTER TABLE fueling_sessions ADD COLUMN IF NOT EXISTS ble_confirmed_at TIMESTAMPTZ;

ALTER TABLE security_events ALTER COLUMN truck_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_facial_attempts_driver_id_created_at ON facial_attempts(driver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_facial_attempts_session_id ON facial_attempts(session_id);
