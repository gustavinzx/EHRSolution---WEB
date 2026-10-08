-- 004_fix_data_source.sql

-- Updates para legacy
UPDATE fueling_logs SET data_source = 'legacy' WHERE data_source = 'unverified';
UPDATE fueling_sessions SET data_source = 'legacy' WHERE data_source = 'unverified';

-- Alter default para NULL
ALTER TABLE fueling_logs ALTER COLUMN data_source DROP DEFAULT;
ALTER TABLE fueling_logs ALTER COLUMN data_source SET DEFAULT NULL;

ALTER TABLE fueling_sessions ALTER COLUMN data_source DROP DEFAULT;
ALTER TABLE fueling_sessions ALTER COLUMN data_source SET DEFAULT NULL;

-- Constraints
ALTER TABLE fueling_logs DROP CONSTRAINT IF EXISTS fueling_logs_data_source_check;
ALTER TABLE fueling_logs ADD CONSTRAINT fueling_logs_data_source_check 
  CHECK (data_source IS NULL OR data_source IN ('hardware','manager','unverified','legacy'));

ALTER TABLE fueling_sessions DROP CONSTRAINT IF EXISTS fueling_sessions_data_source_check;
ALTER TABLE fueling_sessions ADD CONSTRAINT fueling_sessions_data_source_check 
  CHECK (data_source IS NULL OR data_source IN ('hardware','manager','unverified','legacy'));

-- Indexes
CREATE INDEX IF NOT EXISTS facial_attempts_driver_idx ON facial_attempts(driver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS facial_attempts_session_idx ON facial_attempts(session_id);

-- Nova coluna
ALTER TABLE fueling_logs ADD COLUMN IF NOT EXISTS session_id INTEGER REFERENCES fueling_sessions(id);
