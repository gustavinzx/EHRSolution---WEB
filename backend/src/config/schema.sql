CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS drivers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  email VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trucks (
  id SERIAL PRIMARY KEY,
  plate VARCHAR(20) UNIQUE NOT NULL,
  model VARCHAR(255) NOT NULL,
  capacity_liters NUMERIC(10,2) NOT NULL,
  current_level_liters NUMERIC(10,2) NOT NULL,
  lat NUMERIC(10,7),
  lng NUMERIC(10,7),
  speed_kmh NUMERIC(5,1) DEFAULT 0,
  consumption_per_100km NUMERIC(5,2) DEFAULT 32.0,
  status VARCHAR(50) DEFAULT 'ok',
  sim_state VARCHAR(50) DEFAULT 'driving',
  fueling_ticks INTEGER DEFAULT 0,
  origin_name VARCHAR(255),
  dest_name VARCHAR(255),
  route_geometry JSON,
  planned_route_geometry JSON,
  route_phase VARCHAR(20) DEFAULT 'planned',
  fuel_station_id INTEGER,
  route_resume_index INTEGER DEFAULT 0,
  route_index INTEGER DEFAULT 0,
  route_progress NUMERIC(5,4) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

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

CREATE TABLE IF NOT EXISTS driver_trucks (
  driver_id INTEGER REFERENCES drivers(id),
  truck_id INTEGER REFERENCES trucks(id),
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (driver_id, truck_id)
);

CREATE TABLE IF NOT EXISTS fueling_logs (
  id SERIAL PRIMARY KEY,
  driver_id INTEGER REFERENCES drivers(id),
  truck_id INTEGER REFERENCES trucks(id),
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  lat NUMERIC(10,7),
  lng NUMERIC(10,7),
  level_before NUMERIC(10,2),
  level_after NUMERIC(10,2),
  release_method VARCHAR(20) DEFAULT 'facial' CHECK (release_method IN ('facial','ble_fallback'))
  ,station_id INTEGER REFERENCES fuel_stations(id), station_name VARCHAR(255), started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ, duration_minutes NUMERIC(5,1), volume_liters NUMERIC(10,2)
);

CREATE TABLE IF NOT EXISTS telemetry_logs (
  id SERIAL PRIMARY KEY,
  truck_id INTEGER REFERENCES trucks(id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  lat NUMERIC(10,7) NOT NULL,
  lng NUMERIC(10,7) NOT NULL,
  speed_kmh NUMERIC(5,1) DEFAULT 0,
  fuel_level_liters NUMERIC(10,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS fleet_alerts (
  id SERIAL PRIMARY KEY,
  truck_id INTEGER REFERENCES trucks(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) DEFAULT 'high' CHECK (severity IN ('low','medium','high','critical')),
  message TEXT NOT NULL,
  plate VARCHAR(20),
  model VARCHAR(255),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sessões curtas de abastecimento: a trava só é liberada durante uma sessão autorizada.
CREATE TABLE IF NOT EXISTS fueling_sessions (
  id SERIAL PRIMARY KEY,
  truck_id INTEGER NOT NULL REFERENCES trucks(id) ON DELETE CASCADE,
  driver_id INTEGER REFERENCES drivers(id),
  status VARCHAR(20) NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested','authorized','active','completed','expired','cancelled')),
  release_method VARCHAR(20) CHECK (release_method IN ('facial','ble_fallback')),
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  authorized_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  station_id INTEGER REFERENCES fuel_stations(id),
  duration_minutes INTEGER DEFAULT 15,
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_fueling_sessions_truck_status
  ON fueling_sessions (truck_id, status, requested_at DESC);

CREATE TABLE IF NOT EXISTS security_events (
  id SERIAL PRIMARY KEY,
  truck_id INTEGER NOT NULL REFERENCES trucks(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) NOT NULL DEFAULT 'high'
    CHECK (severity IN ('low','medium','high','critical')),
  source VARCHAR(30) NOT NULL DEFAULT 'device',
  payload JSONB DEFAULT '{}'::jsonb,
  lat NUMERIC(10,7), lng NUMERIC(10,7),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_security_events_truck_time
  ON security_events (truck_id, created_at DESC);

CREATE TABLE IF NOT EXISTS unloading_events (
  id SERIAL PRIMARY KEY,
  truck_id INTEGER REFERENCES trucks(id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  lat NUMERIC(10,7),
  lng NUMERIC(10,7),
  vibration_level NUMERIC(5,2) NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('safe','low','high'))
);

CREATE INDEX IF NOT EXISTS idx_telemetry_truck_time ON telemetry_logs (truck_id, timestamp DESC);

-- FIX 3.1: Performance indexes for frequently filtered/sorted tables
CREATE INDEX IF NOT EXISTS idx_fueling_logs_truck_time ON fueling_logs (truck_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_fueling_logs_driver ON fueling_logs (driver_id);
CREATE INDEX IF NOT EXISTS idx_fleet_alerts_truck_time ON fleet_alerts (truck_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fleet_alerts_resolved ON fleet_alerts (resolved_at) WHERE resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_unloading_events_truck_time ON unloading_events (truck_id, timestamp DESC);
