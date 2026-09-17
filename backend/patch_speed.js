const fs = require("fs");
let content = fs.readFileSync("src/services/simulator.js", "utf8");

content = content.replace(
  /let nextIndex = routeIndex \+ 1;\s*if \(nextIndex >= route\.length\) nextIndex = route\.length - 1;\s*const \[nextLng, nextLat\] = route\[nextIndex\];\s*const \[prevLng, prevLat\] = route\[routeIndex\];\s*const distKm   = haversineKm\(prevLat, prevLng, nextLat, nextLng\);\s*const speed    = Math\.min\(110, Math\.max\(20, \(distKm \/ \(TICK_MS \/ 3_600_000\)\) \* 8\)\);/,
  `// Target speed ~70 km/h with some variation
      const speed = 65 + Math.random() * 15; // 65-80 km/h
      const distToTravelM = (speed * 1000 / 3600) * (TICK_MS / 1000);
      let remainingM = distToTravelM;
      
      let nextIndex = routeIndex;
      let curLat = parseFloat(truck.lat);
      let curLng = parseFloat(truck.lng);
      
      while (remainingM > 0 && nextIndex < route.length - 1) {
        const [targetLng, targetLat] = route[nextIndex + 1];
        const segDistM = haversineM(curLat, curLng, targetLat, targetLng);
        
        if (segDistM <= remainingM) {
          curLat = targetLat;
          curLng = targetLng;
          remainingM -= segDistM;
          nextIndex++;
        } else {
          const ratio = remainingM / segDistM;
          curLat = curLat + (targetLat - curLat) * ratio;
          curLng = curLng + (targetLng - curLng) * ratio;
          remainingM = 0;
        }
      }
      
      const nextLat = curLat;
      const nextLng = curLng;
      const prevLat = parseFloat(truck.lat);
      const prevLng = parseFloat(truck.lng);
      const distKm = distToTravelM / 1000;`
);

fs.writeFileSync("src/services/simulator.js", content);
