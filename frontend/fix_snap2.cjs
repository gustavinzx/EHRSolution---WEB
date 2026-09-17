const fs = require("fs");
let content = fs.readFileSync("src/components/Simulation3DModal.jsx", "utf8");
content = content.replace(/Math\.abs\(diffLat\) > 0\.015/g, "Math.abs(diffLat) > 0.05");
content = content.replace(/Math\.abs\(diffLng\) > 0\.015/g, "Math.abs(diffLng) > 0.05");
fs.writeFileSync("src/components/Simulation3DModal.jsx", content);
console.log("3D Modal fallback snap threshold updated!");
