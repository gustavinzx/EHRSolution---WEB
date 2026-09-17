const { pool } = require("./src/config/db");

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
function remainingRouteKm(rt, startIndex) {
  let d = 0;
  for (let i = startIndex; i < rt.length - 1; i++) {
      const [lon1, lat1] = rt[i];
      const [lon2, lat2] = rt[i+1];
      d += haversineKm(lat1, lon1, lat2, lon2);
  }
  return d;
}

async function run() {
  const { rows: trucks } = await pool.query("SELECT * FROM trucks");
  for (const truck of trucks) {
    try {
      let route = typeof truck.route_geometry === "string" ? JSON.parse(truck.route_geometry) : truck.route_geometry;
      if (!route) { console.log(`Truck ${truck.id} NO ROUTE`); continue; }
      
      const routeIndex = parseInt(truck.route_index) || 0;
      const ROUTE_JUMP = 5;
      const nextIndex = Math.min(routeIndex + ROUTE_JUMP, route.length - 1);
      
      const fuelL = parseFloat(truck.current_level_liters);
      const capacityL = parseFloat(truck.capacity_liters);
      const consumption = parseFloat(truck.consumption_per_100km || 32);
      const SAFETY_FUEL_MARGIN = 0.20;
      
      if (truck.route_phase === "planned" && !truck.fuel_station_id) {
          const autonomyKm = (fuelL / consumption) * 100 * (1 - SAFETY_FUEL_MARGIN);
          const distToDestKm = remainingRouteKm(route, nextIndex);
          if (autonomyKm < distToDestKm) {
              console.log(`Truck ${truck.id} needs fuel! auth=${autonomyKm}, dist=${distToDestKm}`);
          }
      }
    } catch(err) {
      console.log(`Truck ${truck.id} ERROR: ${err.message}`);
    }
  }
  process.exit();
}
run();
