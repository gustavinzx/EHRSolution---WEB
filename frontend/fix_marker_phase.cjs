const fs = require("fs");
let content = fs.readFileSync("src/components/LiveTruckMarker.jsx", "utf8");

const oldLogic = `      if (!routeInitializedRef.current || Math.abs(dist - currentDistanceRef.current) > 50000) {
        // Start at the current route position, or reset when a new trip starts.
        currentDistanceRef.current = dist;
        routeInitializedRef.current = true;
      }`;

const newLogic = `      const phaseChanged = truck.route_phase !== latestRef.current?.route_phase;
      if (!routeInitializedRef.current || phaseChanged || Math.abs(dist - currentDistanceRef.current) > 50000) {
        // Start at the current route position, or reset when a new trip starts or phase changes (detour).
        currentDistanceRef.current = dist;
        routeInitializedRef.current = true;
      }`;

content = content.replace(oldLogic, newLogic);
fs.writeFileSync("src/components/LiveTruckMarker.jsx", content);
console.log("LiveTruckMarker phase snap patched!");
