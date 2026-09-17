const fs = require("fs");
let content = fs.readFileSync("src/controllers/fleetController.js", "utf8");

content = content.replace(
  "await db.query(`UPDATE trucks SET sim_state = 'fueling' WHERE id = $1`, [id]);",
  "await db.query(`UPDATE trucks SET sim_state = 'fueling', route_phase = 'fueling' WHERE id = $1`, [id]);"
);

fs.writeFileSync("src/controllers/fleetController.js", content);
console.log("forceFueling patched!");
