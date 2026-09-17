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
  status VARCHAR(50) DEFAULT 'ok',
  sim_state VARCHAR(50) DEFAULT 'driving',
  fueling_ticks INTEGER DEFAULT 0,
  origin_name VARCHAR(255),
  dest_name VARCHAR(255),
  route_geometry JSON,
  route_index INTEGER DEFAULT 0,
  route_progress NUMERIC(5,4) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
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
  created_at TIMESTAMPTZ DEFAULT NOW()
);

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
