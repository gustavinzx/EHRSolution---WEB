const { pool } = require("./src/config/db");
pool.query("SELECT id, route_phase, fuel_station_id, current_level_liters FROM trucks WHERE id=1").then(r => { console.log(r.rows); process.exit(); });
