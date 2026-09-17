const fs = require("fs");
let content = fs.readFileSync("src/hooks/useFleet.js", "utf8");
content = content.replace("route: routeRes.data", "telemetry: routeRes.data");
fs.writeFileSync("src/hooks/useFleet.js", content);
console.log("Bug 0 fixed");
