const { pool } = require("./src/config/db");
async function fix() {
  const originLat = -12.9714;
  const originLng = -38.5014;
  const destLat = -23.5505;
  const destLng = -46.6333;
  
  const url = `http://router.project-osrm.org/route/v1/driving/${originLng},${originLat};${destLng},${destLat}?overview=full&geometries=geojson`;
  const res = await fetch(url);
  const data = await res.json();
  const route = data.routes[0].geometry.coordinates;
  
  await pool.query("UPDATE trucks SET lat=$1, lng=$2, route_geometry=$3, planned_route_geometry=$4, route_index=0, sim_state='driving', route_phase='planned' WHERE id=4",
    [originLat, originLng, JSON.stringify(route), JSON.stringify(route)]
  );
  console.log("Truck 4 fixed to Brazil!");
  process.exit();
}
fix();
