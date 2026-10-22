const request = require('supertest');
const { app } = require('../src/index');
const db = require('../src/config/db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

if (!process.env.DB_NAME || !process.env.DB_NAME.endsWith('_test')) {
  process.exit(1);
}

const clean = require('./clean');

describe('BLOCO E — Exclusão que preserva auditoria e trilha antifraude', () => {
  let adminToken;
  let driverId;
  let truckId;
  let rawPassword = 'Password@123';

  beforeAll(async () => {
    await clean();

    const adminRes = await db.query(
      "INSERT INTO users (name, email, password_hash, role) VALUES ('Admin Auditoria', 'admin.audit@test.com', 'hash', 'admin') RETURNING id"
    );
    adminToken = jwt.sign(
      { id: adminRes.rows[0].id, email: 'admin.audit@test.com', name: 'Admin Auditoria', role: 'admin' },
      process.env.JWT_SECRET || 'test_secret_that_has_at_least_32_characters_for_unit_tests'
    );
  });

  afterAll(async () => {
    await clean();
  });

  beforeEach(async () => {
    // Cria motorista com dados pessoais (PII)
    const passHash = await bcrypt.hash(rawPassword, 10);
    const drvRes = await db.query(
      `INSERT INTO drivers (name, email, phone, password_hash, is_active, face_enrolled, face_photo, face_template_ref, status)
       VALUES ('Carlos Motorista Real', 'carlos.real@empresa.com', '+5511999998888', $1, true, true, 'data:image/jpeg;base64,mockphoto', 'template_carlos_123', 'active')
       RETURNING id`,
      [passHash]
    );
    driverId = drvRes.rows[0].id;

    // Cria caminhão com hardware key
    const trkRes = await db.query(
      `INSERT INTO trucks (plate, model, capacity_liters, current_level_liters, status, api_key, api_key_hash)
       VALUES ('AUD-9999', 'Volvo FH 540', 600, 450, 'ok', 'raw_key_123', 'hash_key_123')
       RETURNING id`
    );
    truckId = trkRes.rows[0].id;

    // Vincula motorista ao caminhão
    await db.query(
      'INSERT INTO driver_trucks (driver_id, truck_id) VALUES ($1, $2)',
      [driverId, truckId]
    );

    // Cria sessao, log de abastecimento e tentativa facial
    const sessRes = await db.query(
      `INSERT INTO fueling_sessions (truck_id, driver_id, status, release_method)
       VALUES ($1, $2, 'completed', 'facial')
       RETURNING id`,
      [truckId, driverId]
    );
    const sessionId = sessRes.rows[0].id;

    await db.query(
      `INSERT INTO fueling_logs (truck_id, driver_id, level_before, level_after, release_method, volume_liters)
       VALUES ($1, $2, 200, 450, 'facial', 250)`,
      [truckId, driverId]
    );

    await db.query(
      `INSERT INTO facial_attempts (session_id, driver_id, truck_id, success, score, liveness_passed, provider)
       VALUES ($1, $2, $3, true, 98.5, true, 'mock')`,
      [sessionId, driverId, truckId]
    );

    // Cria alerta e telemetria
    await db.query(
      `INSERT INTO fleet_alerts (truck_id, type, severity, message, plate, model)
       VALUES ($1, 'rapid_drop', 'high', 'Queda brusca detectada', 'AUD-9999', 'Volvo FH 540')`,
      [truckId]
    );

    await db.query(
      `INSERT INTO telemetry_logs (truck_id, lat, lng, speed_kmh, fuel_level_liters)
       VALUES ($1, -23.5505, -46.6333, 80, 450)`,
      [truckId]
    );
  });

  afterEach(async () => {
    await db.query('DELETE FROM facial_attempts WHERE driver_id = $1 OR truck_id = $2', [driverId, truckId]);
    await db.query('DELETE FROM fueling_logs WHERE driver_id = $1 OR truck_id = $2', [driverId, truckId]);
    await db.query('DELETE FROM fueling_sessions WHERE driver_id = $1 OR truck_id = $2', [driverId, truckId]);
    await db.query('DELETE FROM telemetry_logs WHERE truck_id = $1', [truckId]);
    await db.query('DELETE FROM fleet_alerts WHERE truck_id = $1', [truckId]);
    await db.query('DELETE FROM driver_trucks WHERE driver_id = $1 OR truck_id = $2', [driverId, truckId]);
    await db.query('DELETE FROM drivers WHERE id = $1', [driverId]);
    await db.query('DELETE FROM trucks WHERE id = $1', [truckId]);
  });

  it('1. Exclusão de motorista anonimiza PII, marca status deleted, desativa login e preserva histórico/logs', async () => {
    // 1. Confirma que antes da exclusão o motorista consegue logar
    const loginPre = await request(app)
      .post('/api/auth/driver/login')
      .send({ email: 'carlos.real@empresa.com', password: rawPassword });
    expect(loginPre.status).toBe(200);

    // 2. Executa exclusão via API do painel
    const delRes = await request(app)
      .delete(`/api/drivers/${driverId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(delRes.status).toBe(200);
    expect(delRes.body.message).toContain('deleted successfully');

    // 3. Verifica no banco: registro PRESERVADO com mesmo id, mas PII anonimizada
    const { rows: drvRows } = await db.query('SELECT * FROM drivers WHERE id = $1', [driverId]);
    expect(drvRows.length).toBe(1);
    const d = drvRows[0];

    expect(d.id).toBe(driverId);
    expect(d.status).toBe('deleted');
    expect(d.is_active).toBe(false);
    expect(d.deleted_at).not.toBeNull();
    // PII removida / mascarada
    expect(d.name).toBe(`Motorista Anonimizado #${driverId}`);
    expect(d.email).toBe(`anonimizado_${driverId}@removido.local`);
    expect(d.phone).toBeNull();
    expect(d.face_photo).toBeNull();
    expect(d.face_template_ref).toBeNull();
    expect(d.face_enrolled).toBe(false);
    expect(d.password_hash.startsWith('DELETED_')).toBe(true);

    // 4. Login é sumariamente impedido
    const loginOldEmail = await request(app)
      .post('/api/auth/driver/login')
      .send({ email: 'carlos.real@empresa.com', password: rawPassword });
    expect(loginOldEmail.status).toBe(401);

    const loginAnonEmail = await request(app)
      .post('/api/auth/driver/login')
      .send({ email: d.email, password: rawPassword });
    expect(loginAnonEmail.status).toBe(401);

    // 5. Histórico de auditoria e trilha antifraude CONTINUAM atribuídos ao ID
    const { rows: fLogs } = await db.query('SELECT * FROM fueling_logs WHERE driver_id = $1', [driverId]);
    expect(fLogs.length).toBe(1);
    expect(fLogs[0].driver_id).toBe(driverId);

    const { rows: fSessions } = await db.query('SELECT * FROM fueling_sessions WHERE driver_id = $1', [driverId]);
    expect(fSessions.length).toBe(1);
    expect(fSessions[0].driver_id).toBe(driverId);

    const { rows: fAttempts } = await db.query('SELECT * FROM facial_attempts WHERE driver_id = $1', [driverId]);
    expect(fAttempts.length).toBe(1);
    expect(fAttempts[0].driver_id).toBe(driverId);

    // 6. Listagem do painel (GET /api/drivers) OCULTA motorista excluído
    const listRes = await request(app)
      .get('/api/drivers')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(listRes.status).toBe(200);
    const inList = listRes.body.find((item) => item.id === driverId);
    expect(inList).toBeUndefined();
  });

  it('2. Exclusão de caminhão marca status deleted, revoga chave e preserva logs, telemetria e alertas', async () => {
    // 1. Executa exclusão do caminhão
    const delRes = await request(app)
      .delete(`/api/fleet/${truckId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(delRes.status).toBe(200);
    expect(delRes.body.success).toBe(true);

    // 2. Verifica no banco: registro mantido com mesmo id, status='deleted', chaves zeradas
    const { rows: trkRows } = await db.query('SELECT * FROM trucks WHERE id = $1', [truckId]);
    expect(trkRows.length).toBe(1);
    const t = trkRows[0];
    expect(t.id).toBe(truckId);
    expect(t.status).toBe('deleted');
    expect(t.is_active).toBe(false);
    expect(t.deleted_at).not.toBeNull();
    expect(t.api_key).toBeNull();
    expect(t.api_key_hash).toBeNull();

    // 3. Auditoria mantida: logs de combustível, telemetria, sessões e alertas continuam atribuídos ao truckId
    const { rows: fLogs } = await db.query('SELECT * FROM fueling_logs WHERE truck_id = $1', [truckId]);
    expect(fLogs.length).toBe(1);
    expect(fLogs[0].truck_id).toBe(truckId);

    const { rows: fSessions } = await db.query('SELECT * FROM fueling_sessions WHERE truck_id = $1', [truckId]);
    expect(fSessions.length).toBe(1);
    expect(fSessions[0].truck_id).toBe(truckId);

    const { rows: fTelems } = await db.query('SELECT * FROM telemetry_logs WHERE truck_id = $1', [truckId]);
    expect(fTelems.length).toBe(1);
    expect(fTelems[0].truck_id).toBe(truckId);

    const { rows: fAlerts } = await db.query('SELECT * FROM fleet_alerts WHERE truck_id = $1', [truckId]);
    expect(fAlerts.length).toBe(1);
    expect(fAlerts[0].truck_id).toBe(truckId);

    // 4. Listagem do painel (GET /api/fleet) OCULTA caminhão excluído
    const listRes = await request(app)
      .get('/api/fleet')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(listRes.status).toBe(200);
    const inList = listRes.body.find((item) => item.id === truckId);
    expect(inList).toBeUndefined();

    // 5. Detalhe do caminhão (GET /api/fleet/:id) retorna 404
    const getRes = await request(app)
      .get(`/api/fleet/${truckId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(getRes.status).toBe(404);
  });
});
