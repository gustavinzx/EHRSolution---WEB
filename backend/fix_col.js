require("dotenv").config();
const { pool } = require("./src/config/db");

async function fixColumn() {
  const client = await pool.connect();
  try {
    await client.query("ALTER TABLE trucks ADD COLUMN IF NOT EXISTS fuel_station_id INTEGER REFERENCES fuel_stations(id)");
    console.log("Column fuel_station_id added to trucks.");
  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    pool.end();
  }
}

fixColumn();
