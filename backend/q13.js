const { pool } = require("./src/config/db");
async function test() {
  const route = [ [-38, -12], [-38, -12] ];
  await pool.query("UPDATE trucks SET planned_route_geometry=$1 WHERE id=4", [route]);
  const { rows } = await pool.query("SELECT planned_route_geometry FROM trucks WHERE id=4");
  console.log(rows[0].planned_route_geometry);
  process.exit();
}
test();
