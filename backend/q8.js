const { pool } = require("./src/config/db");
pool.query("SELECT route_geometry FROM trucks WHERE id=4").then(r => {
  const geom = r.rows[0].route_geometry;
  console.log(typeof geom);
  console.log(Array.isArray(geom));
  if (typeof geom === "string") console.log("string length:", geom.length, geom.substring(0, 20));
  process.exit();
});
