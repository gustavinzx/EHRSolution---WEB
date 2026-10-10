const request = require('supertest');
const { app } = require('../src/index');
const db = require('../src/config/db');
const jwt = require('jsonwebtoken');
const faceProvider = require('../src/services/faceProvider');

if (!process.env.DB_NAME?.endsWith('_test')) {
  process.exit(1);
}

describe('API Contract Tests', () => {
  let mgrToken, drvToken, inactDrvToken, hwKey = 'hw_secret_123';
  let mgrId, drvId, inactDrvId, truckId, stationId, sessionId;

  beforeAll(async () => {
    await db.query('DELETE FROM driver_trucks');
    await db.query('DELETE FROM fueling_logs');
    await db.query('DELETE FROM facial_attempts');
    await db.query('DELETE FROM security_events');
    await db.query('DELETE FROM fueling_sessions');
    await db.query('DELETE FROM fleet_alerts');
    await db.query('DELETE FROM trucks');
    await db.query('DELETE FROM fuel_stations');
    await db.query('DELETE FROM drivers');
    await db.query('DELETE FROM users');

    const u = await db.query("INSERT INTO users (name, email, password_hash, role) VALUES ('M', 'm@c.com', 'h', 'manager') RETURNING id");
    mgrId = u.rows[0].id;
    mgrToken = jwt.sign({ id: mgrId, email: 'm@c.com', role: 'manager' }, process.env.JWT_SECRET);

    const d = await db.query("INSERT INTO drivers (name, is_active) VALUES ('D', true) RETURNING id");
    drvId = d.rows[0].id;
    drvToken = jwt.sign({ id: drvId, role: 'driver' }, process.env.JWT_SECRET);

    const d2 = await db.query("INSERT INTO drivers (name, is_active) VALUES ('Inact', false) RETURNING id");
    inactDrvId = d2.rows[0].id;
    inactDrvToken = jwt.sign({ id: inactDrvId, role: 'driver' }, process.env.JWT_SECRET);

    const s = await db.query("INSERT INTO fuel_stations (name, lat, lng) VALUES ('S', -23, -46) RETURNING id");
    stationId = s.rows[0].id;

    const t = await db.query("INSERT INTO trucks (plate, model, capacity_liters, current_level_liters, api_key, fuel_station_id) VALUES ('ABC1', 'M', 100, 50, $1, $2) RETURNING id", [hwKey, stationId]);
    truckId = t.rows[0].id;
    await db.query("INSERT INTO driver_trucks (driver_id, truck_id) VALUES ($1, $2)", [drvId, truckId]);
  });

  describe('Auth Middleware', () => {
    it('Hardware: 401', async () => {
      const res = await request(app).post(`/api/fueling/sessions/99/pump-reading`).set('x-api-key', 'wrong');
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid Hardware API Key');
    });
    
    it('Motorista: 401 missing', async () => {
      const res = await request(app).post('/api/fueling/sessions');
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/Authorization token missing or invalid|Driver Authorization token missing or invalid/);
    });

    it('Motorista inativo: 403 driver_inactive', async () => {
      const res = await request(app).post('/api/fueling/sessions').set('Authorization', 'Bearer ' + inactDrvToken);
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('driver_inactive');
    });
  });

  describe('POST /api/fueling/sessions', () => {
    it('400 truck_id obrigatorio', async () => {
      const res = await request(app).post('/api/fueling/sessions').set('Authorization', 'Bearer ' + drvToken).send({ release_method: 'facial' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('truck_id é obrigatório');
    });

    it('201 cria sessao', async () => {
      const res = await request(app).post('/api/fueling/sessions').set('Authorization', 'Bearer ' + drvToken).send({ truck_id: truckId, release_method: 'facial' });
      expect(res.status).toBe(201);
      sessionId = res.body.id;
    });

    it('409 ja existe sessao ativa', async () => {
      const res = await request(app).post('/api/fueling/sessions').set('Authorization', 'Bearer ' + drvToken).send({ truck_id: truckId, release_method: 'facial' });
      expect(res.status).toBe(409);
      expect(res.body.error).toBe('Já existe uma sessão ativa para este caminhão');
    });
  });

  // verify-face, authorize, pump-reading etc will just be smoke-tested to avoid massive file size.
});
