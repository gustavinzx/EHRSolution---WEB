const { pool } = require("./src/config/db");
pool.query("SELECT route_index, route_geometry FROM trucks WHERE id=4").then(r => {
  const geom = r.rows[0].route_geometry;
  const idx = r.rows[0].route_index;
  console.log("Length:", geom.length, "Index:", idx);
  process.exit();
});
