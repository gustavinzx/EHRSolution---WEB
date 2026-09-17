const { pool } = require("./src/config/db");
async function test() {
  try {
    const { rows } = await pool.query("SELECT f.*, d.name as driver_name, t.plate, t.model, fs.name as station_name FROM fueling_logs f LEFT JOIN drivers d ON f.driver_id = d.id JOIN trucks t ON f.truck_id = t.id LEFT JOIN fuel_stations fs ON f.station_id = fs.id WHERE 1=1 ORDER BY f.timestamp DESC LIMIT 1");
    console.log(rows);
  } catch (err) {
    console.error(err);
  }
  process.exit();
}
test();
