const fs = require("fs");
let content = fs.readFileSync("src/components/LiveTruckMarker.jsx", "utf8");

const oldCode = `    const idx = Math.min(Math.max(0, truck.route_index), routeGeometry.length - 1);
    let dist = 0;
    if (idx > 0) {
      for (let i = 0; i < idx; i++) {
        dist += turf.distance(turf.point(routeGeometry[i]), turf.point(routeGeometry[i+1]), { units: 'meters' });
      }
    }`;

const newCode = `    const idx = Math.min(Math.max(0, truck.route_index), routeGeometry.length - 1);
    let dist = 0;
    if (idx > 0) {
      for (let i = 0; i < idx; i++) {
        dist += turf.distance(turf.point(routeGeometry[i]), turf.point(routeGeometry[i+1]), { units: 'meters' });
      }
    }
    // Adiciona a distância do último nó até a posição física atual (evita travamento do marcador)
    if (idx < routeGeometry.length - 1 && truck.lat && truck.lng) {
      const nodePos = routeGeometry[idx];
      const truckPos = [parseFloat(truck.lng), parseFloat(truck.lat)];
      dist += turf.distance(turf.point(nodePos), turf.point(truckPos), { units: 'meters' });
    }`;

content = content.replace(oldCode, newCode);
fs.writeFileSync("src/components/LiveTruckMarker.jsx", content);
console.log("LiveTruckMarker interpolation fixed!");
