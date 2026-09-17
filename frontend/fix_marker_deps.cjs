const fs = require("fs");

// 1. Fix LiveTruckMarker dependencies
let content = fs.readFileSync("src/components/LiveTruckMarker.jsx", "utf8");
content = content.replace(
  "}, [truck.route_index, routeGeometry]);",
  "}, [truck.route_index, truck.lat, truck.lng, routeGeometry]);"
);
content = content.replace(/> 5000/g, "> 20000"); // Increase snap threshold
fs.writeFileSync("src/components/LiveTruckMarker.jsx", content);

// 2. Fix Simulation3DModal snap threshold
let content2 = fs.readFileSync("src/components/Simulation3DModal.jsx", "utf8");
content2 = content2.replace(/> 5000/g, "> 20000"); // Increase snap threshold
fs.writeFileSync("src/components/Simulation3DModal.jsx", content2);

console.log("Frontend patched!");
