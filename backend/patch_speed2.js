const fs = require("fs");
let content = fs.readFileSync("src/services/simulator.js", "utf8");

const oldCode = `      // ── Movement logic ─────────────────────────────────────────────────────
      let nextIndex = routeIndex + 1;
      if (nextIndex >= route.length) nextIndex = route.length - 1;
      const [nextLng, nextLat] = route[nextIndex];
      const [prevLng, prevLat] = route[routeIndex];

      const distKm   = haversineKm(prevLat, prevLng, nextLat, nextLng);
      const speed    = Math.min(110, Math.max(20, (distKm / (TICK_MS / 3_600_000)) * 8));`;

const newCode = `      // ── Movement logic ─────────────────────────────────────────────────────
      const speed = 75 + Math.random() * 15; // 75-90 km/h (Respeitando vias reais para caminhoes)
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
      const distKm = distToTravelM / 1000;`;

if (content.includes(oldCode)) {
  content = content.replace(oldCode, newCode);
  fs.writeFileSync("src/services/simulator.js", content);
  console.log("Patched successfully!");
} else {
  console.log("oldCode not found!");
}
