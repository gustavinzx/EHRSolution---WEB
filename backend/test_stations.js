const { pool } = require("./src/config/db");
async function run() {
  const { rows } = await pool.query("SELECT * FROM fuel_stations LIMIT 1");
  console.log(rows);
  process.exit();
}
run();
