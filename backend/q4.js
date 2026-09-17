const { pool } = require("./src/config/db");
const { remainingRouteKm } = require("./src/services/simulator");
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
