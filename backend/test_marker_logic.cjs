const turf = require("@turf/turf");
const { Pool } = require("pg");
const pool = new Pool({ database: "ehr_fleet", user: "postgres", password: "postgres" });

(async () => {
  const res = await pool.query("SELECT * FROM trucks WHERE id = 4");
  const truck = res.rows[0];
  const rawGeo = typeof truck.route_geometry === 'string' ? JSON.parse(truck.route_geometry) : truck.route_geometry;
  
  if (!rawGeo) {
    console.log("No route geometry!");
    process.exit(1);
  }

  const idx = Math.min(Math.max(0, truck.route_index), rawGeo.length - 1);
  let dist = 0;
  if (idx > 0) {
    for (let i = 0; i < idx; i++) {
      dist += turf.distance(turf.point(rawGeo[i]), turf.point(rawGeo[i+1]), { units: 'meters' });
    }
  }
  const baseDist = dist;
  console.log("Base dist from route_index:", baseDist);

  if (idx < rawGeo.length - 1 && truck.lat && truck.lng) {
    const nodePos = rawGeo[idx];
    const truckPos = [parseFloat(truck.lng), parseFloat(truck.lat)];
    dist += turf.distance(turf.point(nodePos), turf.point(truckPos), { units: 'meters' });
  }

  console.log("Total calculated targetDist:", dist);
  console.log("Difference (added by lat/lng):", dist - baseDist);

  process.exit(0);
})();
