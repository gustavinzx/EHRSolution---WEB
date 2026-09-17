const fs = require("fs");
let content = fs.readFileSync("src/components/LiveTruckMarker.jsx", "utf8");
content = content.replace(/> 1500/g, "> 5000");
fs.writeFileSync("src/components/LiveTruckMarker.jsx", content);

let content2 = fs.readFileSync("src/components/Simulation3DModal.jsx", "utf8");
content2 = content2.replace(/> 1500/g, "> 5000");
fs.writeFileSync("src/components/Simulation3DModal.jsx", content2);

console.log("Re-patched threshold!");
