const fs = require("fs");
let content = fs.readFileSync("src/components/Simulation3DModal.jsx", "utf8");

const oldCode = `          let targetDist = 0;
          if (idx > 0) {
            for (let i = 0; i < idx; i++) {
              targetDist += turf.distance(turf.point(rawGeo[i]), turf.point(rawGeo[i+1]), { units: 'meters' });
            }
          }`;

const newCode = `          let targetDist = 0;
          if (idx > 0) {
            for (let i = 0; i < idx; i++) {
              targetDist += turf.distance(turf.point(rawGeo[i]), turf.point(rawGeo[i+1]), { units: 'meters' });
            }
          }
          if (idx < rawGeo.length - 1 && liveTruck.lat && liveTruck.lng) {
            targetDist += turf.distance(turf.point(rawGeo[idx]), turf.point([parseFloat(liveTruck.lng), parseFloat(liveTruck.lat)]), { units: 'meters' });
          }`;

if (content.includes(oldCode)) {
  content = content.replace(oldCode, newCode);
  fs.writeFileSync("src/components/Simulation3DModal.jsx", content);
  console.log("3D targetDist patched!");
} else {
  console.log("oldCode not found!");
}
