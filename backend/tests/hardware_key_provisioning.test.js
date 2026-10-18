const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { app } = require('../src/index');
const db = require('../src/config/db');
const authHardware = require('../src/middleware/authHardware');
const clean = require('./clean');

if (!process.env.DB_NAME || !process.env.DB_NAME.endsWith('_test')) {
  process.exit(1);
}

describe('Hardware Key Provisioning, Trigger, Backfill & Auth (Bloco A-D, F1)', () => {
  let adminUserId;
  let managerUserId;
  let tokenAdmin;
  let tokenManager;
  let tokenAuditor;
  let tokenDriver;
  let truckId;

  beforeAll(async () => {
    await clean();

    const uAdmin = await db.query(
      "INSERT INTO users (name, email, password_hash, role) VALUES ('Admin HW', 'admin.hw@test.com', 'hash', 'admin') RETURNING id"
    );
    adminUserId = uAdmin.rows[0].id;
    tokenAdmin = jwt.sign({ id: adminUserId, email: 'admin.hw@test.com', role: 'admin' }, process.env.JWT_SECRET);

    const uMgr = await db.query(
      "INSERT INTO users (name, email, password_hash, role) VALUES ('Mgr HW', 'mgr.hw@test.com', 'hash', 'manager') RETURNING id"
    );
    managerUserId = uMgr.rows[0].id;
    tokenManager = jwt.sign({ id: managerUserId, email: 'mgr.hw@test.com', role: 'manager' }, process.env.JWT_SECRET);

    const uAud = await db.query(
      "INSERT INTO users (name, email, password_hash, role) VALUES ('Aud HW', 'aud.hw@test.com', 'hash', 'auditor') RETURNING id"
    );
    tokenAuditor = jwt.sign({ id: uAud.rows[0].id, email: 'aud.hw@test.com', role: 'auditor' }, process.env.JWT_SECRET);

    const dRes = await db.query(
      "INSERT INTO drivers (name, email, phone, is_active) VALUES ('Driver HW', 'drv.hw@test.com', '11999990000', true) RETURNING id"
    );
    tokenDriver = jwt.sign({ id: dRes.rows[0].id, role: 'driver' }, process.env.JWT_SECRET);

    const tRes = await db.query(
      "INSERT INTO trucks (plate, model, capacity_liters, current_level_liters) VALUES ('HWK-0001', 'Volvo FH', 500, 250) RETURNING id"
    );
    truckId = tRes.rows[0].id;
  });

  it('Trigger e vetor conhecido sha256("abc"): grava hash e prefixo idênticos ao Node e zera api_key', async () => {
    const expectedAbcHash = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
    expect(authHardware.hashApiKey('abc')).toBe(expectedAbcHash);

    const ins = await db.query(
      `INSERT INTO trucks (plate, model, capacity_liters, current_level_liters, api_key)
       VALUES ('VEC-0001', 'Scania R450', 400, 200, 'abc')
       RETURNING id, api_key, api_key_hash, api_key_prefix, api_key_created_at`
    );
    const row = ins.rows[0];
    expect(row.api_key).toBeNull();
    expect(row.api_key_hash).toBe(expectedAbcHash);
    expect(row.api_key_hash).toBe(authHardware.hashApiKey('abc'));
    expect(row.api_key_prefix).toBe('abc');
    expect(row.api_key_created_at).not.toBeNull();

    await db.query('DELETE FROM trucks WHERE id = $1', [row.id]);
  });

  it('Migration 016: backfill idempotente converte api_key legada em texto puro e pode rodar duas vezes seguidas sem alterar dados', async () => {
    const legacyKey = 'legacy_plain_key_for_backfill_test';
    const expectedHash = authHardware.hashApiKey(legacyKey);

    const ins = await db.query(
      `INSERT INTO trucks (plate, model, capacity_liters, current_level_liters)
       VALUES ('BKF-0016', 'Mercedes Actros', 450, 300)
       RETURNING id`
    );
    const bkfId = ins.rows[0].id;

    await db.query('ALTER TABLE trucks DISABLE TRIGGER trucks_hash_api_key_trg');
    await db.query(
      `UPDATE trucks
          SET api_key = $1,
              api_key_hash = NULL,
              api_key_prefix = NULL,
              api_key_created_at = NULL
        WHERE id = $2`,
      [legacyKey, bkfId]
    );
    await db.query('ALTER TABLE trucks ENABLE TRIGGER trucks_hash_api_key_trg');

    const beforeRow = await db.query(
      'SELECT api_key, api_key_hash, api_key_prefix FROM trucks WHERE id = $1',
      [bkfId]
    );
    expect(beforeRow.rows[0].api_key).toBe(legacyKey);
    expect(beforeRow.rows[0].api_key_hash).toBeNull();

    const migration016Sql = fs.readFileSync(
      path.join(__dirname, '../src/migrations/016_hardware_key_hash.sql'),
      'utf8'
    );

    await db.query(migration016Sql);

    const afterFirst = await db.query(
      'SELECT api_key, api_key_hash, api_key_prefix, api_key_created_at FROM trucks WHERE id = $1',
      [bkfId]
    );
    expect(afterFirst.rows[0].api_key).toBeNull();
    expect(afterFirst.rows[0].api_key_hash).toBe(expectedHash);
    expect(afterFirst.rows[0].api_key_prefix).toBe('legacy_p');
    expect(afterFirst.rows[0].api_key_created_at).not.toBeNull();

    const createdAtFirst = afterFirst.rows[0].api_key_created_at.toISOString();

    await db.query(migration016Sql);

    const afterSecond = await db.query(
      'SELECT api_key, api_key_hash, api_key_prefix, api_key_created_at FROM trucks WHERE id = $1',
      [bkfId]
    );
    expect(afterSecond.rows[0].api_key).toBeNull();
    expect(afterSecond.rows[0].api_key_hash).toBe(expectedHash);
    expect(afterSecond.rows[0].api_key_prefix).toBe('legacy_p');
    expect(afterSecond.rows[0].api_key_created_at.toISOString()).toBe(createdAtFirst);

    await db.query('DELETE FROM trucks WHERE id = $1', [bkfId]);
  });

  it('Bloco D1: caminhão criado com DEV_API_KEY_001 (como no seed.js) vira hash pelo trigger e autentica no hardware', async () => {
    const ins = await db.query(
      `INSERT INTO trucks (plate, model, capacity_liters, current_level_liters, api_key)
       VALUES ('EHR-SEED', 'Volvo FH 540', 600, 420, 'DEV_API_KEY_001')
       RETURNING id, api_key, api_key_hash, api_key_prefix`
    );
    const seedTruck = ins.rows[0];
    expect(seedTruck.api_key).toBeNull();
    expect(seedTruck.api_key_hash).toBe(authHardware.hashApiKey('DEV_API_KEY_001'));
    expect(seedTruck.api_key_prefix).toBe('DEV_API_');

    const rActive = await request(app)
      .get(`/api/fueling/sessions/${seedTruck.id}/active`)
      .set('x-api-key', 'DEV_API_KEY_001');
    expect(rActive.status).toBe(200);

    const rTel = await request(app)
      .post(`/api/fleet/${seedTruck.id}/telemetry`)
      .set('x-api-key', 'DEV_API_KEY_001')
      .send({ fuel_level_liters: 415, lat: -23.5505, lng: -46.6333, speed_kmh: 60 });
    expect(rTel.status).toBe(200);

    await db.query('DELETE FROM telemetry_logs WHERE truck_id = $1', [seedTruck.id]);
    await db.query('DELETE FROM trucks WHERE id = $1', [seedTruck.id]);
  });

  it('Ciclo completo: status inicial -> gerar -> autenticar -> verificar ausência no banco e no segundo GET -> trocar -> revogar', async () => {
    const rInitial = await request(app)
      .get(`/api/fleet/${truckId}/hardware-key`)
      .set('Authorization', 'Bearer ' + tokenManager);
    expect(rInitial.status).toBe(200);
    expect(rInitial.body).toEqual({
      configured: false,
      prefix: null,
      created_at: null,
      last_used_at: null,
    });

    const rGen1 = await request(app)
      .post(`/api/fleet/${truckId}/hardware-key`)
      .set('Authorization', 'Bearer ' + tokenManager);
    expect(rGen1.status).toBe(201);
    expect(Object.keys(rGen1.body).sort()).toEqual(['api_key', 'created_at', 'prefix']);
    const key1 = rGen1.body.api_key;
    expect(key1).toMatch(/^[0-9a-f]{64}$/);
    expect(rGen1.body.prefix).toBe(key1.slice(0, 8));
    expect(rGen1.body.created_at).toBeTruthy();

    // Busca da chave em texto nos valores de TODAS as colunas de texto do caminhão no banco => ausente
    const colsRes = await db.query(
      `SELECT column_name
         FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'trucks'
          AND data_type IN ('character varying', 'character', 'text')`
    );
    const colNames = colsRes.rows.map((r) => r.column_name);
    expect(colNames.length).toBeGreaterThan(0);
    const truckRowRes = await db.query(
      `SELECT ${colNames.join(', ')} FROM trucks WHERE id = $1`,
      [truckId]
    );
    const truckRow = truckRowRes.rows[0];
    for (const col of colNames) {
      if (truckRow[col] !== null) {
        expect(String(truckRow[col])).not.toContain(key1);
      }
    }
    expect(truckRow.api_key).toBeNull();
    expect(truckRow.api_key_hash).toBe(crypto.createHash('sha256').update(key1, 'utf8').digest('hex'));

    // Chave funciona em GET /api/fueling/sessions/:truckId/active e POST /api/fleet/:id/telemetry
    const rActive1 = await request(app)
      .get(`/api/fueling/sessions/${truckId}/active`)
      .set('x-api-key', key1);
    expect(rActive1.status).toBe(200);

    const rTel1 = await request(app)
      .post(`/api/fleet/${truckId}/telemetry`)
      .set('x-api-key', key1)
      .send({ fuel_level_liters: 245, lat: -23.5, lng: -46.6, speed_kmh: 50 });
    expect(rTel1.status).toBe(200);

    // Segundo GET de status NUNCA contém a chave nem o hash
    const rStatus1 = await request(app)
      .get(`/api/fleet/${truckId}/hardware-key`)
      .set('Authorization', 'Bearer ' + tokenManager);
    expect(rStatus1.status).toBe(200);
    expect(Object.keys(rStatus1.body).sort()).toEqual(['configured', 'created_at', 'last_used_at', 'prefix']);
    expect(rStatus1.body.configured).toBe(true);
    expect(rStatus1.body.prefix).toBe(key1.slice(0, 8));
    expect(rStatus1.body.created_at).toBeTruthy();
    expect(rStatus1.body.last_used_at).toBeTruthy();
    expect(rStatus1.body).not.toHaveProperty('api_key');
    expect(rStatus1.body).not.toHaveProperty('api_key_hash');
    expect(JSON.stringify(rStatus1.body)).not.toContain(key1);

    // Trocar chave => antiga dá 401 na hora e nova dá 200
    const rGen2 = await request(app)
      .post(`/api/fleet/${truckId}/hardware-key`)
      .set('Authorization', 'Bearer ' + tokenAdmin);
    expect(rGen2.status).toBe(201);
    const key2 = rGen2.body.api_key;
    expect(key2).toMatch(/^[0-9a-f]{64}$/);
    expect(key2).not.toBe(key1);

    const rOldActive = await request(app)
      .get(`/api/fueling/sessions/${truckId}/active`)
      .set('x-api-key', key1);
    expect(rOldActive.status).toBe(401);
    expect(rOldActive.body).toEqual({ error: 'Invalid Hardware API Key' });

    const rOldTel = await request(app)
      .post(`/api/fleet/${truckId}/telemetry`)
      .set('x-api-key', key1)
      .send({ fuel_level_liters: 240, lat: -23.5, lng: -46.6, speed_kmh: 40 });
    expect(rOldTel.status).toBe(401);
    expect(rOldTel.body).toEqual({ error: 'Invalid Hardware API Key' });

    const rNewActive = await request(app)
      .get(`/api/fueling/sessions/${truckId}/active`)
      .set('x-api-key', key2);
    expect(rNewActive.status).toBe(200);

    const rNewTel = await request(app)
      .post(`/api/fleet/${truckId}/telemetry`)
      .set('x-api-key', key2)
      .send({ fuel_level_liters: 240, lat: -23.5, lng: -46.6, speed_kmh: 40 });
    expect(rNewTel.status).toBe(200);

    // Revogar => 200 { success: true }, chave antiga dá 401 e status fica desconfigurado
    const rRevoke = await request(app)
      .delete(`/api/fleet/${truckId}/hardware-key`)
      .set('Authorization', 'Bearer ' + tokenManager);
    expect(rRevoke.status).toBe(200);
    expect(rRevoke.body).toEqual({ success: true });

    const rAfterRevokeActive = await request(app)
      .get(`/api/fueling/sessions/${truckId}/active`)
      .set('x-api-key', key2);
    expect(rAfterRevokeActive.status).toBe(401);
    expect(rAfterRevokeActive.body).toEqual({ error: 'Invalid Hardware API Key' });

    const rStatusAfterRevoke = await request(app)
      .get(`/api/fleet/${truckId}/hardware-key`)
      .set('Authorization', 'Bearer ' + tokenManager);
    expect(rStatusAfterRevoke.status).toBe(200);
    expect(rStatusAfterRevoke.body).toEqual({
      configured: false,
      prefix: null,
      created_at: null,
      last_used_at: null,
    });

    // Eventos 'hardware_key_generated' e 'hardware_key_revoked' gravados com severity low, sem alerta e sem a chave
    const secEvents = await db.query(
      `SELECT type, severity, truck_id, payload
         FROM security_events
        WHERE truck_id = $1
          AND type IN ('hardware_key_generated', 'hardware_key_revoked')
        ORDER BY id ASC`,
      [truckId]
    );
    expect(secEvents.rows.length).toBe(3); // 2 generated + 1 revoked
    for (const ev of secEvents.rows) {
      expect(ev.severity).toBe('low');
      expect(ev.truck_id).toBe(truckId);
      expect(ev.payload).toHaveProperty('user_id');
      expect(ev.payload).toHaveProperty('truck_id', truckId);
      const rawPayload = JSON.stringify(ev.payload);
      expect(rawPayload).not.toContain(key1);
      expect(rawPayload).not.toContain(key2);
      expect(rawPayload).not.toContain('api_key');
    }

    const alertsRes = await db.query(
      `SELECT id FROM fleet_alerts
        WHERE truck_id = $1
          AND type IN ('hardware_key_generated', 'hardware_key_revoked')`,
      [truckId]
    );
    expect(alertsRes.rows.length).toBe(0);
  });

  it('api_key_last_used_at atualiza no máximo 1 vez por minuto e falha na atualização nunca derruba a autenticação', async () => {
    const rGen = await request(app)
      .post(`/api/fleet/${truckId}/hardware-key`)
      .set('Authorization', 'Bearer ' + tokenManager);
    expect(rGen.status).toBe(201);
    const key = rGen.body.api_key;

    // 1o uso preenche api_key_last_used_at
    const rUse1 = await request(app)
      .get(`/api/fueling/sessions/${truckId}/active`)
      .set('x-api-key', key);
    expect(rUse1.status).toBe(200);

    const db1 = await db.query('SELECT api_key_last_used_at FROM trucks WHERE id = $1', [truckId]);
    const firstUsedAt = db1.rows[0].api_key_last_used_at;
    expect(firstUsedAt).not.toBeNull();

    // 2o uso imediato (< 1 min) não altera api_key_last_used_at
    const rUse2 = await request(app)
      .get(`/api/fueling/sessions/${truckId}/active`)
      .set('x-api-key', key);
    expect(rUse2.status).toBe(200);

    const db2 = await db.query('SELECT api_key_last_used_at FROM trucks WHERE id = $1', [truckId]);
    expect(db2.rows[0].api_key_last_used_at.toISOString()).toBe(firstUsedAt.toISOString());

    // Recuando para 2 minutos atrás, o próximo uso atualiza api_key_last_used_at
    await db.query(
      "UPDATE trucks SET api_key_last_used_at = NOW() - INTERVAL '2 minutes' WHERE id = $1",
      [truckId]
    );
    const dbOld = await db.query('SELECT api_key_last_used_at FROM trucks WHERE id = $1', [truckId]);
    const oldUsedAt = dbOld.rows[0].api_key_last_used_at;

    const rUse3 = await request(app)
      .post(`/api/fleet/${truckId}/telemetry`)
      .set('x-api-key', key)
      .send({ fuel_level_liters: 230, lat: -23.5, lng: -46.6, speed_kmh: 35 });
    expect(rUse3.status).toBe(200);

    const db3 = await db.query('SELECT api_key_last_used_at FROM trucks WHERE id = $1', [truckId]);
    expect(db3.rows[0].api_key_last_used_at.getTime()).toBeGreaterThan(oldUsedAt.getTime());

    // Falha no UPDATE de api_key_last_used_at nunca derruba a autenticação
    const origQuery = db.query.bind(db);
    const spy = jest.spyOn(db, 'query').mockImplementation((sql, params) => {
      if (typeof sql === 'string' && sql.includes('SET api_key_last_used_at = NOW()')) {
        return Promise.reject(new Error('Simulated DB write failure on last_used_at'));
      }
      return origQuery(sql, params);
    });

    try {
      const rFault = await request(app)
        .get(`/api/fueling/sessions/${truckId}/active`)
        .set('x-api-key', key);
      expect(rFault.status).toBe(200);
    } finally {
      spy.mockRestore();
    }
  });

  it('Rejeita cabeçalho x-api-key com mais de 200 caracteres com 401 Invalid Hardware API Key', async () => {
    const longHeader = 'a'.repeat(201);

    const rActive = await request(app)
      .get(`/api/fueling/sessions/${truckId}/active`)
      .set('x-api-key', longHeader);
    expect(rActive.status).toBe(401);
    expect(rActive.body).toEqual({ error: 'Invalid Hardware API Key' });

    const rTel = await request(app)
      .post(`/api/fleet/${truckId}/telemetry`)
      .set('x-api-key', longHeader)
      .send({ fuel_level_liters: 200, lat: -23.5, lng: -46.6, speed_kmh: 0 });
    expect(rTel.status).toBe(401);
    expect(rTel.body).toEqual({ error: 'Invalid Hardware API Key' });
  });

  it('Controle de acesso (auditor, motorista e hardware) nas três rotas de hardware-key', async () => {
    for (const method of ['get', 'post', 'delete']) {
      const rAud = await request(app)[method](`/api/fleet/${truckId}/hardware-key`)
        .set('Authorization', 'Bearer ' + tokenAuditor);
      expect(rAud.status).toBe(403);
      expect(rAud.body).toEqual({ error: 'forbidden_role' });

      const rDrv = await request(app)[method](`/api/fleet/${truckId}/hardware-key`)
        .set('Authorization', 'Bearer ' + tokenDriver);
      expect(rDrv.status).toBe(403);
      expect(rDrv.body).toEqual({ error: 'Acesso restrito ao gestor' });

      const rHw = await request(app)[method](`/api/fleet/${truckId}/hardware-key`)
        .set('x-api-key', 'DEV_API_KEY_001');
      expect(rHw.status).toBe(401);
      expect(rHw.body).toEqual({ error: 'Authorization token missing or invalid' });
    }
  });

  it('Validação de :id inválido (400) e caminhão inexistente (404) nas três rotas', async () => {
    for (const invalidId of ['abc', '0', '-5', '1.5']) {
      for (const method of ['get', 'post', 'delete']) {
        const res = await request(app)[method](`/api/fleet/${invalidId}/hardware-key`)
          .set('Authorization', 'Bearer ' + tokenManager);
        expect(res.status).toBe(400);
        expect(res.body).toEqual({ error: 'id inválido' });
      }
    }

    for (const method of ['get', 'post', 'delete']) {
      const res = await request(app)[method]('/api/fleet/999999/hardware-key')
        .set('Authorization', 'Bearer ' + tokenManager);
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Caminhão não encontrado' });
    }
  });
});
