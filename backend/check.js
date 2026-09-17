const { pool } = require("./src/config/db");
async function fix() {
  const r = await pool.query("SELECT id, plate, lat, lng, route_index, route_phase, substring(route_geometry::text from 1 for 30) as r FROM trucks");
  console.log(r.rows);
  process.exit();
}
fix();
