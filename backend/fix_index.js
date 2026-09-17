const fs = require("fs");
let content = fs.readFileSync("src/index.js", "utf8");

const checkLogic = `
  console.log(\`Server running on port \${PORT}\`);
  
  // Verificação de segurança: rotas ausentes
  const db = require('./config/db');
  db.query('SELECT COUNT(*) FROM trucks WHERE route_geometry IS NULL')
    .then(res => {
      const count = parseInt(res.rows[0].count);
      if (count > 0) {
        console.warn(\`\\n[AVISO CRÍTICO] Existem \${count} caminhões sem rota calculada (route_geometry IS NULL).\`);
        console.warn('[AVISO CRÍTICO] O simulador não moverá esses caminhões. Rode "npm run seed" para repopular as rotas!\\n');
      }
    })
    .catch(console.error);

  startSimulator(io);
`;

content = content.replace("console.log(`Server running on port ${PORT}`);\n  startSimulator(io);", checkLogic);

fs.writeFileSync("src/index.js", content);
