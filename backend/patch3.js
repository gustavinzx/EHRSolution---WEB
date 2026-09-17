const fs = require("fs");
let content = fs.readFileSync("src/services/simulator.js", "utf8");

content = content.replace(
  "if (recentFuel.length === 0) {",
  "if (true) {"
);

fs.writeFileSync("src/services/simulator.js", content);
