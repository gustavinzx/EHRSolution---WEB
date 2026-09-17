const fs = require("fs");
let content = fs.readFileSync("src/services/simulator.js", "utf8");

content = content.replace(
  /let actualSpeed = speed;\s*if \(newFuel <= 0\) \{\s*newFuel = 0;\s*actualSpeed = 0;\s*nextStatus = 'critical_fuel';\s*\} else \{\s*if \(fuelPct <= 40 && nextStatus !== 'security_alert'\) nextStatus = 'low_fuel';\s*if \(fuelPct <= 15\) nextStatus = 'critical_fuel';\s*\}/,
  `let actualSpeed = speed;
      let finalLat = nextLat;
      let finalLng = nextLng;
      let finalIndex = nextIndex;
      if (newFuel <= 0) {
        newFuel = 0;
        actualSpeed = 0;
        nextStatus = 'critical_fuel';
        finalLat = prevLat;
        finalLng = prevLng;
        finalIndex = routeIndex;
      } else {
        if (fuelPct <= 40 && nextStatus !== 'security_alert') nextStatus = 'low_fuel';
        if (fuelPct <= 15) nextStatus = 'critical_fuel';
      }`
);

content = content.replace(
  /\`,\s*\[nextLat,\s*nextLng,\s*newFuel,\s*actualSpeed,\s*nextIndex,\s*nextStatus,\s*nextPhase,\s*truck\.id\]\);/,
  "`, [finalLat, finalLng, newFuel, actualSpeed, finalIndex, nextStatus, nextPhase, truck.id]);"
);

content = content.replace(
  /\[truck\.id,\s*nextLat,\s*nextLng,\s*actualSpeed,\s*newFuel\]/,
  "[truck.id, finalLat, finalLng, actualSpeed, newFuel]"
);

fs.writeFileSync("src/services/simulator.js", content);
