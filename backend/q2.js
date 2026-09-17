const { pool } = require("./src/config/db");
async function run() {
  const { rows } = await pool.query("SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'trucks_status_check'");
  console.log(rows);
  process.exit();
}
run();
