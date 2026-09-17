const { Pool } = require("pg");
const pool = new Pool({ database: "ehr_fleet", user: "postgres", password: "postgres" });
(async () => {
  await pool.query("UPDATE trucks SET current_level_liters = 50, speed_kmh = 80 WHERE current_level_liters <= 1");
  console.log("Stuck trucks rescued!");
  process.exit(0);
})();
