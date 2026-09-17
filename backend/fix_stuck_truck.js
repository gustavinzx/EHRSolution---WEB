const { pool } = require("./src/config/db");
async function fix() {
  const { rows } = await pool.query("SELECT planned_route_geometry FROM trucks WHERE id=4");
  const geom = rows[0].planned_route_geometry;
  await pool.query(
    "UPDATE trucks SET route_geometry=$1, route_index=0, sim_state='driving', route_phase='planned', status='ok', fuel_station_id=NULL WHERE id=4",
    [JSON.stringify(geom)]
  );
  console.log("Truck 4 fixed!");
  process.exit();
}
fix();
