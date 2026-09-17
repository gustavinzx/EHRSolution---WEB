const { pool } = require("./src/config/db");
async function run() {
  const r = await pool.query("SELECT id, route_index, length(route_geometry::text) as len FROM trucks");
  console.log(r.rows);
  process.exit();
}
run();
