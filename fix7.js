const fs = require('fs');
let c = fs.readFileSync('backend/tests/facial.test.js', 'utf8');
c = c.replace(/const p = require\('path'\)\.resolve\(__dirname, '\.\.\/src\/services\/faceProvider\/index\.js'\);\s*delete require\.cache\[p\];\s*require\(p\);/, "require('child_process').execSync('node -e \\\"process.env.NODE_ENV=\\'production\\'; process.env.FACE_PROVIDER=\\'mock\\'; require(\\'./src/services/faceProvider/index.js\\')\\\"', { cwd: __dirname + '/../' })");
fs.writeFileSync('backend/tests/facial.test.js', c);
