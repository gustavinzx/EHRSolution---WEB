const fs = require('fs');
const path = require('path');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { app } = require('../src/index');
const db = require('../src/config/db');
const { runMigrations } = require('../src/migrations/runner');
const { recordSecurityEvent } = require('../src/services/securityService');

if (!process.env.DB_NAME?.endsWith('_test')) {
  throw new Error("DB_NAME must end with '_test' to run tests safely.");
}

describe('Sincronia entre alertas críticos de segurança e trucks.status', () => {
  let managerToken, auditorToken, driverToken, truckId, driverId;
  const clean = require('./clean');

  const statusOf = async (id = truckId) => {
    const { rows } = await db.query('SELECT status FROM trucks WHERE id = $1', [id]);
    return rows[0].status;
  };
  const resolve = (alertId, token = managerToken) =>
    request(app)
      .patch(`/api/alerts/${alertId}/resolve`)
      .set('Authorization', `Bearer ${token}`)
      .send({ resolution_note: 'Verificado pelo gestor' });
  const newSession = async () => {
    const { rows } = await db.query(
      `INSERT INTO fueling_sessions (truck_id, driver_id, status) VALUES ($1, $2, 'active') RETURNING id`,
      [truckId, driverId]
    );
    return rows[0].id;
  };
  const finish = (sid) =>
    request(app).post(`/api/fueling/sessions/${sid}/finish`).set('Authorization', `Bearer ${driverToken}`).send({});

  beforeAll(async () => {
    await clean();
    process.env.JWT_SECRET = 'test_secret';
    await runMigrations();

    const { rows: d } = await db.query(
      `INSERT INTO drivers (name, email, password_hash, is_active) VALUES ('Motorista Sync', 'sync_driver@test.com', 'hash', true) RETURNING id`
    );
    driverId = d[0].id;
    const { rows: u } = await db.query(
      `INSERT INTO users (name, email, password_hash, role, is_active) VALUES ('Gestor Sync', 'sync_mgr@test.com', 'hash', 'manager', true) RETURNING id`
    );
    const { rows: a } = await db.query(
      `INSERT INTO users (name, email, password_hash, role, is_active) VALUES ('Auditor Sync', 'sync_aud@test.com', 'hash', 'auditor', true) RETURNING id`
    );
    managerToken = jwt.sign({ id: u[0].id, name: 'Gestor Sync', role: 'manager' }, 'test_secret');
    auditorToken = jwt.sign({ id: a[0].id, name: 'Auditor Sync', role: 'auditor' }, 'test_secret');
    driverToken = jwt.sign({ id: driverId, role: 'driver' }, 'test_secret');
  });

  beforeEach(async () => {
    await db.query('DELETE FROM driver_trucks');
    await db.query('DELETE FROM fueling_logs');
    await db.query('DELETE FROM security_events');
    await db.query('DELETE FROM fueling_sessions');
    await db.query('DELETE FROM fleet_alerts');
    await db.query('DELETE FROM trucks');
    const { rows } = await db.query(
      `INSERT INTO trucks (plate, model, capacity_liters, current_level_liters, api_key)
       VALUES ('SYN-0001', 'Volvo', 500, 100, 'sync_hw_key') RETURNING id`
    );
    truckId = rows[0].id;
    await db.query('INSERT INTO driver_trucks (driver_id, truck_id) VALUES ($1, $2)', [driverId, truckId]);
  });

  afterAll(async () => {
    await db.pool.end();
  });

  it('a) evento tamper => security_alert; resolver o único alerta => ok', async () => {
    const { alert } = await recordSecurityEvent({ truckId, type: 'tamper' });
    expect(await statusOf()).toBe('security_alert');

    const res = await resolve(alert.id);
    expect(res.status).toBe(200);
    expect(await statusOf()).toBe('ok');
  });

  it('b) dois alertas críticos abertos: resolver um mantém security_alert; resolver o segundo => ok', async () => {
    const { alert: a1 } = await recordSecurityEvent({ truckId, type: 'tamper' });
    const { alert: a2 } = await recordSecurityEvent({ truckId, type: 'emergency_button' });
    expect(await statusOf()).toBe('security_alert');

    expect((await resolve(a1.id)).status).toBe(200);
    expect(await statusOf()).toBe('security_alert');

    expect((await resolve(a2.id)).status).toBe(200);
    expect(await statusOf()).toBe('ok');
  });

  it('c) finishSession com alerta crítico ABERTO mantém security_alert; depois de resolver e finalizar outro abastecimento => ok', async () => {
    const { alert } = await recordSecurityEvent({ truckId, type: 'theft_signal' });
    expect(await statusOf()).toBe('security_alert');

    const r1 = await finish(await newSession());
    expect(r1.status).toBe(200);
    expect(await statusOf()).toBe('security_alert');

    expect((await resolve(alert.id)).status).toBe(200);
    expect(await statusOf()).toBe('ok');

    const r2 = await finish(await newSession());
    expect(r2.status).toBe(200);
    expect(await statusOf()).toBe('ok');
  });

  it('d) resolver alerta de tipo "aviso" (manager_override) NÃO altera o status', async () => {
    const { alert: critical } = await recordSecurityEvent({ truckId, type: 'tamper' });
    const { alert: notice } = await recordSecurityEvent({ truckId, type: 'manager_override', payload: { reason: 'teste' } });
    expect(await statusOf()).toBe('security_alert');

    expect((await resolve(notice.id)).status).toBe(200);
    expect(await statusOf()).toBe('security_alert');

    // E um aviso sozinho, com o caminhão em ok, também não muda nada
    await db.query(`UPDATE fleet_alerts SET resolved_at = NOW() WHERE id = $1`, [critical.id]);
    await db.query(`UPDATE trucks SET status = 'low_fuel' WHERE id = $1`, [truckId]);
    const { alert: notice2 } = await recordSecurityEvent({ truckId, type: 'facial_auth_locked' });
    expect((await resolve(notice2.id)).status).toBe(200);
    expect(await statusOf()).toBe('low_fuel');
  });

  it('e) migration 020: sem alerta crítico aberto vira ok; com alerta aberto continua security_alert; idempotente', async () => {
    const sql = fs.readFileSync(
      path.join(__dirname, '../src/migrations/020_reconcile_security_alert_status.sql'),
      'utf8'
    );
    const { rows: other } = await db.query(
      `INSERT INTO trucks (plate, model, capacity_liters, current_level_liters, api_key)
       VALUES ('SYN-0002', 'Scania', 500, 100, 'sync_hw_key_2') RETURNING id`
    );
    const stuckId = truckId;
    const guardedId = other[0].id;

    // preso: security_alert com alerta crítico já resolvido e um aviso aberto
    await db.query(`UPDATE trucks SET status = 'security_alert' WHERE id = ANY($1)`, [[stuckId, guardedId]]);
    await db.query(
      `INSERT INTO fleet_alerts (truck_id, type, severity, message, resolved_at) VALUES ($1, 'security_tamper', 'critical', 'x', NOW())`,
      [stuckId]
    );
    await db.query(
      `INSERT INTO fleet_alerts (truck_id, type, severity, message) VALUES ($1, 'security_manager_override', 'high', 'aviso')`,
      [stuckId]
    );
    // legítimo: alerta crítico aberto
    await db.query(
      `INSERT INTO fleet_alerts (truck_id, type, severity, message) VALUES ($1, 'security_theft_signal', 'critical', 'aberto')`,
      [guardedId]
    );

    await db.query(sql);
    expect(await statusOf(stuckId)).toBe('ok');
    expect(await statusOf(guardedId)).toBe('security_alert');

    await db.query(sql); // idempotente
    expect(await statusOf(stuckId)).toBe('ok');
    expect(await statusOf(guardedId)).toBe('security_alert');
  });

  it('f) auditor continua sem poder resolver (403) e o status não muda', async () => {
    const { alert } = await recordSecurityEvent({ truckId, type: 'tamper' });
    const res = await resolve(alert.id, auditorToken);
    expect(res.status).toBe(403);
    expect(await statusOf()).toBe('security_alert');
    const { rows } = await db.query('SELECT resolved_at FROM fleet_alerts WHERE id = $1', [alert.id]);
    expect(rows[0].resolved_at).toBeNull();
  });

  it('g) alerta resolvido é imutável: resolver de novo retorna 404 e a nota exige 5+ caracteres', async () => {
    const { alert } = await recordSecurityEvent({ truckId, type: 'tamper' });
    const short = await request(app)
      .patch(`/api/alerts/${alert.id}/resolve`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ resolution_note: 'ok' });
    expect(short.status).toBe(400);

    expect((await resolve(alert.id)).status).toBe(200);
    expect((await resolve(alert.id)).status).toBe(404);
  });
});
