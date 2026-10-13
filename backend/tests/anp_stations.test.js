const path = require('path');
const fs = require('fs');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const db = require('../src/config/db');
const { app } = require('../src/index');
const {
  parseBrazilCoords,
  normalizeAnpRecord,
  parseAnpPage,
  fetchAnpPageWithRetry,
  syncUf,
  syncAll
} = require('../src/services/anpSync');
const { isInterdicted, normalizeSigafStatus } = require('../src/services/anpStatus');
const { parseCliArgs, main: runAnpSyncCli } = require('../scripts/anpSync');

const clean = require('./clean');

const sampleFixturePath = path.join(__dirname, 'fixtures', 'anp_combustivel_sample.json');
const sampleFixture = JSON.parse(fs.readFileSync(sampleFixturePath, 'utf8'));

// Versão da fixture ajustando totalRegistro=6 para representar página completa de 6 itens
const sampleComplete6 = {
  ...sampleFixture,
  searchPageFilter: {
    ...sampleFixture.searchPageFilter,
    totalRegistro: sampleFixture.data.length,
    totalPagina: 1,
    numeroPagina: 1
  }
};

function makeRawStations(count, uf = 'DF', seedOffset = 0) {
  const ufCode = (uf.charCodeAt(0) * 100 + uf.charCodeAt(1)) % 9000;
  const list = [];
  for (let i = 1; i <= count; i++) {
    const num = 10000000000000 + ufCode * 1000000 + seedOffset + i;
    const cnpj = String(num).padStart(14, '0');
    list.push({
      ...sampleFixture.data[0],
      codigoSIMP: 2000000 + i,
      cnpj,
      razaoSocial: `POSTO TESTE ${uf} ${i} LTDA`,
      uf,
      municipio: 'BRASILIA',
      distribuidora: 'VIBRA',
      latitude: '-15.7944167',
      longitude: '-48.0158659',
      statusSIGAF: ''
    });
  }
  return list;
}

const ALLOWED_KEYS = [
  'cnpj',
  'razao_social',
  'endereco',
  'bairro',
  'cep',
  'uf',
  'municipio',
  'bandeira',
  'lat',
  'lng',
  'acuracia_metros',
  'situacao_sigaf',
  'interdicted',
  'produtos',
  'is_active',
  'last_seen_at'
];

const FORBIDDEN_INTERNAL_KEYS = [
  'id',
  'codigo_simp',
  'autorizacao',
  'data_publicacao',
  'complemento',
  'data_vinculacao',
  'first_seen_at',
  'created_at',
  'updated_at'
];

describe('Catálogo Nacional de Postos ANP (Parser, Sync, Trava de Desativação, Interdição e API)', () => {
  let tokenManager;
  let tokenAuditor;
  let tokenDriver;

  beforeAll(async () => {
    await clean();
    await db.query('DELETE FROM anp_stations');
    await db.query('DELETE FROM anp_sync_runs');

    const mRes = await db.query(
      "INSERT INTO users (email, password_hash, name, role, is_active) VALUES ('mgr_anp@test.com', 'hash', 'Manager ANP', 'manager', true) RETURNING id"
    );
    tokenManager = jwt.sign(
      { id: mRes.rows[0].id, email: 'mgr_anp@test.com', role: 'manager' },
      process.env.JWT_SECRET
    );

    const audRes = await db.query(
      "INSERT INTO users (email, password_hash, name, role, is_active) VALUES ('aud_anp@test.com', 'hash', 'Auditor ANP', 'auditor', true) RETURNING id"
    );
    tokenAuditor = jwt.sign(
      { id: audRes.rows[0].id, email: 'aud_anp@test.com', role: 'auditor' },
      process.env.JWT_SECRET
    );

    const drvRes = await db.query(
      "INSERT INTO drivers (name, email, is_active) VALUES ('Driver ANP', 'drv_anp@test.com', true) RETURNING id"
    );
    tokenDriver = jwt.sign(
      { id: drvRes.rows[0].id, email: 'drv_anp@test.com', role: 'driver' },
      process.env.JWT_SECRET
    );
  });

  afterAll(async () => {
    await db.query('DELETE FROM anp_stations');
    await db.query('DELETE FROM anp_sync_runs');
    await db.pool.end();
  });

  describe('1. Parser com fixture real, Normalização e isInterdicted (Bloco B / C2)', () => {
    it('parseAnpPage processa a fixture real da ANP preservando os campos e produtos', () => {
      const parsed = parseAnpPage(sampleFixture);
      expect(parsed.numeroPagina).toBe(1);
      expect(parsed.totalPagina).toBe(1);
      expect(parsed.totalRegistro).toBe(392);
      expect(parsed.items.length).toBe(6);

      const first = parsed.items[0];
      expect(first.cnpj).toBe('48386351000109');
      expect(first.razao_social).toBe('AUTO POSTO VICENTTE PIRES LTDA');
      expect(first.uf).toBe('DF');
      expect(first.municipio).toBe('BRASILIA');
      expect(first.bandeira).toBe('LARCO');
      expect(first.cep).toBe('72006027');
      expect(first.lat).toBeCloseTo(-15.7944167, 6);
      expect(first.lng).toBeCloseTo(-48.0158659, 6);
      expect(first.acuracia_metros).toBeNull();
      expect(Array.isArray(first.produtos)).toBe(true);
      expect(first.produtos[0]).toEqual({
        produto: 'ETANOL HIDRATADO COMUM',
        tancagem: 15,
        unidMedidaTancagem: 'm³',
        qtdeBicos: 6
      });

      const second = parsed.items[1];
      expect(second.acuracia_metros).toBe(4);
      expect(second.bandeira).toBe('BANDEIRA BRANCA');

      const sixth = parsed.items[5];
      expect(sixth.cnpj).toBe('00001974000190');
      expect(sixth.lat).toBeNull();
      expect(sixth.lng).toBeNull();
    });

    it('Normaliza CNPJ (somente 14 dígitos), CEP (8 dígitos com zero à esquerda), textos com trim e coordenadas inválidas', () => {
      const rec = normalizeAnpRecord({
        cnpj: '48.386.351/0001-09',
        razaoSocial: '  POSTO EXEMPLO LTDA  ',
        endereco: '  AV BRASIL, 100  ',
        bairro: '  CENTRO ',
        cep: '1310100',
        uf: 'sp',
        municipio: ' SAO PAULO ',
        distribuidora: ' IPIRANGA ',
        latitude: '0',
        longitude: '0',
        estimativaAcuracia: ' 5,5 ',
        statusSIGAF: '  Interdição  ',
        produtos: []
      });

      expect(rec).not.toBeNull();
      expect(rec.cnpj).toBe('48386351000109');
      expect(rec.razao_social).toBe('POSTO EXEMPLO LTDA');
      expect(rec.endereco).toBe('AV BRASIL, 100');
      expect(rec.bairro).toBe('CENTRO');
      expect(rec.cep).toBe('01310100');
      expect(rec.uf).toBe('SP');
      expect(rec.municipio).toBe('SAO PAULO');
      expect(rec.bandeira).toBe('IPIRANGA');
      expect(rec.lat).toBeNull();
      expect(rec.lng).toBeNull();
      expect(rec.acuracia_metros).toBe(5.5);
      expect(rec.situacao_sigaf).toBe('Interdição');

      expect(parseBrazilCoords('40.7128', '-74.0060')).toEqual({ lat: null, lng: null });
      expect(parseBrazilCoords('-55.0', '-46.0')).toEqual({ lat: null, lng: null });
      expect(parseBrazilCoords('', '')).toEqual({ lat: null, lng: null });

      expect(normalizeAnpRecord({ cnpj: '12345', razaoSocial: 'Posto', uf: 'DF' })).toBeNull();
    });

    it('isInterdicted avalia valores reais do PASSO 0b, "Interdição", "Desinterdição", vazio e registra valor desconhecido (C2)', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      try {
        // Valores reais do PASSO 0b (string vazia "" na API / null no banco) e vazios
        expect(isInterdicted('')).toBe(false);
        expect(isInterdicted('   ')).toBe(false);
        expect(isInterdicted(null)).toBe(false);
        expect(isInterdicted(undefined)).toBe(false);

        // Desinterdição (com e sem acento, maiúsculas/minúsculas) => regular (false)
        expect(isInterdicted('Desinterdição')).toBe(false);
        expect(isInterdicted('desinterdicao')).toBe(false);
        expect(isInterdicted('  DESINTERDIÇÃO  ')).toBe(false);

        // Interdição (documentação ANP p. 3, 8, 10, 12) => interditado (true)
        expect(isInterdicted('Interdição')).toBe(true);
        expect(isInterdicted('interdicao')).toBe(true);
        expect(isInterdicted('interdição parcial')).toBe(true);
        expect(isInterdicted('INTERDIÇÃO TOTAL')).toBe(true);

        // Nenhum aviso emitido para valores conhecidos/vazios
        expect(warnSpy).not.toHaveBeenCalled();

        // Valor desconhecido => não interditado (false), mas registrado em log para análise
        expect(isInterdicted('Situação Cautelar 999')).toBe(false);
        expect(warnSpy).toHaveBeenCalledTimes(1);
        expect(warnSpy.mock.calls[0][0]).toContain('Situação Cautelar 999');

        expect(normalizeSigafStatus('  Desinterdição  ')).toBe('desinterdicao');
      } finally {
        warnSpy.mockRestore();
      }
    });

    it('fetchAnpPageWithRetry realiza até 3 tentativas antes de suceder ou falhar (sem rede real)', async () => {
      let calls = 0;
      const mockFetch = jest.fn(async () => {
        calls++;
        if (calls < 3) {
          throw new Error('Falha temporária simulada');
        }
        return {
          ok: true,
          status: 200,
          json: async () => sampleComplete6
        };
      });

      const pageData = await fetchAnpPageWithRetry('DF', 1, {
        fetchFn: mockFetch,
        retryBaseDelayMs: 5,
        timeoutMs: 1000
      });
      expect(calls).toBe(3);
      expect(pageData.items.length).toBe(6);
    });
  });

  describe('2. Sincronização Transacional, Trava de Desativação (A1..A3 / C1) e Rollback', () => {
    beforeEach(async () => {
      await db.query('DELETE FROM anp_stations');
      await db.query('DELETE FROM anp_sync_runs');
    });

    it('Upsert idempotente: duas rodadas consecutivas mantêm exatamente a mesma contagem de postos ativos e sem duplicatas', async () => {
      const mockFetch = jest.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => sampleComplete6
      }));

      const run1 = await syncUf('DF', { fetchFn: mockFetch, pageDelayMs: 0 });
      expect(run1.status).toBe('succeeded');
      expect(run1.fetched).toBe(6);
      expect(run1.inserted).toBe(6);
      expect(run1.updated).toBe(0);
      expect(run1.deactivated).toBe(0);

      const count1 = await db.query(
        'SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE is_active = true)::int AS active FROM anp_stations WHERE uf = $1',
        ['DF']
      );

      const run2 = await syncUf('DF', { fetchFn: mockFetch, pageDelayMs: 0 });
      expect(run2.status).toBe('succeeded');
      expect(run2.fetched).toBe(6);
      expect(run2.inserted).toBe(0);
      expect(run2.updated).toBe(6);
      expect(run2.deactivated).toBe(0);

      const count2 = await db.query(
        'SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE is_active = true)::int AS active FROM anp_stations WHERE uf = $1',
        ['DF']
      );

      expect(count1.rows[0]).toEqual({ total: 6, active: 6 });
      expect(count2.rows[0]).toEqual({ total: 6, active: 6 });
    });

    it('C1.1 Resposta truncada (2 de 10) => mantém upsert, NÃO desativa nada e grava status "partial"', async () => {
      const tenStations = makeRawStations(10, 'DF');
      const mockSeed10 = jest.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          status: 200,
          succeeded: true,
          data: tenStations,
          searchPageFilter: { numeroPagina: 1, tamanhoPagina: 5000, totalRegistro: 10, totalPagina: 1 }
        })
      }));
      await syncUf('DF', { fetchFn: mockSeed10, pageDelayMs: 0 });

      // API promete totalRegistro=10 mas devolve apenas 2 registros
      const mockTruncated = jest.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          status: 200,
          succeeded: true,
          data: tenStations.slice(0, 2),
          searchPageFilter: { numeroPagina: 1, tamanhoPagina: 5000, totalRegistro: 10, totalPagina: 1 }
        })
      }));

      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        const runTrunc = await syncUf('DF', { fetchFn: mockTruncated, pageDelayMs: 0 });
        expect(runTrunc.status).toBe('partial');
        expect(runTrunc.fetched).toBe(2);
        expect(runTrunc.updated).toBe(2);
        expect(runTrunc.deactivated).toBe(0);
        expect(runTrunc.error).toMatch(/CNPJs distintos recebidos \(2\) < totalRegistro informado pela API \(10\)/);
        expect(warnSpy).toHaveBeenCalled();

        const activeCheck = await db.query(
          'SELECT COUNT(*)::int AS cnt FROM anp_stations WHERE uf = $1 AND is_active = true',
          ['DF']
        );
        expect(activeCheck.rows[0].cnt).toBe(10);
      } finally {
        warnSpy.mockRestore();
      }
    });

    it('C1.2 Registro inválido no meio (descartado pela normalização) => sem desativação e status "partial"', async () => {
      const tenStations = makeRawStations(10, 'DF');
      const mockSeed10 = jest.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          status: 200,
          succeeded: true,
          data: tenStations,
          searchPageFilter: { numeroPagina: 1, tamanhoPagina: 5000, totalRegistro: 10, totalPagina: 1 }
        })
      }));
      await syncUf('DF', { fetchFn: mockSeed10, pageDelayMs: 0 });

      // 9 registros válidos + 1 registro com CNPJ inválido (rawCount=10, normalizados=9, totalRegistro=9)
      const invalidRecord = { ...tenStations[9], cnpj: '123' };
      const payloadWithInvalid = [...tenStations.slice(0, 9), invalidRecord];

      const mockWithInvalid = jest.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          status: 200,
          succeeded: true,
          data: payloadWithInvalid,
          searchPageFilter: { numeroPagina: 1, tamanhoPagina: 5000, totalRegistro: 9, totalPagina: 1 }
        })
      }));

      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        const runInvalid = await syncUf('DF', { fetchFn: mockWithInvalid, pageDelayMs: 0 });
        expect(runInvalid.status).toBe('partial');
        expect(runInvalid.fetched).toBe(9);
        expect(runInvalid.updated).toBe(9);
        expect(runInvalid.deactivated).toBe(0);
        expect(runInvalid.error).toMatch(/1 registro\(s\) descartado\(s\) pela normalização/);

        const activeCheck = await db.query(
          'SELECT COUNT(*)::int AS cnt FROM anp_stations WHERE uf = $1 AND is_active = true',
          ['DF']
        );
        expect(activeCheck.rows[0].cnt).toBe(10);
      } finally {
        warnSpy.mockRestore();
      }
    });

    it('C1.3 Remoção legítima de 1 de 10 (10% <= 20%) => desativa 1 posto e status "succeeded"', async () => {
      const tenStations = makeRawStations(10, 'DF');
      const mockSeed10 = jest.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          status: 200,
          succeeded: true,
          data: tenStations,
          searchPageFilter: { numeroPagina: 1, tamanhoPagina: 5000, totalRegistro: 10, totalPagina: 1 }
        })
      }));
      await syncUf('DF', { fetchFn: mockSeed10, pageDelayMs: 0 });

      // Próxima rodada em 2 páginas com 9 dos 10 postos (totalRegistro=9)
      const nineStations = tenStations.slice(0, 9);
      const mockTwoPages9 = jest.fn(async (url) => {
        const isPage2 = url.includes('numeropagina=2');
        const slice = isPage2 ? nineStations.slice(5, 9) : nineStations.slice(0, 5);
        return {
          ok: true,
          status: 200,
          json: async () => ({
            status: 200,
            succeeded: true,
            data: slice,
            searchPageFilter: {
              numeroPagina: isPage2 ? 2 : 1,
              tamanhoPagina: 5,
              totalRegistro: 9,
              totalPagina: 2
            }
          })
        };
      });

      const runLegit = await syncUf('DF', { fetchFn: mockTwoPages9, pageDelayMs: 0 });
      expect(runLegit.status).toBe('succeeded');
      expect(runLegit.fetched).toBe(9);
      expect(runLegit.updated).toBe(9);
      expect(runLegit.deactivated).toBe(1);
      expect(runLegit.error).toBeNull();

      const { rows } = await db.query(
        'SELECT cnpj, is_active FROM anp_stations WHERE uf = $1 ORDER BY cnpj ASC',
        ['DF']
      );
      expect(rows.filter(r => r.is_active).length).toBe(9);
      const inactive = rows.filter(r => !r.is_active);
      expect(inactive.length).toBe(1);
      expect(inactive[0].cnpj.trim()).toBe(tenStations[9].cnpj);
    });

    it('C1.4 Queda acima de 20% (4 de 10 = 40%) => bloqueia por padrão ("partial") e libera com --allow-mass-deactivation', async () => {
      const tenStations = makeRawStations(10, 'DF');
      const mockSeed10 = jest.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          status: 200,
          succeeded: true,
          data: tenStations,
          searchPageFilter: { numeroPagina: 1, tamanhoPagina: 5000, totalRegistro: 10, totalPagina: 1 }
        })
      }));
      await syncUf('DF', { fetchFn: mockSeed10, pageDelayMs: 0 });

      // API devolve apenas 6 de 10 (queda de 4 postos = 40% > 20%)
      const sixStations = tenStations.slice(0, 6);
      const mockDrop40Pct = jest.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          status: 200,
          succeeded: true,
          data: sixStations,
          searchPageFilter: { numeroPagina: 1, tamanhoPagina: 5000, totalRegistro: 6, totalPagina: 1 }
        })
      }));

      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        // Sem --allow-mass-deactivation => bloqueia
        const runBlocked = await syncUf('DF', { fetchFn: mockDrop40Pct, pageDelayMs: 0 });
        expect(runBlocked.status).toBe('partial');
        expect(runBlocked.deactivated).toBe(0);
        expect(runBlocked.error).toMatch(/Desativação em massa bloqueada: afetaria 4 de 10 postos ativos \(40\.0% > 20%\)/);

        const activeStill10 = await db.query(
          'SELECT COUNT(*)::int AS cnt FROM anp_stations WHERE uf = $1 AND is_active = true',
          ['DF']
        );
        expect(activeStill10.rows[0].cnt).toBe(10);

        // Com --allow-mass-deactivation => libera e desativa os 4 ausentes
        expect(parseCliArgs(['--uf', 'DF', '--allow-mass-deactivation'])).toEqual({
          uf: 'DF',
          allowMassDeactivation: true
        });

        const runAllowed = await syncUf('DF', {
          fetchFn: mockDrop40Pct,
          pageDelayMs: 0,
          allowMassDeactivation: true
        });
        expect(runAllowed.status).toBe('succeeded');
        expect(runAllowed.deactivated).toBe(4);
        expect(runAllowed.error).toBeNull();

        const activeNow6 = await db.query(
          'SELECT COUNT(*)::int AS cnt FROM anp_stations WHERE uf = $1 AND is_active = true',
          ['DF']
        );
        expect(activeNow6.rows[0].cnt).toBe(6);
      } finally {
        warnSpy.mockRestore();
      }
    });

    it('C1.5 syncAll continua nas demais UFs quando uma UF falha e a CLI sai com código diferente de zero', async () => {
      const dfStations = makeRawStations(2, 'DF');
      const mgStations = makeRawStations(3, 'MG');

      const mockFetchMultiUf = jest.fn(async (url) => {
        if (url.includes('uf=GO')) {
          return { ok: false, status: 503, json: async () => ({}) };
        }
        const isDf = url.includes('uf=DF');
        const list = isDf ? dfStations : mgStations;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            status: 200,
            succeeded: true,
            data: list,
            searchPageFilter: {
              numeroPagina: 1,
              tamanhoPagina: 5000,
              totalRegistro: list.length,
              totalPagina: 1
            }
          })
        };
      });

      const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      const prevExitCode = process.exitCode;

      try {
        await runAnpSyncCli([], {
          ufs: ['DF', 'GO', 'MG'],
          fetchFn: mockFetchMultiUf,
          pageDelayMs: 0,
          ufDelayMs: 0,
          retryBaseDelayMs: 5,
          rateLimitDelaysMs: [5, 10, 15],
          skipMigrations: true,
          closePool: false
        });

        expect(process.exitCode).toBe(1);

        const counts = await db.query(
          "SELECT uf, COUNT(*)::int AS cnt FROM anp_stations WHERE uf IN ('DF', 'GO', 'MG') GROUP BY uf ORDER BY uf ASC"
        );
        expect(counts.rows).toEqual([
          { uf: 'DF', cnt: 2 },
          { uf: 'MG', cnt: 3 }
        ]);

        const runs = await db.query(
          "SELECT scope, status FROM anp_sync_runs WHERE scope IN ('DF', 'GO', 'MG') ORDER BY id ASC"
        );
        expect(runs.rows).toEqual([
          { scope: 'DF', status: 'succeeded' },
          { scope: 'GO', status: 'failed' },
          { scope: 'MG', status: 'succeeded' }
        ]);
      } finally {
        process.exitCode = prevExitCode;
        errSpy.mockRestore();
        logSpy.mockRestore();
      }
    });

    it('F3(a) fetchAnpPageWithRetry: resposta 429 com Retry-After: 2 seguida de 200 tem sucesso e respeita a espera (e limita a 120s / aplica 5s,15s,45s sem header)', async () => {
      const sleeps = [];
      const sleepFn = jest.fn(async (ms) => {
        sleeps.push(ms);
      });

      let calls = 0;
      const mockFetchRetryAfter2 = jest.fn(async () => {
        calls++;
        if (calls === 1) {
          return {
            ok: false,
            status: 429,
            headers: {
              get: (name) => (String(name).toLowerCase() === 'retry-after' ? '2' : null)
            },
            json: async () => ({})
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => sampleComplete6
        };
      });

      const pageRes = await fetchAnpPageWithRetry('DF', 1, {
        fetchFn: mockFetchRetryAfter2,
        sleepFn
      });
      expect(calls).toBe(2);
      expect(pageRes.items.length).toBe(6);
      expect(sleeps).toEqual([2000]);

      // Verifica também que sem header Retry-After aplica 5000ms e 15000ms, e que Retry-After > 120 é limitado a 120000ms
      const sleepsBackoff = [];
      let backoffCalls = 0;
      const mockFetchNoHeaderThenCap = jest.fn(async () => {
        backoffCalls++;
        if (backoffCalls === 1) {
          return { ok: false, status: 429, headers: {}, json: async () => ({}) };
        }
        if (backoffCalls === 2) {
          return {
            ok: false,
            status: 503,
            headers: { 'Retry-After': '300' },
            json: async () => ({})
          };
        }
        return { ok: true, status: 200, json: async () => sampleComplete6 };
      });

      const res2 = await fetchAnpPageWithRetry('DF', 1, {
        fetchFn: mockFetchNoHeaderThenCap,
        sleepFn: async (ms) => sleepsBackoff.push(ms)
      });
      expect(res2.items.length).toBe(6);
      expect(sleepsBackoff).toEqual([5000, 120000]);
    });

    it('F3(b) syncAll reprocessa no final uma UF que falhou com 429 na primeira passada', async () => {
      const dfStations = makeRawStations(2, 'DF');
      const esStations = makeRawStations(3, 'ES');
      const mgStations = makeRawStations(2, 'MG');

      const ufCallOrder = [];
      let esAttempts = 0;
      const sleepsBetweenUfs = [];

      const mockFetch429ThenOk = jest.fn(async (url) => {
        const ufMatch = url.match(/uf=([A-Z]{2})/);
        const uf = ufMatch ? ufMatch[1] : '??';
        ufCallOrder.push(uf);

        if (uf === 'ES') {
          esAttempts++;
          if (esAttempts <= 2) {
            return {
              ok: false,
              status: 429,
              headers: { 'retry-after': '1' },
              json: async () => ({})
            };
          }
        }

        const list = uf === 'DF' ? dfStations : uf === 'ES' ? esStations : mgStations;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            status: 200,
            succeeded: true,
            data: list,
            searchPageFilter: {
              numeroPagina: 1,
              tamanhoPagina: 5000,
              totalRegistro: list.length,
              totalPagina: 1
            }
          })
        };
      });

      const results = await syncAll({
        ufs: ['DF', 'ES', 'MG'],
        maxRetries: 2,
        ufDelayMs: 3000,
        pageDelayMs: 0,
        fetchFn: mockFetch429ThenOk,
        sleepFn: async (ms) => sleepsBetweenUfs.push(ms)
      });

      // Ordem esperada de chamadas HTTP: DF (1x), ES (2x falha com 429 na 1ª passada), MG (1x), ES (1x sucesso no reprocessamento final)
      expect(ufCallOrder).toEqual(['DF', 'ES', 'ES', 'MG', 'ES']);
      expect(results.map(r => ({ scope: r.scope, status: r.status }))).toEqual([
        { scope: 'DF', status: 'succeeded' },
        { scope: 'ES', status: 'succeeded' },
        { scope: 'MG', status: 'succeeded' }
      ]);
      // Deve ter pausado 3000ms entre UFs (DF->ES, ES->MG, MG->ES retry) e 1000ms do Retry-After na tentativa interna de ES
      expect(sleepsBetweenUfs).toEqual([3000, 1000, 3000, 3000]);

      const counts = await db.query(
        "SELECT uf, COUNT(*)::int AS cnt FROM anp_stations WHERE uf IN ('DF', 'ES', 'MG') GROUP BY uf ORDER BY uf ASC"
      );
      expect(counts.rows).toEqual([
        { uf: 'DF', cnt: 2 },
        { uf: 'ES', cnt: 3 },
        { uf: 'MG', cnt: 2 }
      ]);
    });

    it('Falha no meio da paginação faz ROLLBACK completo da UF e NÃO desativa nenhum posto existente', async () => {
      const mockFetchAll6 = jest.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => sampleComplete6
      }));
      await syncUf('DF', { fetchFn: mockFetchAll6, pageDelayMs: 0 });

      const newStationRaw = {
        ...sampleFixture.data[0],
        cnpj: '99999999000199',
        razaoSocial: 'POSTO QUE NAO DEVE SER GRAVADO LTDA'
      };

      const mockFetchPartialFail = jest.fn(async (url) => {
        if (url.includes('numeropagina=1')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              status: 200,
              succeeded: true,
              data: [sampleFixture.data[0], newStationRaw],
              searchPageFilter: {
                numeroPagina: 1,
                tamanhoPagina: 2,
                totalRegistro: 4,
                totalPagina: 2
              }
            })
          };
        }
        return {
          ok: false,
          status: 502,
          json: async () => ({})
        };
      });

      await expect(
        syncUf('DF', { fetchFn: mockFetchPartialFail, pageDelayMs: 0, retryBaseDelayMs: 5 })
      ).rejects.toThrow(/HTTP 502/);

      const checkNew = await db.query('SELECT cnpj FROM anp_stations WHERE cnpj = $1', ['99999999000199']);
      expect(checkNew.rows.length).toBe(0);

      const checkActive = await db.query(
        'SELECT COUNT(*)::int AS active_count FROM anp_stations WHERE uf = $1 AND is_active = true',
        ['DF']
      );
      expect(checkActive.rows[0].active_count).toBe(6);

      const checkRun = await db.query(
        "SELECT status, inserted, updated, deactivated, error FROM anp_sync_runs WHERE status = 'failed' ORDER BY id DESC LIMIT 1"
      );
      expect(checkRun.rows.length).toBe(1);
      expect(checkRun.rows[0].status).toBe('failed');
      expect(checkRun.rows[0].inserted).toBe(0);
      expect(checkRun.rows[0].updated).toBe(0);
      expect(checkRun.rows[0].deactivated).toBe(0);
      expect(checkRun.rows[0].error).toContain('HTTP 502');
    });
  });

  describe('3. Endpoints /api/anp/stations (Filtros, Limites, Segurança, Interdicted, In-Bounds, Summary e :cnpj)', () => {
    beforeAll(async () => {
      await db.query('DELETE FROM anp_stations');
      await db.query('DELETE FROM anp_sync_runs');

      const mockFetch = jest.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => sampleComplete6
      }));
      await syncUf('DF', { fetchFn: mockFetch, pageDelayMs: 0 });
    });

    it('Rejeita requisição sem token (401), rejeita motorista (403) e permite auditor ler (200)', async () => {
      const rNoToken = await request(app).get('/api/anp/stations');
      expect(rNoToken.status).toBe(401);

      const rDriver = await request(app)
        .get('/api/anp/stations')
        .set('Authorization', 'Bearer ' + tokenDriver);
      expect(rDriver.status).toBe(403);

      const rAuditor = await request(app)
        .get('/api/anp/stations')
        .set('Authorization', 'Bearer ' + tokenAuditor);
      expect(rAuditor.status).toBe(200);
      expect(Array.isArray(rAuditor.body.items)).toBe(true);
      expect(rAuditor.body.total).toBe(6);
    });

    it('Aplica filtros uf, municipio, bandeira, q, is_active, has_geo e limita limit máximo a 100', async () => {
      const rLimit = await request(app)
        .get('/api/anp/stations?limit=500')
        .set('Authorization', 'Bearer ' + tokenManager);
      expect(rLimit.status).toBe(200);
      expect(rLimit.body.limit).toBe(100);
      expect(rLimit.body.page).toBe(1);

      const rBandeira = await request(app)
        .get('/api/anp/stations?bandeira=VIBRA')
        .set('Authorization', 'Bearer ' + tokenManager);
      expect(rBandeira.status).toBe(200);
      expect(rBandeira.body.total).toBe(2);
      expect(rBandeira.body.items.every(i => i.bandeira === 'VIBRA')).toBe(true);

      const rNoGeo = await request(app)
        .get('/api/anp/stations?has_geo=false')
        .set('Authorization', 'Bearer ' + tokenManager);
      expect(rNoGeo.status).toBe(200);
      expect(rNoGeo.body.total).toBe(1);
      expect(rNoGeo.body.items[0].cnpj).toBe('00001974000190');

      const rByName = await request(app)
        .get('/api/anp/stations?q=VICENTTE')
        .set('Authorization', 'Bearer ' + tokenManager);
      expect(rByName.status).toBe(200);
      expect(rByName.body.total).toBe(1);
      expect(rByName.body.items[0].cnpj).toBe('48386351000109');

      const rByCnpjMask = await request(app)
        .get('/api/anp/stations?q=48.386.351/0001-09')
        .set('Authorization', 'Bearer ' + tokenManager);
      expect(rByCnpjMask.status).toBe(200);
      expect(rByCnpjMask.body.total).toBe(1);
      expect(rByCnpjMask.body.items[0].cnpj).toBe('48386351000109');
    });

    it('Escapa % e _ no filtro q e bloqueia tentativa de SQL injection em q', async () => {
      const rPercent = await request(app)
        .get('/api/anp/stations')
        .query({ q: '%' })
        .set('Authorization', 'Bearer ' + tokenManager);
      expect(rPercent.status).toBe(200);
      expect(rPercent.body.total).toBe(0);

      const rUnderscore = await request(app)
        .get('/api/anp/stations')
        .query({ q: '______________' })
        .set('Authorization', 'Bearer ' + tokenManager);
      expect(rUnderscore.status).toBe(200);
      expect(rUnderscore.body.total).toBe(0);

      const rSqlInj = await request(app)
        .get('/api/anp/stations')
        .query({ q: "' OR 1=1; DROP TABLE anp_stations; --" })
        .set('Authorization', 'Bearer ' + tokenManager);
      expect(rSqlInj.status).toBe(200);
      expect(rSqlInj.body.total).toBe(0);

      const rAfter = await request(app)
        .get('/api/anp/stations')
        .set('Authorization', 'Bearer ' + tokenManager);
      expect(rAfter.body.total).toBe(6);
    });

    it('GET /api/anp/stations/summary retorna totais de ativos, por UF, sem coordenadas e data da última sincronização', async () => {
      const res = await request(app)
        .get('/api/anp/stations/summary')
        .set('Authorization', 'Bearer ' + tokenManager);
      expect(res.status).toBe(200);
      expect(res.body.total_active).toBe(6);
      expect(res.body.total_without_coordinates).toBe(1);
      expect(res.body.totals_by_uf.DF).toBe(6);
      expect(Array.isArray(res.body.by_uf)).toBe(true);
      expect(res.body.by_uf).toContainEqual({ uf: 'DF', total: 6 });
      expect(res.body.last_sync_at).toBeTruthy();
    });

    it('GET /api/anp/stations/:cnpj valida 14 dígitos (400), posto inexistente (404) e existente (200)', async () => {
      const rInvalid1 = await request(app)
        .get('/api/anp/stations/12345')
        .set('Authorization', 'Bearer ' + tokenManager);
      expect(rInvalid1.status).toBe(400);
      expect(rInvalid1.body).toEqual({ error: 'cnpj inválido' });

      const rInvalid2 = await request(app)
        .get('/api/anp/stations/4838635100010A')
        .set('Authorization', 'Bearer ' + tokenManager);
      expect(rInvalid2.status).toBe(400);
      expect(rInvalid2.body).toEqual({ error: 'cnpj inválido' });

      const rNotFound = await request(app)
        .get('/api/anp/stations/11111111111111')
        .set('Authorization', 'Bearer ' + tokenManager);
      expect(rNotFound.status).toBe(404);
      expect(rNotFound.body).toEqual({ error: 'Posto não encontrado' });

      const rOk = await request(app)
        .get('/api/anp/stations/48386351000109')
        .set('Authorization', 'Bearer ' + tokenManager);
      expect(rOk.status).toBe(200);
      expect(rOk.body.cnpj).toBe('48386351000109');
      expect(rOk.body.razao_social).toBe('AUTO POSTO VICENTTE PIRES LTDA');
      expect(rOk.body.interdicted).toBe(false);
    });

    it('Endpoints (/api/anp/stations, :cnpj, in-bounds) devolvem o booleano interdicted correto para Interdição, Desinterdição e vazio (C2)', async () => {
      const cnpjInterd = sampleFixture.data[0].cnpj;
      const cnpjDesinterd = sampleFixture.data[1].cnpj;
      const cnpjVazio = sampleFixture.data[2].cnpj;

      await db.query("UPDATE anp_stations SET situacao_sigaf = 'Interdição' WHERE cnpj = $1", [cnpjInterd]);
      await db.query("UPDATE anp_stations SET situacao_sigaf = 'Desinterdição' WHERE cnpj = $1", [cnpjDesinterd]);

      try {
        const rInterdicted = await request(app)
          .get(`/api/anp/stations/${cnpjInterd}`)
          .set('Authorization', 'Bearer ' + tokenManager);
        expect(rInterdicted.status).toBe(200);
        expect(rInterdicted.body.situacao_sigaf).toBe('Interdição');
        expect(rInterdicted.body.interdicted).toBe(true);

        const rDesinterdicted = await request(app)
          .get(`/api/anp/stations/${cnpjDesinterd}`)
          .set('Authorization', 'Bearer ' + tokenManager);
        expect(rDesinterdicted.status).toBe(200);
        expect(rDesinterdicted.body.situacao_sigaf).toBe('Desinterdição');
        expect(rDesinterdicted.body.interdicted).toBe(false);

        const rList = await request(app)
          .get('/api/anp/stations?uf=DF')
          .set('Authorization', 'Bearer ' + tokenManager);
        expect(rList.status).toBe(200);
        const byCnpj = Object.fromEntries(rList.body.items.map(i => [i.cnpj, i]));
        expect(byCnpj[cnpjInterd].interdicted).toBe(true);
        expect(byCnpj[cnpjDesinterd].interdicted).toBe(false);
        expect(byCnpj[cnpjVazio].interdicted).toBe(false);

        const rBounds = await request(app)
          .get('/api/anp/stations/in-bounds')
          .query({ minLat: -16.5, minLng: -48.5, maxLat: -15.0, maxLng: -47.0 })
          .set('Authorization', 'Bearer ' + tokenManager);
        expect(rBounds.status).toBe(200);
        const boundsByCnpj = Object.fromEntries(rBounds.body.items.map(i => [i.cnpj, i]));
        expect(boundsByCnpj[cnpjInterd].interdicted).toBe(true);
        expect(boundsByCnpj[cnpjDesinterd].interdicted).toBe(false);
      } finally {
        await db.query('UPDATE anp_stations SET situacao_sigaf = NULL WHERE cnpj = ANY($1::char(14)[])', [
          [cnpjInterd, cnpjDesinterd]
        ]);
      }
    });

    it('Respostas NÃO contêm nenhuma coluna interna fora da lista permitida (C5)', async () => {
      const rList = await request(app)
        .get('/api/anp/stations')
        .set('Authorization', 'Bearer ' + tokenManager);
      expect(rList.status).toBe(200);
      expect(rList.body.items.length).toBeGreaterThan(0);

      for (const item of rList.body.items) {
        const keys = Object.keys(item);
        for (const k of keys) {
          expect(ALLOWED_KEYS).toContain(k);
        }
        for (const forbidden of FORBIDDEN_INTERNAL_KEYS) {
          expect(item[forbidden]).toBeUndefined();
        }
      }

      const rDetail = await request(app)
        .get('/api/anp/stations/48386351000109')
        .set('Authorization', 'Bearer ' + tokenManager);
      expect(rDetail.status).toBe(200);
      for (const k of Object.keys(rDetail.body)) {
        expect(ALLOWED_KEYS).toContain(k);
      }
      for (const forbidden of FORBIDDEN_INTERNAL_KEYS) {
        expect(rDetail.body[forbidden]).toBeUndefined();
      }
    });

    it('GET /api/anp/stations/in-bounds respeita o teto de 500 postos e devolve truncated:true quando há mais de 500', async () => {
      const rSmall = await request(app)
        .get('/api/anp/stations/in-bounds')
        .query({ minLat: -16.5, minLng: -48.5, maxLat: -15.0, maxLng: -47.0 })
        .set('Authorization', 'Bearer ' + tokenManager);
      expect(rSmall.status).toBe(200);
      expect(rSmall.body.items.length).toBe(5);
      expect(rSmall.body.truncated).toBe(false);

      const values = [];
      const params = [];
      let pIdx = 1;
      for (let i = 1; i <= 505; i++) {
        const cnpj = String(80000000000000 + i).padStart(14, '0');
        values.push(`($${pIdx++}, $${pIdx++}, 'SP', 'SAO PAULO', 'VIBRA', -23.5500000, -46.6300000, true)`);
        params.push(cnpj, `POSTO BULK SP ${i}`);
      }
      await db.query(
        `INSERT INTO anp_stations (cnpj, razao_social, uf, municipio, bandeira, lat, lng, is_active)
         VALUES ${values.join(', ')}`,
        params
      );

      const rBulk = await request(app)
        .get('/api/anp/stations/in-bounds')
        .query({ minLat: -24.0, minLng: -47.0, maxLat: -23.0, maxLng: -46.0 })
        .set('Authorization', 'Bearer ' + tokenManager);
      expect(rBulk.status).toBe(200);
      expect(rBulk.body.items.length).toBe(500);
      expect(rBulk.body.truncated).toBe(true);

      for (const forbidden of FORBIDDEN_INTERNAL_KEYS) {
        expect(rBulk.body.items[0][forbidden]).toBeUndefined();
      }
    });
  });
});
