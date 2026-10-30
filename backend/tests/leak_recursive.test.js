const request = require('supertest');
const { app, io } = require('../src/index');
const db = require('../src/config/db');
const jwt = require('jsonwebtoken');

if (!process.env.DB_NAME || !process.env.DB_NAME.endsWith('_test')) {
  process.exit(1);
}

let tokenManager, driverId, truckId, stationId;

const crypto = require('crypto');
const clean = require('./clean');

const HW_SECRET_PLAIN = 'hw_secret_123';
const HW_SECRET_HASH = crypto.createHash('sha256').update(HW_SECRET_PLAIN, 'utf8').digest('hex');
const HW_SECRET_PREFIX = HW_SECRET_PLAIN.slice(0, 8); // 'hw_secre'

let driverPlainPassword = 'DriverPass@123';

beforeAll(async () => {
  await clean();
  await db.query('DELETE FROM driver_trucks');
  await db.query('DELETE FROM fueling_logs');
  await db.query('DELETE FROM fueling_sessions');
  await db.query('DELETE FROM facial_attempts');
  await db.query('DELETE FROM fleet_alerts');
  await db.query('DELETE FROM security_events');
  await db.query('DELETE FROM drivers');
  await db.query('DELETE FROM users');
  await db.query('DELETE FROM trucks');
  await db.query('DELETE FROM fuel_stations');

  const u = await db.query("INSERT INTO users (name, email, password_hash, role) VALUES ('Manager', 'leak@test.com', 'h', 'manager') RETURNING id");
  tokenManager = jwt.sign({ id: u.rows[0].id, email: 'leak@test.com', role: 'manager' }, process.env.JWT_SECRET);

  const bcrypt = require('bcrypt');
  const dHash = await bcrypt.hash(driverPlainPassword, 10);
  const d = await db.query("INSERT INTO drivers (name, email, phone, password_hash, face_enrolled, face_template_ref, is_active) VALUES ('Leaky Driver', 'leakd@test.com', '999', $1, true, 'secret_template_456', true) RETURNING id", [dHash]);
  driverId = d.rows[0].id;
  tokenDriver = jwt.sign({ id: driverId, role: 'driver' }, process.env.JWT_SECRET);
  
  const s = await db.query("INSERT INTO fuel_stations (name, lat, lng) VALUES ('S', -23, -46) RETURNING id");
  stationId = s.rows[0].id;
  
  const t = await db.query("INSERT INTO trucks (plate, model, capacity_liters, current_level_liters, api_key, fuel_station_id) VALUES ('ABC1', 'M', 100, 50, $1, $2) RETURNING id", [HW_SECRET_PLAIN, stationId]);
  truckId = t.rows[0].id;
  
  await db.query("INSERT INTO driver_trucks (driver_id, truck_id) VALUES ($1, $2)", [driverId, truckId]);
  
  await db.query("INSERT INTO fueling_sessions (driver_id, truck_id, station_id, status) VALUES ($1, $2, $3, 'active')", [driverId, truckId, stationId]);
});

let tokenDriver;

function checkRecursive(obj) {
  if (!obj) return;
  if (Array.isArray(obj)) {
    obj.forEach(checkRecursive);
    return;
  }
  if (typeof obj === 'object') {
    for (const key of Object.keys(obj)) {
      if (
        (key.includes('password') && key !== 'temporary_password') ||
        key.includes('face_template_ref') ||
        key.includes('api_key') ||
        key === 'prefix'
      ) {
        throw new Error('LEAK DETECTED (KEY): ' + key);
      }
      const val = obj[key];
      if (typeof val === 'string') {
        if (
          val.includes('secret_hash_123') ||
          val.includes('secret_template_456') ||
          val.includes(HW_SECRET_PLAIN) ||
          val.includes(HW_SECRET_HASH) ||
          val.includes(HW_SECRET_PREFIX)
        ) {
          throw new Error('LEAK DETECTED (VALUE): ' + val);
        }
      }
      checkRecursive(val);
    }
  }
}

function checkRecursiveSession(obj) {
  if (!obj) return;
  if (Array.isArray(obj)) {
    obj.forEach(checkRecursiveSession);
    return;
  }
  if (typeof obj === 'object') {
    for (const key of Object.keys(obj)) {
      if (
        key.includes('password') ||
        key.includes('face_template_ref') ||
        key.includes('api_key') ||
        key === 'prefix' ||
        key.includes('metadata') ||
        key.startsWith('facial_') ||
        key.startsWith('ble_') ||
        key === 'pump_liters' ||
        key === 'data_source' ||
        key === 'anp_station_id' ||
        key.startsWith('station_match') ||
        key === 'cnpj' ||
        key.startsWith('anp_')
      ) {
        throw new Error('SESSION LEAK DETECTED (KEY): ' + key);
      }
      const val = obj[key];
      if (typeof val === 'string') {
        if (
          val.includes('secret_hash_123') ||
          val.includes('secret_template_456') ||
          val.includes(HW_SECRET_PLAIN) ||
          val.includes(HW_SECRET_HASH) ||
          val.includes(HW_SECRET_PREFIX) ||
          val.includes('secret_meta_val') ||
          val.includes('secret_source')
        ) {
          throw new Error('SESSION LEAK DETECTED (VALUE): ' + val);
        }
      }
      checkRecursiveSession(val);
    }
  }
}

describe('Leak Checks', () => {
  it('GET /api/drivers no leak and has assigned_trucks', async () => {
    const r = await request(app).get('/api/drivers').set('Authorization', 'Bearer ' + tokenManager);
    expect(r.status).toBe(200);
    checkRecursive(r.body);
    expect(r.body[0].assigned_trucks[0]).toHaveProperty('plate', 'ABC1');
    expect(r.body[0].assigned_trucks[0]).toHaveProperty('id');
    expect(r.body[0].assigned_trucks[0]).toHaveProperty('model');
  });

  it('POST /api/drivers no leak', async () => {
    const r = await request(app).post('/api/drivers').set('Authorization', 'Bearer ' + tokenManager).send({ name: 'D2' });
    checkRecursive(r.body);
  });

  it('PUT /api/drivers/:id no leak', async () => {
    const r = await request(app).put(`/api/drivers/${driverId}`).set('Authorization', 'Bearer ' + tokenManager).send({ name: 'D2_Updated', email: 'leakd@test.com', phone: '999' });
    checkRecursive(r.body);
  });

  it('PATCH /api/drivers/:id/deactivate no leak', async () => {
    const r = await request(app).patch(`/api/drivers/${driverId}/deactivate`).set('Authorization', 'Bearer ' + tokenManager);
    checkRecursive(r.body);
  });

  it('PATCH /api/drivers/:id/activate no leak', async () => {
    const r = await request(app).patch(`/api/drivers/${driverId}/activate`).set('Authorization', 'Bearer ' + tokenManager);
    checkRecursive(r.body);
  });

  it('GET /api/fleet no leak', async () => {
    const r = await request(app).get('/api/fleet').set('Authorization', 'Bearer ' + tokenManager);
    expect(r.status).toBe(200);
    checkRecursive(r.body);
  });

  it('GET /api/fleet/:id no leak', async () => {
    const r = await request(app).get(`/api/fleet/${truckId}`).set('Authorization', 'Bearer ' + tokenManager);
    expect(r.status).toBe(200);
    checkRecursive(r.body);
  });

  it('GET /api/fleet/:id/telemetry e POST /api/fleet/:id/telemetry no leak', async () => {
    const rGet = await request(app).get(`/api/fleet/${truckId}/telemetry`).set('Authorization', 'Bearer ' + tokenManager);
    expect(rGet.status).toBe(200);
    checkRecursive(rGet.body);

    const rPost = await request(app)
      .post(`/api/fleet/${truckId}/telemetry`)
      .set('x-api-key', HW_SECRET_PLAIN)
      .send({ fuel_level_liters: 55, lat: -23.55, lng: -46.63, speed_kmh: 40 });
    expect(rPost.status).toBe(200);
    checkRecursive(rPost.body);
  });

  it('GET /api/fleet/:id/investigation no leak', async () => {
    const r = await request(app).get(`/api/fleet/${truckId}/investigation`).set('Authorization', 'Bearer ' + tokenManager);
    expect(r.status).toBe(200);
    checkRecursive(r.body);
  });

  it('GET /api/fleet/dashboard-stats e GET /api/fleet/live-events no leak', async () => {
    const rStats = await request(app).get('/api/fleet/dashboard-stats').set('Authorization', 'Bearer ' + tokenManager);
    expect(rStats.status).toBe(200);
    checkRecursive(rStats.body);

    const rLive = await request(app).get('/api/fleet/live-events').set('Authorization', 'Bearer ' + tokenManager);
    expect(rLive.status).toBe(200);
    checkRecursive(rLive.body);
  });

  it('POST /api/auth/driver/login no leak (nem api_key, hash ou prefixo no vehicle)', async () => {
    const rLogin = await request(app)
      .post('/api/auth/driver/login')
      .send({ email: 'leakd@test.com', password: driverPlainPassword });
    expect(rLogin.status).toBe(200);
    checkRecursive(rLogin.body);
  });

  it('fleetUpdate e liveEventsUpdate via Socket.IO no leak (nem campos ANP, nem api_key/hash/prefix)', async () => {
    const { getFleetSnapshot, getLiveEvents } = require('../src/services/fleetDataProvider');
    const snap = await getFleetSnapshot();
    checkRecursive(snap);
    checkRecursiveSession(snap);

    const live = await getLiveEvents();
    checkRecursive(live);
    checkRecursiveSession(live);
  });

  it('GET /api/fueling/sessions/:id e POST .../cancel sem leak de chaves ou valores secretos (nem anp_station_id / station_match*)', async () => {
    const s = await db.query(`
      INSERT INTO fueling_sessions
        (driver_id, truck_id, status, release_method, metadata, facial_consumed_at, ble_consumed_at, pump_liters, data_source, station_match_status, station_match_distance_m, station_match_source)
      VALUES
        ($1, $2, 'requested', 'facial', $3, NOW(), NOW(), 42.5, 'manager', 'matched', 18.2, 'truck_telemetry')
      RETURNING id
    `, [driverId, truckId, JSON.stringify({ secret_meta_val: 'secret_meta_val', facial_failures: 2 })]);
    const sessId = s.rows[0].id;

    const rGetDriver = await request(app).get(`/api/fueling/sessions/${sessId}`).set('Authorization', 'Bearer ' + tokenDriver);
    expect(rGetDriver.status).toBe(200);
    checkRecursiveSession(rGetDriver.body);

    const rGetMgr = await request(app).get(`/api/fueling/sessions/${sessId}`).set('Authorization', 'Bearer ' + tokenManager);
    expect(rGetMgr.status).toBe(200);
    checkRecursiveSession(rGetMgr.body);

    const rCancel = await request(app).post(`/api/fueling/sessions/${sessId}/cancel`).set('Authorization', 'Bearer ' + tokenDriver);
    expect(rCancel.status).toBe(200);
    checkRecursiveSession(rCancel.body);
  });

  it('GET /api/fueling/history sem leak recursivo de chaves e valores secretos', async () => {
    const anp = await db.query(`
      INSERT INTO anp_stations (cnpj, razao_social, uf, lat, lng)
      VALUES ('99887766000155', 'secret_razao', 'SP', -23, -46)
      ON CONFLICT (cnpj) DO UPDATE SET razao_social = 'secret_razao'
      RETURNING id
    `);
    const anpId = anp.rows[0].id;

    await db.query(`
      INSERT INTO fueling_logs
        (driver_id, truck_id, timestamp, lat, lng, level_before, level_after, release_method, station_id, station_name, duration_minutes, volume_liters, pump_liters, tank_liters_delta, data_source, anp_station_id, station_match_status, station_match_source)
      VALUES
        ($1, $2, NOW(), -23.55, -46.63, 10.0, 55.5, 'facial', $3, 'Posto Seguro', 15.0, 45.5, 99.0, 88.0, 'manager', $4, 'matched', 'truck_telemetry')
    `, [driverId, truckId, stationId, anpId]);

    const res = await request(app)
      .get('/api/fueling/history')
      .set('Authorization', 'Bearer ' + tokenDriver);

    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThan(0);

    function checkRecursiveHistory(obj) {
      if (!obj) return;
      if (Array.isArray(obj)) {
        obj.forEach(checkRecursiveHistory);
        return;
      }
      if (typeof obj === 'object') {
        for (const key of Object.keys(obj)) {
          if (
            key.includes('password') ||
            key.includes('face_template_ref') ||
            key.includes('api_key') ||
            key === 'prefix' ||
            key.includes('metadata') ||
            key.startsWith('facial_') ||
            key.startsWith('ble_') ||
            key === 'pump_liters' ||
            key === 'tank_liters_delta' ||
            key === 'data_source' ||
            key === 'level_before' ||
            key === 'level_after' ||
            key === 'lat' ||
            key === 'lng' ||
            key === 'session_id' ||
            key === 'station_id' ||
            key === 'anp_station_id' ||
            key.startsWith('station_match') ||
            key === 'cnpj' ||
            key.startsWith('anp_')
          ) {
            throw new Error('HISTORY LEAK DETECTED (KEY): ' + key);
          }
          const val = obj[key];
          if (
            typeof val === 'string' &&
            (val.includes('secret_') ||
              val.includes(HW_SECRET_PLAIN) ||
              val.includes(HW_SECRET_HASH) ||
              val.includes(HW_SECRET_PREFIX))
          ) {
            throw new Error('HISTORY LEAK DETECTED (VALUE): ' + val);
          }
          checkRecursiveHistory(val);
        }
      }
    }

    checkRecursiveHistory(res.body);

    for (const item of res.body.items) {
      expect(Object.keys(item).sort()).toEqual([
        "duration_minutes",
        "id",
        "kind",
        "release_method",
        "station_name",
        "status",
        "timestamp",
        "truck_plate",
        "volume_liters"
      ]);
    }

    const rFuelingList = await request(app)
      .get('/api/fueling')
      .set('Authorization', 'Bearer ' + tokenManager);
    expect(rFuelingList.status).toBe(200);
    checkRecursive(rFuelingList.body);
  });

  it('POST /api/fleet/:id/hardware-key retorna chave uma única vez e nem chave, hash ou prefixo vazam nas demais rotas e sockets', async () => {
    const rGen = await request(app)
      .post(`/api/fleet/${truckId}/hardware-key`)
      .set('Authorization', 'Bearer ' + tokenManager);
    expect(rGen.status).toBe(201);
    const genPlain = rGen.body.api_key;
    const genPrefix = rGen.body.prefix;
    const genHash = crypto.createHash('sha256').update(genPlain, 'utf8').digest('hex');
    expect(genPlain).toMatch(/^[0-9a-f]{64}$/);
    expect(genPrefix).toBe(genPlain.slice(0, 8));

    function assertNoGeneratedLeak(obj) {
      checkRecursive(obj);
      const raw = JSON.stringify(obj);
      expect(raw).not.toContain(genPlain);
      expect(raw).not.toContain(genHash);
      expect(raw).not.toContain(genPrefix);
    }

    const rStatus = await request(app)
      .get(`/api/fleet/${truckId}/hardware-key`)
      .set('Authorization', 'Bearer ' + tokenManager);
    expect(rStatus.status).toBe(200);
    expect(JSON.stringify(rStatus.body)).not.toContain(genPlain);
    expect(JSON.stringify(rStatus.body)).not.toContain(genHash);

    const rFleet = await request(app).get('/api/fleet').set('Authorization', 'Bearer ' + tokenManager);
    assertNoGeneratedLeak(rFleet.body);

    const rTruck = await request(app).get(`/api/fleet/${truckId}`).set('Authorization', 'Bearer ' + tokenManager);
    assertNoGeneratedLeak(rTruck.body);

    const rTel = await request(app).get(`/api/fleet/${truckId}/telemetry`).set('Authorization', 'Bearer ' + tokenManager);
    assertNoGeneratedLeak(rTel.body);

    const rInv = await request(app).get(`/api/fleet/${truckId}/investigation`).set('Authorization', 'Bearer ' + tokenManager);
    assertNoGeneratedLeak(rInv.body);

    const rStats = await request(app).get('/api/fleet/dashboard-stats').set('Authorization', 'Bearer ' + tokenManager);
    assertNoGeneratedLeak(rStats.body);

    const rLive = await request(app).get('/api/fleet/live-events').set('Authorization', 'Bearer ' + tokenManager);
    assertNoGeneratedLeak(rLive.body);

    const rHist = await request(app).get('/api/fueling/history').set('Authorization', 'Bearer ' + tokenDriver);
    assertNoGeneratedLeak(rHist.body);

    const rLogin = await request(app)
      .post('/api/auth/driver/login')
      .send({ email: 'leakd@test.com', password: driverPlainPassword });
    assertNoGeneratedLeak(rLogin.body);

    const { getFleetSnapshot, getLiveEvents } = require('../src/services/fleetDataProvider');
    assertNoGeneratedLeak(await getFleetSnapshot());
    assertNoGeneratedLeak(await getLiveEvents());
  });
});

