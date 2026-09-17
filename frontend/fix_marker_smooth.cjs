const fs = require("fs");
let content = fs.readFileSync("src/components/LiveTruckMarker.jsx", "utf8");
content = content.replace("dt / 2500", "dt / 3100"); // 3.1s to ensure it always flows into the next tick
fs.writeFileSync("src/components/LiveTruckMarker.jsx", content);
console.log("LiveTruckMarker interpolation smoothed!");
