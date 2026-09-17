const { pool } = require("./src/config/db");
async function run() {
  const { rows } = await pool.query("SELECT * FROM trucks WHERE id=9");
  const truck = rows[0];
  const route = typeof truck.route_geometry === "string" ? JSON.parse(truck.route_geometry) : truck.route_geometry;
  const routeIndex = 0;
  
  function remainingRouteKm(rt, startIndex) {
    let d = 0;
    for (let i = startIndex; i < rt.length - 1; i++) {
        const [lon1, lat1] = rt[i];
        const [lon2, lat2] = rt[i+1];
        d += haversineKm(lat1, lon1, lat2, lon2);
    }
    return d;
  }
  
  function haversineKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }
  
  const fuelL = parseFloat(truck.current_level_liters) || 0;
  const consumption = parseFloat(truck.consumption_per_100km) || 32.0;
  const SAFETY_FUEL_MARGIN  = 0.20; 
  
  const autonomyKm = (fuelL / consumption) * 100 * (1 - SAFETY_FUEL_MARGIN);
  const distToDestKm = remainingRouteKm(route, routeIndex);
  
  console.log("autonomyKm:", autonomyKm);
  console.log("distToDestKm:", distToDestKm);
  process.exit();
}
run();
