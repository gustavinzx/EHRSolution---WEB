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

function parseCliArgs(argv) {
  return {
    uf: parseUfArg(argv),
    allowMassDeactivation: argv.includes('--allow-mass-deactivation')
  };
}

async function main(argv = process.argv.slice(2), options = {}) {
  const { uf, allowMassDeactivation } = parseCliArgs(argv);
  if (uf && !ALL_UFS.includes(uf)) {
    console.error(`[ANP-SYNC] UF inválida: "${uf}". UFs válidas: ${ALL_UFS.join(', ')}`);
    process.exit(1);
  }

  const syncOptions = {
    ...options,
    allowMassDeactivation: options.allowMassDeactivation ?? allowMassDeactivation
  };

  try {
    if (options.skipMigrations !== true) {
      await runMigrations();
    }

    if (uf) {
      console.log(
        `[ANP-SYNC] Iniciando sincronização da UF=${uf}${syncOptions.allowMassDeactivation ? ' (--allow-mass-deactivation ativo)' : ''}...`
      );
      const res = await syncUf(uf, syncOptions);
      console.log(
        `[ANP-SYNC] Concluído UF=${res.scope}: status=${res.status}, fetched=${res.fetched}, inserted=${res.inserted}, updated=${res.updated}, deactivated=${res.deactivated}`
      );
      if (res.status === 'partial' && res.error) {
        console.warn(`[ANP-SYNC] Aviso (${res.scope}): ${res.error}`);
      }
    } else {
      console.log(
        `[ANP-SYNC] Iniciando sincronização nacional (27 UFs)${syncOptions.allowMassDeactivation ? ' (--allow-mass-deactivation ativo)' : ''}...`
      );
      const results = await syncAll(syncOptions);
      let totalFetched = 0;
      let totalInserted = 0;
      let totalUpdated = 0;
      let totalDeactivated = 0;
      const failedUfs = [];

      for (const r of results) {
        totalFetched += r.fetched || 0;
        totalInserted += r.inserted || 0;
        totalUpdated += r.updated || 0;
        totalDeactivated += r.deactivated || 0;
        console.log(
          `[ANP-SYNC] UF=${r.scope} [${r.status}]: fetched=${r.fetched}, inserted=${r.inserted}, updated=${r.updated}, deactivated=${r.deactivated}`
        );
        if (r.status === 'partial' && r.error) {
          console.warn(`[ANP-SYNC] Aviso UF=${r.scope}: ${r.error}`);
        }
        if (r.status === 'failed') {
          failedUfs.push(r);
        }
      }

      console.log(
        `[ANP-SYNC] Total Nacional: fetched=${totalFetched}, inserted=${totalInserted}, updated=${totalUpdated}, deactivated=${totalDeactivated}`
      );

      if (failedUfs.length > 0) {
        console.error(`[ANP-SYNC] Falhas detectadas em ${failedUfs.length} UF(s):`);
        for (const f of failedUfs) {
          console.error(`  - ${f.scope}: ${f.error}`);
        }
        process.exitCode = 1;
      }
    }
  } catch (err) {
    console.error('[ANP-SYNC] Erro fatal na sincronização:', err.message || err);
    process.exitCode = 1;
  } finally {
    if (options.closePool !== false) {
      await db.pool.end();
    }
  }
}

if (require.main === module) {
  main();
}

module.exports = { parseUfArg, parseCliArgs, main };
