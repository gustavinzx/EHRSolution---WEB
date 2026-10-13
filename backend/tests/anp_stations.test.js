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
  syncUf
} = require('../src/services/anpSync');

const clean = require('./clean');

const sampleFixturePath = path.join(__dirname, 'fixtures', 'anp_combustivel_sample.json');
const sampleFixture = JSON.parse(fs.readFileSync(sampleFixturePath, 'utf8'));

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

describe('BLOCO E1 — Catálogo Nacional de Postos ANP (Parser, Sync, Transação e API)', () => {
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

  describe('1. Parser com fixture real e Normalização (CNPJ, CEP, coordenadas inválidas)', () => {
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
        cep: '1310100', // 7 dígitos -> deve preencher zero à esquerda: 01310100
        uf: 'sp',
        municipio: ' SAO PAULO ',
        distribuidora: ' IPIRANGA ',
        latitude: '0',
        longitude: '0',
        estimativaAcuracia: ' 5,5 ',
        statusSIGAF: '  INTERDITADO TOTALMENTE  ',
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
      expect(rec.situacao_sigaf).toBe('INTERDITADO TOTALMENTE');

      // Coordenadas fora do Brasil => null
      expect(parseBrazilCoords('40.7128', '-74.0060')).toEqual({ lat: null, lng: null });
      expect(parseBrazilCoords('-55.0', '-46.0')).toEqual({ lat: null, lng: null });
      expect(parseBrazilCoords('', '')).toEqual({ lat: null, lng: null });

      // CNPJ inválido => null
      expect(normalizeAnpRecord({ cnpj: '12345', razaoSocial: 'Posto', uf: 'DF' })).toBeNull();
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
          json: async () => sampleFixture
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

  describe('2. Sincronização Transacional, Idempotência, Desativação e Rollback em falha parcial', () => {
    beforeEach(async () => {
      await db.query('DELETE FROM anp_stations');
      await db.query('DELETE FROM anp_sync_runs');
    });

    it('Upsert idempotente: duas rodadas consecutivas mantêm exatamente a mesma contagem de postos ativos e sem duplicatas', async () => {
      const mockFetch = jest.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => sampleFixture
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

      // Terceira rodada produz contagens de run idênticas à segunda
      const run3 = await syncUf('DF', { fetchFn: mockFetch, pageDelayMs: 0 });
      expect(run3.fetched).toBe(run2.fetched);
      expect(run3.inserted).toBe(run2.inserted);
      expect(run3.updated).toBe(run2.updated);
      expect(run3.deactivated).toBe(run2.deactivated);
    });

    it('Desativa postos ausentes somente após percorrer TODAS as páginas da UF com sucesso', async () => {
      // Rodada inicial com os 6 postos de DF
      const mockFetchAll6 = jest.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => sampleFixture
      }));
      await syncUf('DF', { fetchFn: mockFetchAll6, pageDelayMs: 0 });

      // Rodada seguinte em 2 páginas contendo apenas 4 dos 6 postos (2 ausentes devem ser desativados)
      const mockFetchTwoPages = jest.fn(async (url) => {
        const isPage2 = url.includes('numeropagina=2');
        const slice = isPage2 ? sampleFixture.data.slice(2, 4) : sampleFixture.data.slice(0, 2);
        return {
          ok: true,
          status: 200,
          json: async () => ({
            status: 200,
            succeeded: true,
            data: slice,
            searchPageFilter: {
              numeroPagina: isPage2 ? 2 : 1,
              tamanhoPagina: 2,
              totalRegistro: 4,
              totalPagina: 2
            }
          })
        };
      });

      const runDeact = await syncUf('DF', { fetchFn: mockFetchTwoPages, pageDelayMs: 0 });
      expect(runDeact.status).toBe('succeeded');
      expect(runDeact.fetched).toBe(4);
      expect(runDeact.updated).toBe(4);
      expect(runDeact.deactivated).toBe(2);

      const { rows } = await db.query(
        'SELECT cnpj, is_active FROM anp_stations WHERE uf = $1 ORDER BY cnpj ASC',
        ['DF']
      );
      const activeCnpjs = rows.filter(r => r.is_active).map(r => r.cnpj.trim());
      const inactiveCnpjs = rows.filter(r => !r.is_active).map(r => r.cnpj.trim());
      expect(activeCnpjs.length).toBe(4);
      expect(inactiveCnpjs.length).toBe(2);
      expect(inactiveCnpjs).toContain('00001974000190');
      expect(inactiveCnpjs).toContain('07917405000138');
    });

    it('Falha no meio da paginação faz ROLLBACK completo da UF e NÃO desativa nenhum posto existente', async () => {
      // Semear 6 postos ativos em DF
      const mockFetchAll6 = jest.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => sampleFixture
      }));
      await syncUf('DF', { fetchFn: mockFetchAll6, pageDelayMs: 0 });

      // Agora simular sincronização de 2 páginas onde a página 1 traz apenas 1 posto existente + 1 posto novo,
      // e a página 2 falha todas as tentativas
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

      // 1) O posto novo da página 1 NÃO pode existir (ROLLBACK funcionou)
      const checkNew = await db.query('SELECT cnpj FROM anp_stations WHERE cnpj = $1', ['99999999000199']);
      expect(checkNew.rows.length).toBe(0);

      // 2) Todos os 6 postos anteriores continuam ativos (nenhum foi desativado na falha parcial)
      const checkActive = await db.query(
        'SELECT COUNT(*)::int AS active_count FROM anp_stations WHERE uf = $1 AND is_active = true',
        ['DF']
      );
      expect(checkActive.rows[0].active_count).toBe(6);

      // 3) anp_sync_runs registrou a execução falha com deactivated = 0
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

  describe('3. Endpoints /api/anp/stations (Filtros, Limites, Segurança, In-Bounds, Summary e :cnpj)', () => {
    beforeAll(async () => {
      await db.query('DELETE FROM anp_stations');
      await db.query('DELETE FROM anp_sync_runs');

      const mockFetch = jest.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => sampleFixture
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
      // limit > 100 vira 100
      const rLimit = await request(app)
        .get('/api/anp/stations?limit=500')
        .set('Authorization', 'Bearer ' + tokenManager);
      expect(rLimit.status).toBe(200);
      expect(rLimit.body.limit).toBe(100);
      expect(rLimit.body.page).toBe(1);

      // Filtro por bandeira
      const rBandeira = await request(app)
        .get('/api/anp/stations?bandeira=VIBRA')
        .set('Authorization', 'Bearer ' + tokenManager);
      expect(rBandeira.status).toBe(200);
      expect(rBandeira.body.total).toBe(2);
      expect(rBandeira.body.items.every(i => i.bandeira === 'VIBRA')).toBe(true);

      // Filtro por has_geo=false (apenas o posto sem coordenadas 00001974000190)
      const rNoGeo = await request(app)
        .get('/api/anp/stations?has_geo=false')
        .set('Authorization', 'Bearer ' + tokenManager);
      expect(rNoGeo.status).toBe(200);
      expect(rNoGeo.body.total).toBe(1);
      expect(rNoGeo.body.items[0].cnpj).toBe('00001974000190');

      // Filtro q por nome parcial e por CNPJ formatado
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
      // Passar literal "%" NÃO pode retornar todos os registros como wildcard
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

      // Confirma que a tabela segue intacta com os 6 registros
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
      // Com os 5 postos georreferenciados atuais em DF, truncated deve ser false
      const rSmall = await request(app)
        .get('/api/anp/stations/in-bounds')
        .query({ minLat: -16.5, minLng: -48.5, maxLat: -15.0, maxLng: -47.0 })
        .set('Authorization', 'Bearer ' + tokenManager);
      expect(rSmall.status).toBe(200);
      expect(rSmall.body.items.length).toBe(5);
      expect(rSmall.body.truncated).toBe(false);

      // Inserir 505 postos ativos com coordenadas em SP para testar o limite de 500 + truncated: true
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
