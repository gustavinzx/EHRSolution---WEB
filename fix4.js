const fs = require('fs');
let c = fs.readFileSync('backend/src/controllers/fuelingController.js', 'utf8');
c = c.replace(/CAST\(\$2 AS VARCHAR\)/g, '$4');
c = c.replace(/\[sessionId, releaseMethod, JSON\.stringify\(extraMeta\)\]/g, "[sessionId, releaseMethod, JSON.stringify(extraMeta), releaseMethod]");
fs.writeFileSync('backend/src/controllers/fuelingController.js', c);
