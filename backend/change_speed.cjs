const fs = require("fs");
let content = fs.readFileSync("src/services/simulator.js", "utf8");
content = content.replace("const TIME_MULTIPLIER = 60;", "const TIME_MULTIPLIER = 15; // Velocidade visual e logica (15x o tempo real)");
fs.writeFileSync("src/services/simulator.js", content);
console.log("TIME_MULTIPLIER mudado para 15");
