const fs = require('fs');
let c = fs.readFileSync('backend/tests/facial.test.js', 'utf8');
c = c.replace(/Object\.keys\(require\.cache\).*?require\('\.\.\/src\/services\/faceProvider\/index\.js'\);/s, `const p = require('path').resolve(__dirname, '../src/services/faceProvider/index.js');
      delete require.cache[p];
      require(p);`);
fs.writeFileSync('backend/tests/facial.test.js', c);
