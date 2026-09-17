const { pool } = require("./src/config/db");
pool.query("UPDATE trucks SET current_level_liters=50, status='low_fuel' WHERE id=1").then(() => { console.log("Done"); process.exit(); });
