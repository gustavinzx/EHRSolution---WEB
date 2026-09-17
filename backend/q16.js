const { pool } = require("./src/config/db");
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)*Math.sin(dLon/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
function remainingRouteKm(route, currentIndex) {
  let dist = 0;
  for (let i = currentIndex; i < route.length - 1; i++) {
    const [lng1, lat1] = route[i];
    const [lng2, lat2] = route[i + 1];
    dist += haversineKm(lat1, lng1, lat2, lng2);
  }
  return dist;
}
pool.query("SELECT planned_route_geometry FROM trucks WHERE id=4").then(r => {
  const geom = r.rows[0].planned_route_geometry;
  const dist = remainingRouteKm(geom, 0);
  console.log("Distance:", dist);
  process.exit();
});
