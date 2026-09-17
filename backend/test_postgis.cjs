const { Pool } = require("pg");
const pool = new Pool({ database: "ehr_fleet", user: "postgres", password: "postgres" });
(async () => {
  try {
    const res = await pool.query("SELECT PostGIS_Version();");
    console.log("PostGIS is installed:", res.rows[0].postgis_version);
  } catch (err) {
    console.log("PostGIS not installed:", err.message);
  }
  process.exit(0);
})();
