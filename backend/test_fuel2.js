const { Pool } = require("pg");
const pool = new Pool({
  database: "ehr_fleet",
  user: "postgres",
  password: "postgres",
});

(async () => {
  const res1 = await pool.query("SELECT current_level_liters FROM trucks WHERE id = 4");
  console.log(res1.rows[0]);
  process.exit(0);
})();
