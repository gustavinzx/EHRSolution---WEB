const turf = require("@turf/turf");
const route = [
  [-44.239508, -18.081917], // index 0
  [-44.239588, -18.082019], // index 1
  [-44.240608, -18.083313], // index 2
];
const idx = 1;

// Base dist up to idx 1
let dist = turf.distance(turf.point(route[0]), turf.point(route[1]), { units: 'meters' });
console.log("Base dist:", dist);

// Truck is between idx 1 and idx 2
const truckPos = [-44.24000, -18.08250]; // roughly middle
dist += turf.distance(turf.point(route[idx]), turf.point(truckPos), { units: 'meters' });
console.log("Total dist:", dist);
