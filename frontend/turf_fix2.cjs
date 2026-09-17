const fs = require("fs");
let content = fs.readFileSync("src/components/Simulation3DModal.jsx", "utf8");

content = content.replace(
  /let targetDist = 0;\s*if \(idx > 0\) \{\s*for \(let i = 0; i < idx; i\+\+\) \{\s*targetDist \+= turf\.distance\(turf\.point\(rawGeo\[i\]\), turf\.point\(rawGeo\[i\+1\]\), \{ units: 'meters' \}\);\s*\}\s*\}/,
  `let targetDist = 0;
          if (idx > 0) {
            for (let i = 0; i < idx; i++) {
              targetDist += turf.distance(turf.point(rawGeo[i]), turf.point(rawGeo[i+1]), { units: 'meters' });
            }
          }
          if (idx < rawGeo.length - 1 && liveTruck.lat && liveTruck.lng) {
            targetDist += turf.distance(turf.point(rawGeo[idx]), turf.point([parseFloat(liveTruck.lng), parseFloat(liveTruck.lat)]), { units: 'meters' });
          }`
);

fs.writeFileSync("src/components/Simulation3DModal.jsx", content);
console.log("Regex patch done!");
