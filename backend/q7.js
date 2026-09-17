const { pool } = require("./src/config/db");
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)*Math.sin(dLon/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
async function test() {
  const { rows } = await pool.query("SELECT * FROM trucks WHERE id=1");
  const truck = rows[0];
  const consumption = parseFloat(truck.consumption_per_100km) || 32;
  const SAFETY_FUEL_MARGIN = 0.20;
  const autonomyKm = (parseFloat(truck.current_level_liters) / consumption) * 100 * (1 - SAFETY_FUEL_MARGIN);
  const { rows: stations } = await pool.query("SELECT * FROM fuel_stations WHERE active=true");
  const candidates = stations.map(s => ({
    ...s,
    distKm: haversineKm(parseFloat(truck.lat), parseFloat(truck.lng), parseFloat(s.lat), parseFloat(s.lng))
  })).filter(s => s.distKm <= autonomyKm).sort((a, b) => a.distKm - b.distKm);
  console.log("Candidates for truck 1 (autonomy " + autonomyKm + "km): ", candidates);
  process.exit();
}
test();
