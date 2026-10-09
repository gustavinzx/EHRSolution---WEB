const fs = require('fs');
let c = fs.readFileSync('backend/tests/facial.test.js', 'utf8');
c = c.replace(/delete require\.cache\[require\.resolve\('\.\.\/src\/services\/faceProvider\/index\.js'\)\];\s*delete require\.cache\[require\.resolve\('\.\.\/src\/services\/faceProvider'\)\];/g, "Object.keys(require.cache).forEach(k => { if (k.includes('faceProvider')) delete require.cache[k] });");
fs.writeFileSync('backend/tests/facial.test.js', c);
