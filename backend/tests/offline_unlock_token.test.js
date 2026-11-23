const request = require('supertest');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { app } = require('../src/index');
const db = require('../src/config/db');
const { deriveTruckHmacKey, deriveTruckHmacKeyHex } = require('../src/services/offlineUnlockService');
const clean = require('./clean');

if (!process.env.DB_NAME || !process.env.DB_NAME.endsWith('_test')) {
  process.exit(1);
}

describe('POST /api/fueling/sessions/:id/offline-token (token HMAC para Trava R4)', () => {
  let driverId;
  let otherDriverId;
  let managerId;
  let truckId;
  let tokenDriver;
  let tokenOtherDriver;
  let tokenManager;

  beforeAll(async () => {
    await clean();
    const u = await db.query(
      "INSERT INTO users (name, email, password_hash, role) VALUES ('Mgr', 'mgr.off@test.com', 'h', 'manager') RETURNING id"
    );
    managerId = u.rows[0].id;
    tokenManager = jwt.sign({ id: managerId, email: 'mgr.off@test.com', role: 'manager' }, process.env.JWT_SECRET);

    const d1 = await db.query(
      "INSERT INTO drivers (name, email, phone, is_active) VALUES ('Drv1', 'd1.off@test.com', '11900001111', true) RETURNING id"
    );
    driverId = d1.rows[0].id;
    tokenDriver = jwt.sign({ id: driverId, role: 'driver' }, process.env.JWT_SECRET);

    const d2 = await db.query(
      "INSERT INTO drivers (name, email, phone, is_active) VALUES ('Drv2', 'd2.off@test.com', '11900002222', true) RETURNING id"
    );
    otherDriverId = d2.rows[0].id;
    tokenOtherDriver = jwt.sign({ id: otherDriverId, role: 'driver' }, process.env.JWT_SECRET);

    const t = await db.query(
      "INSERT INTO trucks (plate, model, capacity_liters, current_level_liters) VALUES ('OFF-0001', 'Volvo FH', 500, 250) RETURNING id"
    );
    truckId = t.rows[0].id;
  });

  beforeEach(async () => {
    await db.query('DELETE FROM fueling_sessions');
  });

  afterAll(async () => {
    await clean();
    await db.pool.end();
  });

  it('deriva chave HMAC determinística de 64 hex chars (32 bytes) por caminhão', () => {
    const hex1 = deriveTruckHmacKeyHex(truckId);
    const hex2 = deriveTruckHmacKeyHex(truckId);
    const hexOther = deriveTruckHmacKeyHex(truckId + 1);
    expect(hex1).toMatch(/^[0-9a-f]{64}$/);
    expect(hex1).toBe(hex2);
    expect(hex1).not.toBe(hexOther);
  });

  it('emite token compatível com o firmware TravaEHR_R4.ino para sessão authorized ou active', async () => {
    const ins = await db.query(
      `INSERT INTO fueling_sessions (truck_id, driver_id, status, expires_at)
       VALUES ($1, $2, 'authorized', NOW() + INTERVAL '10 minutes')
       RETURNING id`,
      [truckId, driverId]
    );
    const sessionId = ins.rows[0].id;

    const r = await request(app)
      .post(`/api/fueling/sessions/${sessionId}/offline-token`)
      .set('Authorization', `Bearer ${tokenDriver}`);

    expect(r.status).toBe(200);
    expect(r.body.truck_id).toBe(truckId);
    expect(r.body.session_id).toBe(sessionId);
    expect(typeof r.body.exp).toBe('number');

    const nowSec = Math.floor(Date.now() / 1000);
    expect(r.body.exp).toBeGreaterThan(nowSec);
    expect(r.body.exp - nowSec).toBeLessThanOrEqual(900);

    // Mesma verificação feita em verifyUnlockToken() no TravaEHR_R4.ino
    const key = deriveTruckHmacKey(truckId);
    const msg = `UNLOCK:${truckId}:${sessionId}:${r.body.exp}`;
    const expectedMac = crypto.createHmac('sha256', key).update(msg).digest('hex');
    expect(r.body.mac).toBe(expectedMac);
  });

  it('gestor também pode emitir token para qualquer sessão ativa', async () => {
    const ins = await db.query(
      `INSERT INTO fueling_sessions (truck_id, driver_id, status, expires_at)
       VALUES ($1, $2, 'active', NOW() + INTERVAL '15 minutes')
       RETURNING id`,
      [truckId, driverId]
    );
    const r = await request(app)
      .post(`/api/fueling/sessions/${ins.rows[0].id}/offline-token`)
      .set('Authorization', `Bearer ${tokenManager}`);
    expect(r.status).toBe(200);
    expect(r.body.mac).toMatch(/^[0-9a-f]{64}$/);
  });

  it('recusa sessão requested, completed, cancelled ou com expires_at vencido (409)', async () => {
    for (const st of ['requested', 'completed', 'cancelled']) {
      const ins = await db.query(
        `INSERT INTO fueling_sessions (truck_id, driver_id, status, expires_at)
         VALUES ($1, $2, $3, NOW() + INTERVAL '5 minutes') RETURNING id`,
        [truckId, driverId, st]
      );
      const r = await request(app)
        .post(`/api/fueling/sessions/${ins.rows[0].id}/offline-token`)
        .set('Authorization', `Bearer ${tokenDriver}`);
      expect(r.status).toBe(409);
    }

    const expIns = await db.query(
      `INSERT INTO fueling_sessions (truck_id, driver_id, status, expires_at)
       VALUES ($1, $2, 'authorized', NOW() - INTERVAL '1 minute') RETURNING id`,
      [truckId, driverId]
    );
    const rExp = await request(app)
      .post(`/api/fueling/sessions/${expIns.rows[0].id}/offline-token`)
      .set('Authorization', `Bearer ${tokenDriver}`);
    expect(rExp.status).toBe(409);
  });

  it('recusa motorista de outra sessão (403), sessão inexistente (404) e sem auth (401)', async () => {
    const ins = await db.query(
      `INSERT INTO fueling_sessions (truck_id, driver_id, status, expires_at)
       VALUES ($1, $2, 'authorized', NOW() + INTERVAL '5 minutes') RETURNING id`,
      [truckId, driverId]
    );
    const sessionId = ins.rows[0].id;

    const rNoAuth = await request(app).post(`/api/fueling/sessions/${sessionId}/offline-token`);
    expect(rNoAuth.status).toBe(401);

    const rOther = await request(app)
      .post(`/api/fueling/sessions/${sessionId}/offline-token`)
      .set('Authorization', `Bearer ${tokenOtherDriver}`);
    expect(rOther.status).toBe(403);

    const r404 = await request(app)
      .post('/api/fueling/sessions/999999/offline-token')
      .set('Authorization', `Bearer ${tokenDriver}`);
    expect(r404.status).toBe(404);
  });
});
