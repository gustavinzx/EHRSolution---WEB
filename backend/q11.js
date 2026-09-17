const { pool } = require("./src/config/db");
pool.query("SELECT route_geometry FROM trucks WHERE id=4").then(r => {
  const geom = r.rows[0].route_geometry;
  console.log(geom[0]);
  process.exit();
});
