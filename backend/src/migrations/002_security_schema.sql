-- 002_security_schema.sql
ALTER TABLE fleet_alerts ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS fueling_sessions (
  id SERIAL PRIMARY KEY,
  truck_id INTEGER NOT NULL REFERENCES trucks(id) ON DELETE CASCADE,
  driver_id INTEGER REFERENCES drivers(id),
  status VARCHAR(20) NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested','authorized','active','completed','expired','cancelled')),
  release_method VARCHAR(20),
  requested_at TIMESTAMPTZ DEFAULT NOW(), 
  authorized_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ, 
  completed_at TIMESTAMPTZ, 
  expires_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS security_events (
  id SERIAL PRIMARY KEY,
  truck_id INTEGER NOT NULL REFERENCES trucks(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) NOT NULL DEFAULT 'high',
  source VARCHAR(30) NOT NULL DEFAULT 'device',
  payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE drivers ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
ALTER TABLE trucks ADD COLUMN IF NOT EXISTS api_key VARCHAR(100);
ALTER TABLE fuel_stations ADD COLUMN IF NOT EXISTS is_authorized BOOLEAN DEFAULT true;
ALTER TABLE fleet_alerts ADD COLUMN IF NOT EXISTS resolution_note TEXT;
ALTER TABLE fleet_alerts ADD COLUMN IF NOT EXISTS resolved_by VARCHAR(255);
ALTER TABLE fueling_sessions ADD COLUMN IF NOT EXISTS station_id INTEGER REFERENCES fuel_stations(id);
ALTER TABLE fueling_sessions ADD COLUMN IF NOT EXISTS duration_minutes INTEGER DEFAULT 15;
ALTER TABLE security_events ADD COLUMN IF NOT EXISTS lat NUMERIC(10,7);
ALTER TABLE security_events ADD COLUMN IF NOT EXISTS lng NUMERIC(10,7);

ALTER TABLE fueling_sessions DROP CONSTRAINT IF EXISTS fueling_sessions_release_method_check;
ALTER TABLE fueling_sessions ADD CONSTRAINT fueling_sessions_release_method_check
  CHECK (release_method IN ('facial','ble_fallback','manager_override'));

ALTER TABLE fueling_logs DROP CONSTRAINT IF EXISTS fueling_logs_release_method_check;
ALTER TABLE fueling_logs ADD CONSTRAINT fueling_logs_release_method_check
  CHECK (release_method IN ('facial','ble_fallback','manager_override'));
