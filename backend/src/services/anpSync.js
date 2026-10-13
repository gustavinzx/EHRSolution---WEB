const db = require('../config/db');

const ALL_UFS = [
  'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO',
  'MA', 'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR',
  'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO'
];

const DEFAULT_ANP_API_BASE = 'https://revendedoresapi.anp.gov.br/v1';
const USER_AGENT = 'EHR-Solutions-Fleet-Manager/1.0 (+https://github.com/gustavinzx/EHRSolution---WEB)';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function parseBrazilCoords(rawLat, rawLng) {
  if (rawLat === null || rawLat === undefined || rawLng === null || rawLng === undefined) {
    return { lat: null, lng: null };
  }
  const sLat = String(rawLat).trim().replace(',', '.');
  const sLng = String(rawLng).trim().replace(',', '.');
  if (sLat === '' || sLng === '') {
    return { lat: null, lng: null };
  }
  const lat = Number(sLat);
  const lng = Number(sLng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { lat: null, lng: null };
  }
  if (lat === 0 && lng === 0) {
    return { lat: null, lng: null };
  }
  if (lat < -34.0 || lat > 6.0 || lng < -74.5 || lng > -28.0) {
    return { lat: null, lng: null };
  }
  return {
    lat: Number(lat.toFixed(7)),
    lng: Number(lng.toFixed(7))
  };
}

function normalizeAnpRecord(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const cnpj = String(raw.cnpj ?? '').replace(/\D/g, '');
  if (cnpj.length !== 14) return null;

  const razao_social = String(raw.razaoSocial ?? '').trim();
  if (!razao_social) return null;

  const uf = String(raw.uf ?? '').trim().toUpperCase();
  if (uf.length !== 2) return null;

  const cepDigits = String(raw.cep ?? '').replace(/\D/g, '');
  const cep = cepDigits.length > 0 && cepDigits.length <= 8
    ? cepDigits.padStart(8, '0')
    : null;

  const codigo_simp = String(raw.codigoSIMP ?? '').trim() || null;
  const autorizacao = String(raw.autorizacao ?? '').trim() || null;
  const data_publicacao = String(raw.dataPublicacao ?? '').trim() || null;
  const endereco = String(raw.endereco ?? '').trim() || null;
  const complemento = String(raw.complemento ?? '').trim() || null;
  const bairro = String(raw.bairro ?? '').trim() || null;
  const municipio = String(raw.municipio ?? '').trim() || null;
  const bandeira = String(raw.distribuidora ?? raw.bandeira ?? '').trim() || null;
  const data_vinculacao = String(raw.dataVinculacao ?? '').trim() || null;

  const { lat, lng } = parseBrazilCoords(raw.latitude, raw.longitude);

  const rawAcc = String(raw.estimativaAcuracia ?? '').trim().replace(',', '.');
  const numAcc = rawAcc !== '' ? Number(rawAcc) : NaN;
  const acuracia_metros = Number.isFinite(numAcc) && numAcc >= 0 ? numAcc : null;

  const sigafRaw = String(raw.statusSIGAF ?? '').trim();
  const situacao_sigaf = sigafRaw !== '' ? sigafRaw : null;

  const produtos = Array.isArray(raw.produtos)
    ? raw.produtos.map(p => ({
        produto: String(p?.produto ?? '').trim(),
        tancagem: Number(p?.tancagem) || 0,
        unidMedidaTancagem: String(p?.unidMedidaTancagem ?? '').trim(),
        qtdeBicos: Number(p?.qtdeBicos) || 0
      }))
    : null;

  return {
    cnpj,
    codigo_simp,
    autorizacao,
    data_publicacao,
    razao_social,
    endereco,
    complemento,
    bairro,
    cep,
    uf,
    municipio,
    bandeira,
    data_vinculacao,
    lat,
    lng,
    acuracia_metros,
    situacao_sigaf,
    produtos
  };
}

function parseAnpPage(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Resposta inválida da API ANP');
  }
  if (payload.succeeded === false) {
    throw new Error(payload.title || payload.message || 'API ANP retornou succeeded=false');
  }
  if (!Array.isArray(payload.data)) {
    throw new Error('Formato de resposta inválido da API ANP: campo data ausente');
  }

  const pageFilter = payload.searchPageFilter || {};
  const numeroPagina = Number(pageFilter.numeroPagina) || 1;
  const totalPagina = Number(pageFilter.totalPagina) || 1;
  const totalRegistro = pageFilter.totalRegistro !== undefined
    ? Number(pageFilter.totalRegistro)
    : payload.data.length;

  const items = [];
  for (const rawItem of payload.data) {
    const normalized = normalizeAnpRecord(rawItem);
    if (normalized) {
      items.push(normalized);
    }
  }

  return {
    items,
    rawCount: payload.data.length,
    numeroPagina,
    totalPagina,
    totalRegistro
  };
}

async function fetchAnpPageWithRetry(uf, page, options = {}) {
  const baseUrl = (options.baseUrl || process.env.ANP_API_BASE || DEFAULT_ANP_API_BASE).replace(/\/+$/, '');
  const timeoutMs = options.timeoutMs ?? 30000;
  const maxRetries = options.maxRetries ?? 3;
  const retryBaseDelayMs = options.retryBaseDelayMs ?? 1000;
  const fetchFn = options.fetchFn || global.fetch;

  const url = `${baseUrl}/combustivel?uf=${encodeURIComponent(uf)}&numeropagina=${page}`;
  let lastError = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchFn(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': USER_AGENT
        },
        signal: controller.signal
      });
      clearTimeout(timer);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ao consultar ANP (${uf} p.${page})`);
      }

      const json = await response.json();
      return parseAnpPage(json);
    } catch (err) {
      clearTimeout(timer);
      lastError = err;
      if (attempt < maxRetries) {
        await sleep(retryBaseDelayMs * attempt);
      }
    }
  }

  throw lastError || new Error(`Falha ao consultar ANP (${uf} p.${page})`);
}

async function syncUf(uf, options = {}) {
  const ufNorm = String(uf || '').trim().toUpperCase();
  if (!ALL_UFS.includes(ufNorm)) {
    throw new Error(`UF inválida: ${uf}`);
  }

  const pageDelayMs = options.pageDelayMs ?? 1000;

  const runRes = await db.query(
    `INSERT INTO anp_sync_runs (scope, status, started_at)
     VALUES ($1, 'running', NOW())
     RETURNING id, started_at`,
    [ufNorm]
  );
  const runId = runRes.rows[0].id;

  const client = await db.pool.connect();
  let fetched = 0;
  let inserted = 0;
  let updated = 0;
  let deactivated = 0;

  try {
    await client.query('BEGIN');

    let currentPage = 1;
    let totalPages = 1;
    const seenCnpjs = new Set();

    while (currentPage <= totalPages) {
      if (currentPage > 1 && pageDelayMs > 0) {
        await sleep(pageDelayMs);
      }

      const pageData = await fetchAnpPageWithRetry(ufNorm, currentPage, options);
      totalPages = Math.max(1, pageData.totalPagina);

      for (const rec of pageData.items) {
        fetched++;
        const isFirstInRun = !seenCnpjs.has(rec.cnpj);
        seenCnpjs.add(rec.cnpj);

        const upsertRes = await client.query(
          `INSERT INTO anp_stations (
             cnpj, codigo_simp, autorizacao, data_publicacao, razao_social,
             endereco, complemento, bairro, cep, uf, municipio, bandeira,
             data_vinculacao, lat, lng, acuracia_metros, situacao_sigaf,
             produtos, is_active, first_seen_at, last_seen_at, updated_at
           ) VALUES (
             $1, $2, $3, $4, $5,
             $6, $7, $8, $9, $10, $11, $12,
             $13, $14, $15, $16, $17,
             $18::jsonb, true, NOW(), NOW(), NOW()
           )
           ON CONFLICT (cnpj) DO UPDATE SET
             codigo_simp = EXCLUDED.codigo_simp,
             autorizacao = EXCLUDED.autorizacao,
             data_publicacao = EXCLUDED.data_publicacao,
             razao_social = EXCLUDED.razao_social,
             endereco = EXCLUDED.endereco,
             complemento = EXCLUDED.complemento,
             bairro = EXCLUDED.bairro,
             cep = EXCLUDED.cep,
             uf = EXCLUDED.uf,
             municipio = EXCLUDED.municipio,
             bandeira = EXCLUDED.bandeira,
             data_vinculacao = EXCLUDED.data_vinculacao,
             lat = EXCLUDED.lat,
             lng = EXCLUDED.lng,
             acuracia_metros = EXCLUDED.acuracia_metros,
             situacao_sigaf = EXCLUDED.situacao_sigaf,
             produtos = EXCLUDED.produtos,
             is_active = true,
             last_seen_at = NOW(),
             updated_at = NOW()
           RETURNING cnpj, (xmax = 0) AS is_insert`,
          [
            rec.cnpj,
            rec.codigo_simp,
            rec.autorizacao,
            rec.data_publicacao,
            rec.razao_social,
            rec.endereco,
            rec.complemento,
            rec.bairro,
            rec.cep,
            rec.uf,
            rec.municipio,
            rec.bandeira,
            rec.data_vinculacao,
            rec.lat,
            rec.lng,
            rec.acuracia_metros,
            rec.situacao_sigaf,
            rec.produtos ? JSON.stringify(rec.produtos) : null
          ]
        );

        if (isFirstInRun && upsertRes.rows.length > 0) {
          if (upsertRes.rows[0].is_insert) {
            inserted++;
          } else {
            updated++;
          }
        }
      }

      currentPage++;
    }

    if (seenCnpjs.size > 0) {
      const deactRes = await client.query(
        `UPDATE anp_stations
         SET is_active = false, updated_at = NOW()
         WHERE uf = $1
           AND is_active = true
           AND NOT (cnpj = ANY($2::char(14)[]))`,
        [ufNorm, Array.from(seenCnpjs)]
      );
      deactivated = deactRes.rowCount || 0;
    }

    await client.query('COMMIT');

    const finRes = await db.query(
      `UPDATE anp_sync_runs
       SET status = 'succeeded',
           finished_at = NOW(),
           fetched = $1,
           inserted = $2,
           updated = $3,
           deactivated = $4
       WHERE id = $5
       RETURNING id, scope, status, started_at, finished_at, fetched, inserted, updated, deactivated, error`,
      [fetched, inserted, updated, deactivated, runId]
    );

    return finRes.rows[0];
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {}

    await db.query(
      `UPDATE anp_sync_runs
       SET status = 'failed',
           finished_at = NOW(),
           fetched = $1,
           inserted = 0,
           updated = 0,
           deactivated = 0,
           error = $2
       WHERE id = $3`,
      [fetched, err.message || String(err), runId]
    );

    throw err;
  } finally {
    client.release();
  }
}

async function syncAll(options = {}) {
  const pageDelayMs = options.pageDelayMs ?? 1000;
  const results = [];

  for (let i = 0; i < ALL_UFS.length; i++) {
    const uf = ALL_UFS[i];
    if (i > 0 && pageDelayMs > 0) {
      await sleep(pageDelayMs);
    }
    const res = await syncUf(uf, options);
    results.push(res);
  }

  return results;
}

module.exports = {
  ALL_UFS,
  DEFAULT_ANP_API_BASE,
  USER_AGENT,
  parseBrazilCoords,
  normalizeAnpRecord,
  parseAnpPage,
  fetchAnpPageWithRetry,
  syncUf,
  syncAll
};
