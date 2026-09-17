const { pool } = require("./src/config/db");
pool.query("SELECT * FROM trucks WHERE id=4").then(r => {
  const t = r.rows[0];
  console.log("sim_state:", t.sim_state);
  console.log("route_phase:", t.route_phase);
  console.log("route_index:", t.route_index);
  console.log("route_geometry length:", t.route_geometry ? t.route_geometry.length : 0);
  console.log("planned_route_geometry length:", t.planned_route_geometry ? t.planned_route_geometry.length : 0);
  process.exit();
});
