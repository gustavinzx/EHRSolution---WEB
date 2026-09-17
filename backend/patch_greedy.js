const fs = require("fs");
let content = fs.readFileSync("src/services/simulator.js", "utf8");

content = content.replace(
  /if \(autonomyKm < distToDestKm\) \{/g,
  "if (fuelPct < 25 && autonomyKm < distToDestKm) {"
);

fs.writeFileSync("src/services/simulator.js", content);
