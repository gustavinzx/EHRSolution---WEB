require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { pool } = require("./src/config/db");

async function runMigration() {
  const client = await pool.connect();
  try {
    console.log("Running migration...");

    await client.query("CREATE TABLE IF NOT EXISTS fuel_stations (id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL, brand VARCHAR(100), address TEXT, lat NUMERIC(10,7) NOT NULL, lng NUMERIC(10,7) NOT NULL, active BOOLEAN DEFAULT true, source VARCHAR(50) DEFAULT 'seed', created_at TIMESTAMPTZ DEFAULT NOW())");
    await client.query("CREATE INDEX IF NOT EXISTS idx_fuel_stations_location ON fuel_stations (lat, lng) WHERE active = true");
    
    await client.query("ALTER TABLE trucks ADD COLUMN IF NOT EXISTS route_resume_index INTEGER DEFAULT 0");
    await client.query("ALTER TABLE trucks ADD COLUMN IF NOT EXISTS planned_route_geometry JSON");
    await client.query("ALTER TABLE trucks ADD COLUMN IF NOT EXISTS consumption_per_100km NUMERIC(5,2) DEFAULT 32.0");
    await client.query("ALTER TABLE trucks ADD COLUMN IF NOT EXISTS route_phase VARCHAR(30) DEFAULT 'planned'");

    await client.query("ALTER TABLE fueling_logs ADD COLUMN IF NOT EXISTS station_id INTEGER REFERENCES fuel_stations(id)");
    await client.query("ALTER TABLE fueling_logs ADD COLUMN IF NOT EXISTS station_name VARCHAR(255)");
    await client.query("ALTER TABLE fueling_logs ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ");
    await client.query("ALTER TABLE fueling_logs ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ");
    await client.query("ALTER TABLE fueling_logs ADD COLUMN IF NOT EXISTS duration_minutes NUMERIC(5,1)");
    await client.query("ALTER TABLE fueling_logs ADD COLUMN IF NOT EXISTS volume_liters NUMERIC(10,2)");

    await client.query("ALTER TABLE fueling_sessions ADD COLUMN IF NOT EXISTS station_id INTEGER REFERENCES fuel_stations(id)");
    await client.query("ALTER TABLE fueling_sessions ADD COLUMN IF NOT EXISTS duration_minutes INTEGER DEFAULT 15");

    await client.query("ALTER TABLE fleet_alerts ADD COLUMN IF NOT EXISTS resolved_by VARCHAR(255)");
    await client.query("ALTER TABLE fleet_alerts ADD COLUMN IF NOT EXISTS resolution_note TEXT");

    await client.query("ALTER TABLE security_events ADD COLUMN IF NOT EXISTS lat NUMERIC(10,7)");
    await client.query("ALTER TABLE security_events ADD COLUMN IF NOT EXISTS lng NUMERIC(10,7)");

    console.log("Migration completed successfully!");
  } catch (err) {
    console.error("Migration failed:", err.message);
    process.exit(1);
  } finally {
    client.release();
    pool.end();
  }
}

runMigration();
