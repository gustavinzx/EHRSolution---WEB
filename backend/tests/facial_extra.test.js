const request = require('supertest');
const { app } = require('../src/index');
const db = require('../src/config/db');
const jwt = require('jsonwebtoken');

if (!process.env.DB_NAME || !process.env.DB_NAME.endsWith('_test')) {
  process.exit(1);
}

let tokenManager, tokenDriver, tokenDriver2, driverId, driverId2, truckId, truckId2, stationId;

const clean = require('./clean');
beforeAll(async () => {
  await clean();
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

  const userRes = await db.query("INSERT INTO users (name, email, password_hash) VALUES ('Gestor 4', 'gestor4@test.com', 'hash') RETURNING id");
  tokenManager = jwt.sign({ id: userRes.rows[0].id, role: 'manager', email: 'gestor4@test.com' }, process.env.JWT_SECRET);

  const stRes = await db.query("INSERT INTO fuel_stations (name, lat, lng) VALUES ('Posto 4', -23, -46) RETURNING id");
  stationId = stRes.rows[0].id;

  const drvRes1 = await db.query("INSERT INTO drivers (name, is_active, face_enrolled, face_template_ref) VALUES ('Driver A', true, true, 'ref_a') RETURNING id");
  driverId = drvRes1.rows[0].id;
  tokenDriver = jwt.sign({ id: driverId, role: 'driver' }, process.env.JWT_SECRET);

  const drvRes2 = await db.query("INSERT INTO drivers (name, is_active, face_enrolled, face_template_ref) VALUES ('Driver B', true, true, 'ref_b') RETURNING id");
  driverId2 = drvRes2.rows[0].id;
  tokenDriver2 = jwt.sign({ id: driverId2, role: 'driver' }, process.env.JWT_SECRET);

  const trkRes1 = await db.query("INSERT INTO trucks (plate, model, capacity_liters, current_level_liters, api_key, fuel_station_id, lat, lng) VALUES ('TRK-0001', 'Test', 100, 50, 'key_1', $1, -23, -46) RETURNING id", [stationId]);
  truckId = trkRes1.rows[0].id;

  const trkRes2 = await db.query("INSERT INTO trucks (plate, model, capacity_liters, current_level_liters, api_key, fuel_station_id, lat, lng) VALUES ('TRK-0002', 'Test', 100, 50, 'key_2', $1, -23, -46) RETURNING id", [stationId]);
  truckId2 = trkRes2.rows[0].id;
});

describe('Facial & Misc Extra Tests', () => {
  const validJPEGBase64MATCH = Buffer.from('ffd8ffe000104a46494600010100000100010000MATCH', 'hex').toString('base64');
  const validJPEGBase64NOMATCH = Buffer.from('ffd8ffe000104a46494600010100000100010000', 'hex').toString('base64');

  it('verify-face na sessão de outro motorista => 403', async () => {
    const s = await db.query("INSERT INTO fueling_sessions (truck_id, driver_id, station_id, status, release_method) VALUES ($1, $2, $3, 'requested', 'facial') RETURNING id", [truckId, driverId, stationId]);
    const res = await request(app).post(`/api/fueling/sessions/${s.rows[0].id}/verify-face`)
      .set('Authorization', 'Bearer ' + tokenDriver2)
      .send({ image_base64: validJPEGBase64MATCH });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Sessão de outro motorista');
  });

  it('facial_verified_at 3 mins atrás => 403 facial_verification_expired', async () => {
    const s = await db.query("INSERT INTO fueling_sessions (truck_id, driver_id, station_id, status, release_method, facial_verified_at) VALUES ($1, $2, $3, 'requested', 'facial', NOW() - INTERVAL '3 minutes') RETURNING id", [truckId, driverId, stationId]);
    const res = await request(app).post(`/api/fueling/sessions/${s.rows[0].id}/authorize`)
      .set('Authorization', 'Bearer ' + tokenDriver)
      .send({});
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('facial_verification_expired');
  });

  it('ble-confirmed com chave de OUTRO caminhão => 403', async () => {
    const s = await db.query("INSERT INTO fueling_sessions (truck_id, driver_id, station_id, status, release_method) VALUES ($1, $2, $3, 'requested', 'ble_fallback') RETURNING id", [truckId, driverId, stationId]);
    const res = await request(app).post(`/api/fueling/sessions/${s.rows[0].id}/ble-confirmed`)
      .set('x-api-key', 'key_2') // chave do truck 2
      .send({});
    expect(res.status).toBe(403);
  });

  it('reativar motorista mantém face_enrolled=false', async () => {
    // First deactivate
    await request(app).patch(`/api/drivers/${driverId2}/deactivate`).set('Authorization', 'Bearer ' + tokenManager);
    
    // Then reactivate
    const res = await request(app).patch(`/api/drivers/${driverId2}/activate`).set('Authorization', 'Bearer ' + tokenManager);
    expect(res.status).toBe(200);
    expect(res.body.face_enrolled).toBe(false);
  });

  it('mock sem MATCH => verified false', async () => {
    const s = await db.query("INSERT INTO fueling_sessions (truck_id, driver_id, station_id, status, release_method) VALUES ($1, $2, $3, 'requested', 'facial') RETURNING id", [truckId, driverId, stationId]);
    const res = await request(app).post(`/api/fueling/sessions/${s.rows[0].id}/verify-face`)
      .set('Authorization', 'Bearer ' + tokenDriver)
      .send({ image_base64: validJPEGBase64NOMATCH });
    
    expect(res.status).toBe(200);
    expect(res.body.verified).toBe(false);
  });

  it('provider erro => 503 e ZERO linhas novas', async () => {
    const faceProvider = require('../src/services/faceProvider');
    const spy = jest.spyOn(faceProvider, 'verify').mockRejectedValue({ code: 'NOT_IMPLEMENTED', message: 'Not implemented' });

    const s = await db.query("INSERT INTO fueling_sessions (truck_id, driver_id, station_id, status, release_method) VALUES ($1, $2, $3, 'requested', 'facial') RETURNING id", [truckId, driverId, stationId]);
    
    const countBefore = await db.query("SELECT COUNT(*) FROM facial_attempts");

    const res = await request(app).post(`/api/fueling/sessions/${s.rows[0].id}/verify-face`)
      .set('Authorization', 'Bearer ' + tokenDriver)
      .send({ image_base64: validJPEGBase64MATCH });
    
    expect(res.status).toBe(503);
    
    const countAfter = await db.query("SELECT COUNT(*) FROM facial_attempts");
    expect(countAfter.rows[0].count).toBe(countBefore.rows[0].count);

    spy.mockRestore();
  });

  it('5 parallel verify-face => max 3 rows in attempts, others 429', async () => {
    const s = await db.query("INSERT INTO fueling_sessions (truck_id, driver_id, station_id, status, release_method) VALUES ($1, $2, $3, 'requested', 'facial') RETURNING id", [truckId, driverId, stationId]);
    
    const reqs = [];
    for (let i = 0; i < 5; i++) {
      reqs.push(
        request(app).post(`/api/fueling/sessions/${s.rows[0].id}/verify-face`)
          .set('Authorization', 'Bearer ' + tokenDriver)
          .send({ image_base64: validJPEGBase64NOMATCH })
      );
    }
    
    const results = await Promise.all(reqs);
    const statuses = results.map(r => r.status);
    
    expect(statuses).toContain(429);
    
    // Check how many were processed
    const count = await db.query("SELECT COUNT(*) FROM facial_attempts WHERE session_id=$1", [s.rows[0].id]);
    expect(parseInt(count.rows[0].count, 10)).toBeLessThanOrEqual(3);
  });

  it('corpo 200KB em /login => 413', async () => {
    const bigPayload = 'a'.repeat(200 * 1024);
    const res = await request(app).post('/api/auth/login')
      .send({ email: 'gestor4@test.com', password: 'hash', dummy: bigPayload });
    expect(res.status).toBe(413);
  });

  describe('FACE_MOCK_MODE tests', () => {
    const validImageBuffer = Buffer.from('ffd8ffe000104a46494600010100000100010000PLAIN_IMAGE_DATA');
    const nomatchBuffer = Buffer.from('ffd8ffe000104a46494600010100000100010000NOMATCH_DATA');
    const noliveBuffer = Buffer.from('ffd8ffe000104a46494600010100000100010000NOLIVE_DATA');

    it('marker (padrão) sem marcador => match false', async () => {
      const origProvider = process.env.FACE_PROVIDER;
      const origMode = process.env.FACE_MOCK_MODE;
      const origNodeEnv = process.env.NODE_ENV;
      process.env.FACE_PROVIDER = 'mock';
      delete process.env.FACE_MOCK_MODE;
      process.env.NODE_ENV = 'test';

      let provider;
      jest.isolateModules(() => {
        provider = require('../src/services/faceProvider');
      });
      const result = await provider.verify('drv1', 'ref1', validImageBuffer);
      expect(result.match).toBe(false);
      expect(result.livenessPassed).toBe(true);

      process.env.FACE_PROVIDER = origProvider;
      if (origMode !== undefined) process.env.FACE_MOCK_MODE = origMode; else delete process.env.FACE_MOCK_MODE;
      process.env.NODE_ENV = origNodeEnv;
    });

    it('always_match com imagem sem marcador => match true', async () => {
      const origProvider = process.env.FACE_PROVIDER;
      const origMode = process.env.FACE_MOCK_MODE;
      const origNodeEnv = process.env.NODE_ENV;
      process.env.FACE_PROVIDER = 'mock';
      process.env.FACE_MOCK_MODE = 'always_match';
      process.env.NODE_ENV = 'test';

      let provider;
      jest.isolateModules(() => {
        provider = require('../src/services/faceProvider');
      });
      const result = await provider.verify('drv1', 'ref1', validImageBuffer);
      expect(result.match).toBe(true);
      expect(result.livenessPassed).toBe(true);

      process.env.FACE_PROVIDER = origProvider;
      if (origMode !== undefined) process.env.FACE_MOCK_MODE = origMode; else delete process.env.FACE_MOCK_MODE;
      process.env.NODE_ENV = origNodeEnv;
    });

    it('always_match com NOMATCH => false', async () => {
      const origProvider = process.env.FACE_PROVIDER;
      const origMode = process.env.FACE_MOCK_MODE;
      const origNodeEnv = process.env.NODE_ENV;
      process.env.FACE_PROVIDER = 'mock';
      process.env.FACE_MOCK_MODE = 'always_match';
      process.env.NODE_ENV = 'test';

      let provider;
      jest.isolateModules(() => {
        provider = require('../src/services/faceProvider');
      });
      const result = await provider.verify('drv1', 'ref1', nomatchBuffer);
      expect(result.match).toBe(false);

      process.env.FACE_PROVIDER = origProvider;
      if (origMode !== undefined) process.env.FACE_MOCK_MODE = origMode; else delete process.env.FACE_MOCK_MODE;
      process.env.NODE_ENV = origNodeEnv;
    });

    it('always_match com NOLIVE => liveness false', async () => {
      const origProvider = process.env.FACE_PROVIDER;
      const origMode = process.env.FACE_MOCK_MODE;
      const origNodeEnv = process.env.NODE_ENV;
      process.env.FACE_PROVIDER = 'mock';
      process.env.FACE_MOCK_MODE = 'always_match';
      process.env.NODE_ENV = 'test';

      let provider;
      jest.isolateModules(() => {
        provider = require('../src/services/faceProvider');
      });
      const result = await provider.verify('drv1', 'ref1', noliveBuffer);
      expect(result.livenessPassed).toBe(false);

      process.env.FACE_PROVIDER = origProvider;
      if (origMode !== undefined) process.env.FACE_MOCK_MODE = origMode; else delete process.env.FACE_MOCK_MODE;
      process.env.NODE_ENV = origNodeEnv;
    });

    it('valor inválido de FACE_MOCK_MODE => lança', () => {
      const origProvider = process.env.FACE_PROVIDER;
      const origMode = process.env.FACE_MOCK_MODE;
      const origNodeEnv = process.env.NODE_ENV;
      process.env.FACE_PROVIDER = 'mock';
      process.env.FACE_MOCK_MODE = 'invalid_mode';
      process.env.NODE_ENV = 'test';

      expect(() => {
        jest.isolateModules(() => {
          require('../src/services/faceProvider');
        });
      }).toThrow(/FACE_MOCK_MODE inválido/i);

      process.env.FACE_PROVIDER = origProvider;
      if (origMode !== undefined) process.env.FACE_MOCK_MODE = origMode; else delete process.env.FACE_MOCK_MODE;
      process.env.NODE_ENV = origNodeEnv;
    });

    it('production + always_match => lança', () => {
      const origProvider = process.env.FACE_PROVIDER;
      const origMode = process.env.FACE_MOCK_MODE;
      const origNodeEnv = process.env.NODE_ENV;
      process.env.FACE_PROVIDER = 'mock';
      process.env.FACE_MOCK_MODE = 'always_match';
      process.env.NODE_ENV = 'production';

      expect(() => {
        jest.isolateModules(() => {
          require('../src/services/faceProvider');
        });
      }).toThrow();

      process.env.FACE_PROVIDER = origProvider;
      if (origMode !== undefined) process.env.FACE_MOCK_MODE = origMode; else delete process.env.FACE_MOCK_MODE;
      process.env.NODE_ENV = origNodeEnv;
    });

    it('production + mock => lança', () => {
      const origProvider = process.env.FACE_PROVIDER;
      const origMode = process.env.FACE_MOCK_MODE;
      const origNodeEnv = process.env.NODE_ENV;
      process.env.FACE_PROVIDER = 'mock';
      process.env.FACE_MOCK_MODE = 'marker';
      process.env.NODE_ENV = 'production';

      expect(() => {
        jest.isolateModules(() => {
          require('../src/services/faceProvider');
        });
      }).toThrow(/MOCK FACE PROVIDER IS FORBIDDEN IN PRODUCTION/i);

      process.env.FACE_PROVIDER = origProvider;
      if (origMode !== undefined) process.env.FACE_MOCK_MODE = origMode; else delete process.env.FACE_MOCK_MODE;
      process.env.NODE_ENV = origNodeEnv;
    });

    it('com FACE_MOCK_MODE=always_match, POST verify-face com JPEG válido SEM marcador => 200 {verified:true}', async () => {
      const origMode = process.env.FACE_MOCK_MODE;
      process.env.FACE_MOCK_MODE = 'always_match';

      const s = await db.query(
        "INSERT INTO fueling_sessions (truck_id, driver_id, station_id, status, release_method) VALUES ($1, $2, $3, 'requested', 'facial') RETURNING id",
        [truckId, driverId, stationId]
      );
      const validPlainJPEG = Buffer.concat([
        Buffer.from('ffd8ffe000104a46494600010100000100010000', 'hex'),
        Buffer.from('CLEAN_PHOTO_NO_MARKER')
      ]).toString('base64');
      const res = await request(app).post(`/api/fueling/sessions/${s.rows[0].id}/verify-face`)
        .set('Authorization', 'Bearer ' + tokenDriver)
        .send({ image_base64: validPlainJPEG });

      if (origMode !== undefined) process.env.FACE_MOCK_MODE = origMode; else delete process.env.FACE_MOCK_MODE;

      expect(res.status).toBe(200);
      expect(res.body.verified).toBe(true);
    });
  });
});

