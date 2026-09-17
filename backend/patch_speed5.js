const fs = require("fs");
let content = fs.readFileSync("src/services/simulator.js", "utf8");

content = content.replace(
  "const distToTravelM = (speed * 1000 / 3600) * (TICK_MS / 1000);",
  "const TIME_MULTIPLIER = 25; // Acelera o tempo para não levar 24h cruzando o país\n          const distToTravelM = (speed * 1000 / 3600) * (TICK_MS / 1000) * TIME_MULTIPLIER;"
);

content = content.replace(
  "const consumedL     = (distKm * consumption / 100) * speedFactor;",
  "const consumedL     = (distKm * consumption / 100) * speedFactor; // distKm já está com o TIME_MULTIPLIER embutido!"
);

fs.writeFileSync("src/services/simulator.js", content);
console.log("Speed patched");
