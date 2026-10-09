const request = require('supertest');
const { app } = require('../src/index');
const db = require('../src/config/db');
const jwt = require('jsonwebtoken');

if (!process.env.DB_NAME || !process.env.DB_NAME.endsWith('_test')) {
  process.exit(1);
}

let tokenManager, driverId, truckId, stationId;

beforeAll(async () => {
  await db.query("DELETE FROM fleet_alerts");
  await db.query("DELETE FROM security_events");
  await db.query("DELETE FROM facial_attempts");
  await db.query("DELETE FROM fueling_logs");
  await db.query("DELETE FROM fueling_sessions");
  await db.query("DELETE FROM driver_trucks");
  await db.query("DELETE FROM trucks");
  await db.query("DELETE FROM drivers");
  await db.query("DELETE FROM fuel_stations");
  await db.query("DELETE FROM users");

  const userRes = await db.query("INSERT INTO users (name, email, password_hash) VALUES ('Gestor3', 'gestor3@test.com', 'hash') RETURNING id");
  tokenManager = jwt.sign({ id: userRes.rows[0].id, role: 'manager', email: 'gestor3@test.com' }, process.env.JWT_SECRET);

  const stRes = await db.query("INSERT INTO fuel_stations (name, lat, lng) VALUES ('Posto 3', -23, -46) RETURNING id");
  stationId = stRes.rows[0].id;

  const trkRes = await db.query("INSERT INTO trucks (plate, model, capacity_liters, current_level_liters, api_key, fuel_station_id, lat, lng) VALUES ('DRV-0000', 'Test', 100, 50, 'key_drv', $1, -23, -46) RETURNING id", [stationId]);
  truckId = trkRes.rows[0].id;
});

describe('Drivers Controller Actions', () => {
  it('enrollFace imagem inválida => 400', async () => {
    const drvRes = await db.query("INSERT INTO drivers (name, is_active, face_enrolled) VALUES ('Driver Inv', true, false) RETURNING id");
    const dId = drvRes.rows[0].id;

    const res = await request(app).post(`/api/drivers/${dId}/face/enroll`)
      .set('Authorization', 'Bearer ' + tokenManager)
      .send({ image_base64: 'not-base64-image-that-starts-with-jpeg-or-png', consent: true });
    
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Formato de imagem inválido');
  });

  it('enrollFace provedor falha => 503 e mantém template', async () => {
    const drvRes = await db.query("INSERT INTO drivers (name, is_active, face_enrolled, face_template_ref) VALUES ('Driver Fail', true, true, 'old_ref') RETURNING id");
    const dId = drvRes.rows[0].id;

    // Simulate provider failure by not having FACE_PROVIDER=mock or by failing enroll
    // To cleanly fail without removing provider, we can spy on the provider if we want, but wait, mockProvider doesn't fail unless we throw.
    // Instead of messing with provider, let's just use jest.spyOn
    const faceProvider = require('../src/services/faceProvider');
    const spy = jest.spyOn(faceProvider, 'enroll').mockRejectedValue({ code: 'NOT_IMPLEMENTED', message: 'Not implemented' });

    // Valid header for JPEG: ffd8ffe0
    const validJPEGBase64 = Buffer.from('ffd8ffe000104a46494600010100000100010000', 'hex').toString('base64');
    const res = await request(app).post(`/api/drivers/${dId}/face/enroll`)
      .set('Authorization', 'Bearer ' + tokenManager)
      .send({ image_base64: validJPEGBase64, consent: true });
    
    expect(res.status).toBe(503);
    
    const drvCheck = await db.query("SELECT face_template_ref FROM drivers WHERE id=$1", [dId]);
    expect(drvCheck.rows[0].face_template_ref).toBe('old_ref');

    spy.mockRestore();
  });

  it('deactivate cancels session, resets truck, logs event', async () => {
    const drvRes = await db.query("INSERT INTO drivers (name, is_active) VALUES ('Driver Deact', true) RETURNING id");
    const dId = drvRes.rows[0].id;
    
    const s = await db.query("INSERT INTO fueling_sessions (truck_id, driver_id, station_id, status, release_method) VALUES ($1, $2, $3, 'active', 'facial') RETURNING id", [truckId, dId, stationId]);
    await db.query("UPDATE trucks SET sim_state='fueling', status='ok' WHERE id=$1", [truckId]);

    const res = await request(app).patch(`/api/drivers/${dId}/deactivate`)
      .set('Authorization', 'Bearer ' + tokenManager);
    
    expect(res.status).toBe(200);

    const sCheck = await db.query("SELECT status FROM fueling_sessions WHERE id=$1", [s.rows[0].id]);
    expect(sCheck.rows[0].status).toBe('cancelled');

    const tCheck = await db.query("SELECT sim_state FROM trucks WHERE id=$1", [truckId]);
    expect(tCheck.rows[0].sim_state).toBe('idle');

    const sec = await db.query("SELECT * FROM security_events WHERE type='driver_deactivated' AND payload->>'driver_id'=$1", [String(dId)]);
    expect(sec.rows.length).toBeGreaterThan(0);
  });
});
