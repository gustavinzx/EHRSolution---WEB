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
  origin_name VARCHAR(255),
  dest_name VARCHAR(255),
  route_geometry JSON,
  route_index INTEGER DEFAULT 0,
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
