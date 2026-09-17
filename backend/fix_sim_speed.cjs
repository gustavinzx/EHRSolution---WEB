const fs = require("fs");
let content = fs.readFileSync("src/services/simulator.js", "utf8");

content = content.replace(
  "const TIME_MULTIPLIER = 25;",
  "const TIME_MULTIPLIER = 100;"
);

fs.writeFileSync("src/services/simulator.js", content);
console.log("Backend time multiplier increased!");
