const fs = require("fs");
let content = fs.readFileSync("src/services/simulator.js", "utf8");

content = content.replace(
  `        if (newFuel <= 0) {
          newFuel = 0;
          actualSpeed = 0;
          finalLat = prevLat;
          finalLng = prevLng;
          nextStatus = 'critical_fuel';
        }`,
  `        if (newFuel <= 1) {
          // Demo emergency fuel: never actually stop the truck so the presentation doesn't break
          newFuel = 1;
          nextStatus = 'critical_fuel';
        }`
);

fs.writeFileSync("src/services/simulator.js", content);
console.log("Emergency fuel patched!");
