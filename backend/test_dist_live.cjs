const turf = require("@turf/turf");
const { Pool } = require("pg");
const pool = new Pool({ database: "ehr_fleet", user: "postgres", password: "postgres" });

(async () => {
  const res = await pool.query("SELECT * FROM trucks WHERE id = 4");
  const truck = res.rows[0];
  const rawGeo = typeof truck.route_geometry === 'string' ? JSON.parse(truck.route_geometry) : truck.route_geometry;
  
  const idx = Math.min(Math.max(0, truck.route_index), rawGeo.length - 1);
  let baseDist = 0;
  for (let i = 0; i < idx; i++) {
    baseDist += turf.distance(turf.point(rawGeo[i]), turf.point(rawGeo[i+1]), { units: 'meters' });
  }

  const nodePos = rawGeo[idx];
  const truckPos = [parseFloat(truck.lng), parseFloat(truck.lat)];
  const offsetDist = turf.distance(turf.point(nodePos), turf.point(truckPos), { units: 'meters' });

  console.log("Truck speed_kmh:", truck.speed_kmh);
  console.log("Truck route_index:", truck.route_index);
  console.log("Base dist:", baseDist);
  console.log("Offset dist:", offsetDist);
  console.log("Total:", baseDist + offsetDist);
  process.exit(0);
})();
