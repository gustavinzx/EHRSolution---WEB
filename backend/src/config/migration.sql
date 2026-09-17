-- Migration: Fleet Realism v2
-- Idempotent - safe to run multiple times

CREATE TABLE IF NOT EXISTS fuel_stations (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  brand VARCHAR(100),
  address TEXT,
  lat NUMERIC(10,7) NOT NULL,
  lng NUMERIC(10,7) NOT NULL,
  active BOOLEAN DEFAULT true,
  source VARCHAR(50) DEFAULT 'seed',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fuel_stations_location ON fuel_stations (lat, lng) WHERE active = true;

ALTER TABLE trucks ADD COLUMN IF NOT EXISTS route_resume_index INTEGER DEFAULT 0;
ALTER TABLE trucks ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE trucks ADD COLUMN IF NOT EXISTS planned_route_geometry JSON;
ALTER TABLE trucks ADD COLUMN IF NOT EXISTS consumption_per_100km NUMERIC(5,2) DEFAULT 32.0;
ALTER TABLE trucks DROP CONSTRAINT IF EXISTS trucks_status_check;
ALTER TABLE trucks ADD COLUMN IF NOT EXISTS fuel_station_id INTEGER REFERENCES fuel_stations(id);
UPDATE trucks SET current_level_liters = LEAST(current_level_liters, capacity_liters)
WHERE current_level_liters > capacity_liters;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='trucks' AND column_name='route_phase') THEN
    ALTER TABLE trucks ADD COLUMN route_phase VARCHAR(30) DEFAULT 'planned';
  END IF;
END $$;

ALTER TABLE fueling_logs ADD COLUMN IF NOT EXISTS station_id INTEGER REFERENCES fuel_stations(id);
ALTER TABLE fueling_logs ADD COLUMN IF NOT EXISTS station_name VARCHAR(255);
ALTER TABLE fueling_logs ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
ALTER TABLE fueling_logs ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE fueling_logs ADD COLUMN IF NOT EXISTS duration_minutes NUMERIC(5,1);
ALTER TABLE fueling_logs ADD COLUMN IF NOT EXISTS volume_liters NUMERIC(10,2);

ALTER TABLE fueling_sessions ADD COLUMN IF NOT EXISTS station_id INTEGER REFERENCES fuel_stations(id);
ALTER TABLE fueling_sessions ADD COLUMN IF NOT EXISTS duration_minutes INTEGER DEFAULT 15;

ALTER TABLE fleet_alerts ADD COLUMN IF NOT EXISTS resolved_by VARCHAR(255);
ALTER TABLE fleet_alerts ADD COLUMN IF NOT EXISTS resolution_note TEXT;

ALTER TABLE security_events ADD COLUMN IF NOT EXISTS lat NUMERIC(10,7);
ALTER TABLE security_events ADD COLUMN IF NOT EXISTS lng NUMERIC(10,7);
