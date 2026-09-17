const { pool } = require("./src/config/db");
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)*Math.sin(dLon/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
function remainingRouteKm(routeCoords, currentIndex) {
  let dist = 0;
  for (let i = currentIndex; i < routeCoords.length - 1; i++) {
    const [lng1, lat1] = routeCoords[i];
    const [lng2, lat2] = routeCoords[i + 1];
    dist += haversineKm(lat1, lng1, lat2, lng2);
  }
  return dist;
}
async function test() {
  const { rows } = await pool.query("SELECT * FROM trucks WHERE id=1");
  const truck = rows[0];
  const route = typeof truck.route_geometry === 'string' ? JSON.parse(truck.route_geometry) : truck.route_geometry;
  const consumption = parseFloat(truck.consumption_per_100km) || 32;
  const SAFETY_FUEL_MARGIN = 0.20;
  const autonomyKm = (parseFloat(truck.current_level_liters) / consumption) * 100 * (1 - SAFETY_FUEL_MARGIN);
  const dist = remainingRouteKm(route, parseInt(truck.route_index));
  console.log({ autonomyKm, dist, consumption, level: truck.current_level_liters });
  process.exit();
}
test();
