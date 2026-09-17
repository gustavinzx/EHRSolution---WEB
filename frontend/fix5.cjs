const fs = require("fs");
let content = fs.readFileSync("src/pages/TruckDetailsPage.jsx", "utf8");

content = content.replace(
  "  if (!currentPos && !isNaN(truck.lat) && !isNaN(truck.lng)) {\n    currentPos = [parseFloat(truck.lat), parseFloat(truck.lng)];",
  "  const lat = parseFloat(truck.lat);\n  const lng = parseFloat(truck.lng);\n  if (!currentPos && !isNaN(lat) && !isNaN(lng)) {\n    currentPos = [lat, lng];"
);
fs.writeFileSync("src/pages/TruckDetailsPage.jsx", content);
console.log("Bug 5 patched");
