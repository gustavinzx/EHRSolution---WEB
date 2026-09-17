const turf = require("@turf/turf");
const line = turf.lineString([[-47, -15], [-47.1, -15.1]]);
const pt = turf.point([-47.05, -15.05]);
const snapped = turf.nearestPointOnLine(line, pt, { units: "meters" });
console.log(snapped.properties);
