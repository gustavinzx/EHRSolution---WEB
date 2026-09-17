const fs = require("fs");
let content = fs.readFileSync("src/services/simulator.js", "utf8");

content = content.replace(
  /if \(fuelPct <= 40 && nextStatus !== "security_alert"\) nextStatus = "low_fuel";\s*if \(fuelPct <= 15\) nextStatus = "critical_fuel";/,
  `let actualSpeed = speed;
      if (newFuel <= 0) {
        newFuel = 0;
        actualSpeed = 0;
        nextStatus = 'critical_fuel';
      } else {
        if (fuelPct <= 40 && nextStatus !== 'security_alert') nextStatus = 'low_fuel';
        if (fuelPct <= 15) nextStatus = 'critical_fuel';
      }`
);

content = content.replace(
  /const \{ rows: recentFuel \} = await db\.query\(\s*"SELECT id FROM fueling_logs WHERE truck_id=\\$1 AND timestamp > NOW\(\) - INTERVAL '3 hours' LIMIT 1",\s*\[truck\.id\]\s*\);\s*if \(recentFuel\.length === 0\) \{/,
  "if (true) {"
);

fs.writeFileSync("src/services/simulator.js", content);
