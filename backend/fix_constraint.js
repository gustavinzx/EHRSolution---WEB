const { pool } = require("./src/config/db");
async function run() {
  await pool.query("ALTER TABLE trucks DROP CONSTRAINT IF EXISTS trucks_status_check");
  console.log("Constraint dropped!");
  process.exit();
}
run();
