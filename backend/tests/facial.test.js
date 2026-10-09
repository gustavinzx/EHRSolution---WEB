const request = require('supertest');
const { app } = require('../src/index');
const db = require('../src/config/db');
const jwt = require('jsonwebtoken');

if (!process.env.DB_NAME || !process.env.DB_NAME.endsWith('_test')) {
  console.error('Testes devem rodar no banco de testes!');
  process.exit(1);
}

let tokenManager, tokenDriver, tokenHardware, driverId, truckId, stationId;

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

  const userRes = await db.query("INSERT INTO users (name, email, password_hash) VALUES ('Gestor', 'gestor@test.com', 'hash') RETURNING id");
  tokenManager = jwt.sign({ id: userRes.rows[0].id, role: 'manager', email: 'gestor@test.com' }, process.env.JWT_SECRET);

  const drvRes = await db.query("INSERT INTO drivers (name, is_active) VALUES ('Driver Face', true) RETURNING id");
  driverId = drvRes.rows[0].id;
  tokenDriver = jwt.sign({ id: driverId, role: 'driver' }, process.env.JWT_SECRET);

  const stRes = await db.query("INSERT INTO fuel_stations (name, lat, lng) VALUES ('Posto X', -23, -46) RETURNING id");
  stationId = stRes.rows[0].id;

  const trkRes = await db.query("INSERT INTO trucks (plate, model, capacity_liters, current_level_liters, api_key, fuel_station_id, lat, lng) VALUES ('FAC-0000', 'Test', 100, 50, 'key_fac', $1, -23, -46) RETURNING id", [stationId]);
  truckId = trkRes.rows[0].id;

  await db.query("INSERT INTO driver_trucks (driver_id, truck_id) VALUES ($1, $2)", [driverId, truckId]);
});

describe('Facial & Deactivation Tests', () => {
  let sessionId;

  it('enroll sem consentimento => 400', async () => {
    const res = await request(app).post('/api/drivers/' + driverId + '/face/enroll')
      .set('Authorization', 'Bearer ' + tokenManager)
      .send({ image_base64: 'abc' });
    expect(res.status).toBe(400);
  });

  it('enroll ok com mock', async () => {
    const res = await request(app).post('/api/drivers/' + driverId + '/face/enroll')
      .set('Authorization', 'Bearer ' + tokenManager)
      .send({ image_base64: 'base64_image_data', consent: true, consent_version: 'v1' });
    expect(res.status).toBe(200);
    expect(res.body.face_enrolled).toBe(true);
    expect(res.body.face_template_ref).toContain('mock_template_');
  });

  it('verify-face sem cadastro => 409', async () => {
    const d2 = await db.query("INSERT INTO drivers (name, is_active) VALUES ('D2', true) RETURNING id");
    const tok2 = jwt.sign({ id: d2.rows[0].id, role: 'driver' }, process.env.JWT_SECRET);
    
    const sess = await db.query(
      "INSERT INTO fueling_sessions (truck_id, driver_id, station_id, status, release_method) VALUES ($1, $2, $3, 'requested', 'facial') RETURNING id",
      [truckId, d2.rows[0].id, stationId]
    );

    const jpgMatch = Buffer.concat([Buffer.from([0xff, 0xd8]), Buffer.from('MATCH')]).toString('base64');
    const res = await request(app).post('/api/fueling/sessions/' + sess.rows[0].id + '/verify-face')
      .set('Authorization', 'Bearer ' + tok2)
      .send({ image_base64: jpgMatch });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('face_not_enrolled');
  });

  it('imagem invalida/grande => 400', async () => {
    const sess = await db.query(
      "INSERT INTO fueling_sessions (truck_id, driver_id, station_id, status, release_method) VALUES ($1, $2, $3, 'requested', 'facial') RETURNING id",
      [truckId, driverId, stationId]
    );
    const big = Buffer.alloc(2.1 * 1024 * 1024).toString('base64');
    const res = await request(app).post('/api/fueling/sessions/' + sess.rows[0].id + '/verify-face')
      .set('Authorization', 'Bearer ' + tokenDriver)
      .send({ image_base64: big });
    expect(res.status).toBe(400);

    const badSig = Buffer.from('12345678').toString('base64');
    const res2 = await request(app).post('/api/fueling/sessions/' + sess.rows[0].id + '/verify-face')
      .set('Authorization', 'Bearer ' + tokenDriver)
      .send({ image_base64: badSig });
    expect(res2.status).toBe(400);
  });

  it('verify MATCH => verified true e facial_attempts com success=true', async () => {
    const sess = await db.query(
      "INSERT INTO fueling_sessions (truck_id, driver_id, station_id, status, release_method) VALUES ($1, $2, $3, 'requested', 'facial') RETURNING id",
      [truckId, driverId, stationId]
    );
    sessionId = sess.rows[0].id;

    const imgMatch = Buffer.from('MATCH123').toString('base64');
    const jpgMatch = Buffer.concat([Buffer.from([0xff, 0xd8]), Buffer.from('MATCH')]).toString('base64');

    const res = await request(app).post('/api/fueling/sessions/' + sessionId + '/verify-face')
      .set('Authorization', 'Bearer ' + tokenDriver)
      .send({ image_base64: jpgMatch });
    expect(res.status).toBe(200);
    expect(res.body.verified).toBe(true);

    const atts = await db.query("SELECT * FROM facial_attempts WHERE session_id=$1", [sessionId]);
    expect(atts.rows.length).toBe(1);
    expect(atts.rows[0].success).toBe(true);
    expect(atts.rows[0].score).toBeDefined();
  });

  it('NOMATCH => false, tentativa gravada, NOLIVE => false mesmo match', async () => {
    const jpgNoMatch = Buffer.concat([Buffer.from([0xff, 0xd8]), Buffer.from('NOMATCH')]).toString('base64');
    const sess = await db.query(
      "INSERT INTO fueling_sessions (truck_id, driver_id, station_id, status, release_method) VALUES ($1, $2, $3, 'requested', 'facial') RETURNING id",
      [truckId, driverId, stationId]
    );

    const res = await request(app).post('/api/fueling/sessions/' + sess.rows[0].id + '/verify-face')
      .set('Authorization', 'Bearer ' + tokenDriver)
      .send({ image_base64: jpgNoMatch });
    expect(res.status).toBe(200);
    expect(res.body.verified).toBe(false);
    expect(res.body.attempts_left).toBe(2);

    const jpgNoLive = Buffer.concat([Buffer.from([0xff, 0xd8]), Buffer.from('NOLIVE')]).toString('base64');
    const res2 = await request(app).post('/api/fueling/sessions/' + sess.rows[0].id + '/verify-face')
      .set('Authorization', 'Bearer ' + tokenDriver)
      .send({ image_base64: jpgNoLive });
    expect(res2.status).toBe(200);
    expect(res2.body.verified).toBe(false);
    expect(res2.body.attempts_left).toBe(1);
  });

  it('4 tentativa => 429 e alerta', async () => {
    const jpgNoMatch = Buffer.concat([Buffer.from([0xff, 0xd8]), Buffer.from('NOMATCH')]).toString('base64');
    const sess = await db.query(
      "INSERT INTO fueling_sessions (truck_id, driver_id, station_id, status, release_method) VALUES ($1, $2, $3, 'requested', 'facial') RETURNING id",
      [truckId, driverId, stationId]
    );
    const sid = sess.rows[0].id;

    await request(app).post('/api/fueling/sessions/' + sid + '/verify-face').set('Authorization', 'Bearer ' + tokenDriver).send({ image_base64: jpgNoMatch });
    await request(app).post('/api/fueling/sessions/' + sid + '/verify-face').set('Authorization', 'Bearer ' + tokenDriver).send({ image_base64: jpgNoMatch });
    const r3 = await request(app).post('/api/fueling/sessions/' + sid + '/verify-face').set('Authorization', 'Bearer ' + tokenDriver).send({ image_base64: jpgNoMatch });
    expect(r3.body.verified).toBe(false);
    expect(r3.body.attempts_left).toBe(0);

    const r4 = await request(app).post('/api/fueling/sessions/' + sid + '/verify-face').set('Authorization', 'Bearer ' + tokenDriver).send({ image_base64: jpgNoMatch });
    expect(r4.status).toBe(429);

    const al = await db.query("SELECT * FROM fleet_alerts WHERE truck_id=$1", [truckId]);
    expect(al.rows.length).toBeGreaterThan(0);
    expect(al.rows.find(a => a.type.includes('facial_auth_locked'))).toBeDefined();
  });

  it('authorize facial SEM verify => 403, após verify => 200, reuso => 403', async () => {
    const sess = await db.query(
      "INSERT INTO fueling_sessions (truck_id, driver_id, station_id, status, release_method) VALUES ($1, $2, $3, 'requested', 'facial') RETURNING id",
      [truckId, driverId, stationId]
    );
    const sid = sess.rows[0].id;

    const r0 = await request(app).post('/api/fueling/sessions/' + sid + '/authorize').set('Authorization', 'Bearer ' + tokenDriver).send({});
    expect(r0.status).toBe(403);
    expect(r0.body.error).toBe('facial_verification_required');

    const jpgMatch = Buffer.concat([Buffer.from([0xff, 0xd8]), Buffer.from('MATCH')]).toString('base64');
    await request(app).post('/api/fueling/sessions/' + sid + '/verify-face').set('Authorization', 'Bearer ' + tokenDriver).send({ image_base64: jpgMatch });

    const r1 = await request(app).post('/api/fueling/sessions/' + sid + '/authorize').set('Authorization', 'Bearer ' + tokenDriver).send({});
    expect(r1.status).toBe(200);

    await db.query("UPDATE fueling_sessions SET status='requested' WHERE id=$1", [sid]);
    const r2 = await request(app).post('/api/fueling/sessions/' + sid + '/authorize').set('Authorization', 'Bearer ' + tokenDriver).send({});
    expect(r2.status).toBe(403);
  });

  it('ble_fallback sem confirmed => 403, com hardware confirmed => 200 e alerta', async () => {
    const sess = await db.query(
      "INSERT INTO fueling_sessions (truck_id, driver_id, station_id, status, release_method) VALUES ($1, $2, $3, 'requested', 'ble_fallback') RETURNING id",
      [truckId, driverId, stationId]
    );
    const sid = sess.rows[0].id;

    const r0 = await request(app).post('/api/fueling/sessions/' + sid + '/authorize').set('Authorization', 'Bearer ' + tokenDriver).send({});
    expect(r0.status).toBe(403);
    expect(r0.body.error).toBe('ble_confirmation_required');

    const r1 = await request(app).post('/api/fueling/sessions/' + sid + '/ble-confirmed').set('x-api-key', 'wrong_key');
    expect(r1.status).toBe(401);

    const rh = await request(app).post('/api/fueling/sessions/' + sid + '/ble-confirmed').set('x-api-key', 'key_fac');
    expect(rh.status).toBe(200);

    const r2 = await request(app).post('/api/fueling/sessions/' + sid + '/authorize').set('Authorization', 'Bearer ' + tokenDriver).send({});
    expect(r2.status).toBe(200);

    const al = await db.query("SELECT * FROM fleet_alerts WHERE type='ble_fallback_used' AND truck_id=$1", [truckId]);
    expect(al.rows.length).toBeGreaterThan(0);
  });

  it('GET /api/facial-attempts filtros e revogar rosto', async () => {
    const r0 = await request(app).get('/api/facial-attempts?start=abc').set('Authorization', 'Bearer ' + tokenManager);
    expect(r0.status).toBe(400);

    const r1 = await request(app).get('/api/facial-attempts?success=true').set('Authorization', 'Bearer ' + tokenManager);
    expect(r1.status).toBe(200);
    expect(r1.body.data.length).toBeGreaterThan(0);

    const r2 = await request(app).delete('/api/drivers/' + driverId + '/face').set('Authorization', 'Bearer ' + tokenManager);
    expect(r2.status).toBe(200);
    expect(r2.body.face_enrolled).toBe(false);
    expect(r2.body.face_template_ref).toBeNull();
  });

  it('FACE_PROVIDER validation', () => {
    process.env.NODE_ENV = 'production';
    process.env.FACE_PROVIDER = 'mock';
    expect(() => {
      require('child_process').execSync('node -e \"process.env.NODE_ENV=\'production\'; process.env.FACE_PROVIDER=\'mock\'; require(\'./src/services/faceProvider/index.js\')\"', { cwd: __dirname + '/../' })
    }).toThrow(/MOCK FACE PROVIDER IS FORBIDDEN IN PRODUCTION/);
    process.env.NODE_ENV = 'test';
    Object.keys(require.cache).forEach(k => { if (k.includes('faceProvider')) delete require.cache[k] });
  });

  it('Tarefa 7: deactivate cancela sessoes e corta acesso', async () => {
    await db.query("UPDATE drivers SET is_active=true WHERE id=$1", [driverId]);
    
    const sess = await db.query(
      "INSERT INTO fueling_sessions (truck_id, driver_id, station_id, status, release_method) VALUES ($1, $2, $3, 'requested', 'facial') RETURNING id",
      [truckId, driverId, stationId]
    );

    const rd = await request(app).patch('/api/drivers/' + driverId + '/deactivate').set('Authorization', 'Bearer ' + tokenManager);
    expect(rd.status).toBe(200);

    const ss = await db.query("SELECT status FROM fueling_sessions WHERE id=$1", [sess.rows[0].id]);
    expect(ss.rows[0].status).toBe('cancelled');

    const r4 = await request(app).post('/api/fueling/sessions/1/verify-face').set('Authorization', 'Bearer ' + tokenDriver).send({});
    expect(r4.status).toBe(403);
    expect(r4.body.error).toBe('driver_inactive');
  });

  it('Rotina de retencao apaga antigas', async () => {
    const ret = require('../src/services/retentionService');
    await db.query(
      "INSERT INTO facial_attempts (session_id, driver_id, truck_id, success, score, created_at) VALUES (NULL, $1, $2, false, 0, NOW() - INTERVAL '100 days')",
      [driverId, truckId]
    );
    process.env.NODE_ENV = 'development';
    ret.startRetentionRoutine();
    process.env.NODE_ENV = 'test';
    await new Promise(r => setTimeout(r, 200));
    
    const atts = await db.query("SELECT * FROM facial_attempts WHERE created_at < NOW() - INTERVAL '95 days'");
    expect(atts.rows.length).toBe(0);
  });
});



