const { pool } = require("./src/config/db");
async function fix() {
  await pool.query("UPDATE trucks SET origin_name=$1, dest_name=$2, lat='-20.3155', lng='-40.3128' WHERE id=4", 
    ["Belo Horizonte, MG, Brasil", "Vitória, ES, Brasil"]
  );
  // Also clear route geometry so the seed/fetch route loop picks it up next restart or route change
  await pool.query("UPDATE trucks SET route_geometry=NULL, planned_route_geometry=NULL WHERE id=4");
  console.log("Fixed!");
  process.exit();
}
fix();
