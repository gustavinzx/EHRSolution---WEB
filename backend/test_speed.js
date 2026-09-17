const { Pool } = require("pg");
const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || "ehr_fleet",
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "postgres",
});

(async () => {
  const res1 = await pool.query("SELECT lat, lng, route_index FROM trucks WHERE id = 4");
  console.log(res1.rows[0]);
  await new Promise(r => setTimeout(r, 4000));
  const res2 = await pool.query("SELECT lat, lng, route_index FROM trucks WHERE id = 4");
  console.log(res2.rows[0]);
  process.exit(0);
})();
