const fs = require("fs");
let content = fs.readFileSync("src/seed/seed.js", "utf8");

content = content.replace(
  "        const response = await fetch('https://nominatim.openstreetmap.org/search?q=' + encodeURIComponent(address) + '&format=json&limit=1', {\n            headers: { 'User-Agent': 'EHR-Fleet-Prototype/1.0' }\n          });",
  "        const response = await fetch('https://nominatim.openstreetmap.org/search?q=' + encodeURIComponent(address) + '&format=json&limit=1', {\n            headers: { 'User-Agent': 'EHR-Fleet-Prototype/1.0' },\n            signal: AbortSignal.timeout(8000)\n          });"
);

content = content.replace(
  "          const osrmRes = await fetch(osrmUrl);",
  "          const osrmRes = await fetch(osrmUrl, { signal: AbortSignal.timeout(10000) });"
);

fs.writeFileSync("src/seed/seed.js", content);
console.log("Bug 7 (seed.js timeout) patched");
