const request = require('supertest');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { app } = require('../src/index');
const db = require('../src/config/db');
const authHardware = require('../src/middleware/authHardware');
const { deriveState, isMismatch } = require('../src/services/lockStateService');
const clean = require('./clean');

if (!process.env.DB_NAME || !process.env.DB_NAME.endsWith('_test')) {
  process.exit(1);
}

describe('Lock state R4 (solenoides + fins de curso)', () => {
  let truckId;
  let otherTruckId;
  let mgrToken;
  const key = crypto.randomBytes(16).toString('hex');
  const otherKey = crypto.randomBytes(16).toString('hex');
  const LOCKED = { sol1: false, sol2: false, fc_locked: true, fc_unlocked: false };
  const UNLOCKED = { sol1: false, sol2: false, fc_locked: false, fc_unlocked: true };

  const post = (id, body, k = key) =>
    request(app).post(`/api/fleet/${id}/lock-state`).set('x-api-key', k).send(body);

  beforeAll(async () => {
    await clean();
    const u = await db.query(
      "INSERT INTO users (name, email, password_hash, role) VALUES ('Mgr', 'mgr.lck@test.com', 'h', 'manager') RETURNING id"
    );
    mgrToken = jwt.sign({ id: u.rows[0].id, email: 'mgr.lck@test.com', role: 'manager' }, process.env.JWT_SECRET);
    const a = await db.query(
      `INSERT INTO trucks (plate, model, capacity_liters, current_level_liters, api_key)
       VALUES ('LCK-0001','Volvo FH',500,250,$1) RETURNING id`, [key]);
    truckId = a.rows[0].id;
    const b = await db.query(
      `INSERT INTO trucks (plate, model, capacity_liters, current_level_liters, api_key)
       VALUES ('LCK-0002','Scania R450',500,250,$1) RETURNING id`, [otherKey]);
    otherTruckId = b.rows[0].id;
  });

  beforeEach(async () => {
    authHardware.resetRateLimits();
    await db.query('DELETE FROM lock_state_logs');
    await db.query('DELETE FROM fleet_alerts');
    await db.query('DELETE FROM security_events');
  });

  afterAll(async () => {
    await clean();
    await db.pool.end();
  });

  it('deriva estado a partir dos fins de curso', () => {
    expect(deriveState({ fc_locked: true, fc_unlocked: false })).toBe('locked');
    expect(deriveState({ fc_locked: false, fc_unlocked: true })).toBe('unlocked');
    expect(deriveState({ fc_locked: false, fc_unlocked: false })).toBe('moving');
    expect(deriveState({ fc_locked: true, fc_unlocked: true })).toBe('fault');
    expect(isMismatch('unlock', 'moving')).toBe(false);
  });

  it('comando e sensor coerentes: 201, sem alerta', async () => {
    const r = await post(truckId, { ...UNLOCKED, command: 'unlock' });
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ state: 'unlocked', mismatch: false, alert_id: null });
    const { rows } = await db.query('SELECT count(*)::int AS n FROM fleet_alerts');
    expect(rows[0].n).toBe(0);
  });

  it('em movimento (nenhum fim de curso) não é divergência', async () => {
    const r = await post(truckId, { sol1: true, sol2: false, fc_locked: false, fc_unlocked: false, command: 'unlock' });
    expect(r.status).toBe(201);
    expect(r.body.state).toBe('moving');
    expect(r.body.mismatch).toBe(false);
  });

  it('destravou mas sensor diz travado: alerta uma única vez, mesmo reenviando', async () => {
    const body = { ...LOCKED, command: 'unlock' };
    const r1 = await post(truckId, body);
    expect(r1.status).toBe(201);
    expect(r1.body.mismatch).toBe(true);
    expect(r1.body.alert_id).not.toBeNull();
    const r2 = await post(truckId, body);
    expect(r2.body.mismatch).toBe(true);
    expect(r2.body.alert_id).toBeNull();
    const { rows } = await db.query(
      "SELECT count(*)::int AS n FROM fleet_alerts WHERE type = 'security_lock_state_mismatch'");
    expect(rows[0].n).toBe(1);
  });

  it('ambos os fins de curso acionados: fault com alerta', async () => {
    const r = await post(truckId, { sol1: false, sol2: false, fc_locked: true, fc_unlocked: true });
    expect(r.status).toBe(201);
    expect(r.body.state).toBe('fault');
    expect(r.body.alert_id).not.toBeNull();
  });

  it('diverge de novo após voltar ao normal: novo alerta', async () => {
    await post(truckId, { ...LOCKED, command: 'unlock' });
    await post(truckId, { ...UNLOCKED, command: 'unlock' });
    const r = await post(truckId, { ...LOCKED, command: 'unlock' });
    expect(r.body.alert_id).not.toBeNull();
  });

  it('payload inválido: 400 e nada gravado', async () => {
    const bad = [
      { ...LOCKED, sol1: 'true' },
      { ...LOCKED, fc_locked: undefined },
      { ...LOCKED, command: 'open' },
      {},
    ];
    for (const b of bad) {
      const r = await post(truckId, b);
      expect(r.status).toBe(400);
    }
    const { rows } = await db.query('SELECT count(*)::int AS n FROM lock_state_logs');
    expect(rows[0].n).toBe(0);
  });

  it('chave ausente/inválida: 401; chave de outro caminhão: 403', async () => {
    const noKey = await request(app).post(`/api/fleet/${truckId}/lock-state`).send({ ...LOCKED });
    expect(noKey.status).toBe(401);
    const badKey = await post(truckId, { ...LOCKED }, 'chave-invalida');
    expect(badKey.status).toBe(401);
    const cross = await post(truckId, { ...LOCKED }, otherKey);
    expect(cross.status).toBe(403);
    const { rows } = await db.query('SELECT count(*)::int AS n FROM lock_state_logs WHERE truck_id = $1', [otherTruckId]);
    expect(rows[0].n).toBe(0);
  });

  it('GET /api/fleet/:id/lock-state: lista histórico com paginação por cursor e rejeita cursor inválido', async () => {
    await post(truckId, { ...LOCKED, command: 'lock' });
    await post(truckId, { ...UNLOCKED, command: 'unlock' });
    await post(truckId, { ...LOCKED, command: 'lock' });

    const page1 = await request(app)
      .get(`/api/fleet/${truckId}/lock-state?limit=2`)
      .set('Authorization', `Bearer ${mgrToken}`);
    expect(page1.status).toBe(200);
    expect(page1.body.items).toHaveLength(2);
    expect(page1.body.next_cursor).not.toBeNull();

    const page2 = await request(app)
      .get(`/api/fleet/${truckId}/lock-state?limit=2&cursor=${page1.body.next_cursor}`)
      .set('Authorization', `Bearer ${mgrToken}`);
    expect(page2.status).toBe(200);
    expect(page2.body.items).toHaveLength(1);
    expect(page2.body.next_cursor).toBeNull();

    const badCursor = await request(app)
      .get(`/api/fleet/${truckId}/lock-state?cursor=abc`)
      .set('Authorization', `Bearer ${mgrToken}`);
    expect(badCursor.status).toBe(400);
  });
});
