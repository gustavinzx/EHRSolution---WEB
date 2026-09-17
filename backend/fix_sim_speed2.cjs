const fs = require("fs");
let content = fs.readFileSync("src/services/simulator.js", "utf8");
content = content.replace("const TIME_MULTIPLIER = 100;", "const TIME_MULTIPLIER = 300;");
fs.writeFileSync("src/services/simulator.js", content);
console.log("Speed set to 300x");
