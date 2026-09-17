const fs = require("fs");
let content = fs.readFileSync("src/components/LiveTruckMarker.jsx", "utf8");
content = content.replace(/> 20000/g, "> 50000");
fs.writeFileSync("src/components/LiveTruckMarker.jsx", content);

let content2 = fs.readFileSync("src/components/Simulation3DModal.jsx", "utf8");
content2 = content2.replace(/> 20000/g, "> 50000");
fs.writeFileSync("src/components/Simulation3DModal.jsx", content2);
console.log("Snap threshold 50000");
