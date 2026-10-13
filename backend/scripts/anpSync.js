require('dotenv').config();
const db = require('../src/config/db');
const { runMigrations } = require('../src/migrations/runner');
const { syncUf, syncAll, ALL_UFS } = require('../src/services/anpSync');

function parseUfArg(argv) {
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--uf' && argv[i + 1]) {
      return String(argv[i + 1]).trim().toUpperCase();
    }
    if (arg.startsWith('--uf=')) {
      return String(arg.split('=')[1] || '').trim().toUpperCase();
    }
  }
  return null;
}

async function main() {
  const uf = parseUfArg(process.argv.slice(2));
  if (uf && !ALL_UFS.includes(uf)) {
    console.error(`[ANP-SYNC] UF inválida: "${uf}". UFs válidas: ${ALL_UFS.join(', ')}`);
    process.exit(1);
  }

  try {
    await runMigrations();

    if (uf) {
      console.log(`[ANP-SYNC] Iniciando sincronização da UF=${uf}...`);
      const res = await syncUf(uf);
      console.log(`[ANP-SYNC] Concluído UF=${res.scope}: status=${res.status}, fetched=${res.fetched}, inserted=${res.inserted}, updated=${res.updated}, deactivated=${res.deactivated}`);
    } else {
      console.log(`[ANP-SYNC] Iniciando sincronização nacional (27 UFs)...`);
      const results = await syncAll();
      let totalFetched = 0;
      let totalInserted = 0;
      let totalUpdated = 0;
      let totalDeactivated = 0;
      for (const r of results) {
        totalFetched += r.fetched;
        totalInserted += r.inserted;
        totalUpdated += r.updated;
        totalDeactivated += r.deactivated;
        console.log(`[ANP-SYNC] UF=${r.scope}: fetched=${r.fetched}, inserted=${r.inserted}, updated=${r.updated}, deactivated=${r.deactivated}`);
      }
      console.log(`[ANP-SYNC] Total Nacional: fetched=${totalFetched}, inserted=${totalInserted}, updated=${totalUpdated}, deactivated=${totalDeactivated}`);
    }
  } catch (err) {
    console.error('[ANP-SYNC] Erro fatal na sincronização:', err.message || err);
    process.exitCode = 1;
  } finally {
    await db.pool.end();
  }
}

if (require.main === module) {
  main();
}

module.exports = { parseUfArg, main };
