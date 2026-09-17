const { Pool } = require("pg");
const pool = new Pool({ database: "ehr_fleet", user: "postgres", password: "postgres" });
(async () => {
  const res = await pool.query("SELECT * FROM trucks WHERE plate = 'GHI-1D23'");
  console.log(res.rows[0]);
  process.exit(0);
})();
