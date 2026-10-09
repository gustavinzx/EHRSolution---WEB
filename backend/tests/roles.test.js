const request = require('supertest');
const { app } = require('../src/index');
const db = require('../src/config/db');
const jwt = require('jsonwebtoken');

if (!process.env.DB_NAME?.endsWith('_test')) {
  throw new Error("DB_NAME must end with '_test' to run tests safely.");
}

describe('Roles and Permissions Tests', () => {
  it('admin can change password, manager cannot, short password fails', async () => {
    const r1 = await request(app).patch(`/api/users/${adminId}/password`).set('Authorization', `Bearer ${managerToken}`).send({ password: 'newpassword' });
    expect(r1.status).toBe(403);
    const r2 = await request(app).patch(`/api/users/${adminId}/password`).set('Authorization', `Bearer ${adminToken}`).send({ password: 'short' });
    expect(r2.status).toBe(400);
    const r3 = await request(app).patch(`/api/users/${adminId}/password`).set('Authorization', `Bearer ${adminToken}`).send({ password: 'newpassword' });
    expect(r3.status).toBe(200);
  });

  let adminToken, managerToken, auditorToken, inactiveToken, oldToken;
  let adminId, managerId, auditorId, inactiveId;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test_secret_for_roles';

    // Wipe users and alert_settings_history just to be safe
    await db.query('DELETE FROM users');
    await db.query('DELETE FROM alert_settings_history');

    // Create Admin
    const a = await db.query(
      "INSERT INTO users (name, email, password_hash, role, is_active) VALUES ('A', 'a@a.com', 'h', 'admin', true) RETURNING id"
    );
    adminId = a.rows[0].id;
    adminToken = jwt.sign({ id: adminId, email: 'a@a.com', role: 'admin' }, process.env.JWT_SECRET);

    // Create Manager
    const m = await db.query(
      "INSERT INTO users (name, email, password_hash, role, is_active) VALUES ('M', 'm@m.com', 'h', 'manager', true) RETURNING id"
    );
    managerId = m.rows[0].id;
    managerToken = jwt.sign({ id: managerId, email: 'm@m.com', role: 'manager' }, process.env.JWT_SECRET);

    // Create Auditor
    const aud = await db.query(
      "INSERT INTO users (name, email, password_hash, role, is_active) VALUES ('Aud', 'u@u.com', 'h', 'auditor', true) RETURNING id"
    );
    auditorId = aud.rows[0].id;
    auditorToken = jwt.sign({ id: auditorId, email: 'u@u.com', role: 'auditor' }, process.env.JWT_SECRET);

    // Create Inactive
    const inact = await db.query(
      "INSERT INTO users (name, email, password_hash, role, is_active) VALUES ('In', 'i@i.com', 'h', 'manager', false) RETURNING id"
    );
    inactiveId = inact.rows[0].id;
    inactiveToken = jwt.sign({ id: inactiveId, email: 'i@i.com', role: 'manager' }, process.env.JWT_SECRET);
    
    // Old token without role
    oldToken = jwt.sign({ id: managerId, email: 'm@m.com' }, process.env.JWT_SECRET);
  });

  afterAll(async () => {
    await db.query('DELETE FROM users');
  });

  it('admin can change password, manager cannot, short password fails', async () => {
    const r1 = await request(app).patch(`/api/users/${adminId}/password`).set('Authorization', `Bearer ${managerToken}`).send({ password: 'newpassword' });
    expect(r1.status).toBe(403);
    const r2 = await request(app).patch(`/api/users/${adminId}/password`).set('Authorization', `Bearer ${adminToken}`).send({ password: 'short' });
    expect(r2.status).toBe(400);
    const r3 = await request(app).patch(`/api/users/${adminId}/password`).set('Authorization', `Bearer ${adminToken}`).send({ password: 'newpassword' });
    expect(r3.status).toBe(200);
  });

  it('auditor: GET routes return 200', async () => {
    const r1 = await request(app).get('/api/alerts').set('Authorization', `Bearer ${auditorToken}`);
    expect(r1.status).toBe(200);
    const r2 = await request(app).get('/api/fueling').set('Authorization', `Bearer ${auditorToken}`);
    expect(r2.status).toBe(200);
    const r3 = await request(app).get('/api/settings/alerts').set('Authorization', `Bearer ${auditorToken}`);
    expect(r3.status).toBe(200);
  });

  it('auditor: Mutations return 403 forbidden_role', async () => {
    const r1 = await request(app).patch('/api/alerts/999/resolve').set('Authorization', `Bearer ${auditorToken}`).send({ resolution_note: 'teste' });
    expect(r1.status).toBe(403);
    expect(r1.body.error).toBe('forbidden_role');
    const r2 = await request(app).put('/api/settings/alerts').set('Authorization', `Bearer ${auditorToken}`).send({ divergence_pct: 10 });
    expect(r2.status).toBe(403);
    expect(r2.body.error).toBe('forbidden_role');
    const r3 = await request(app).post('/api/drivers/999/face/enroll').set('Authorization', `Bearer ${auditorToken}`);
    expect(r3.status).toBe(403);
    expect(r3.body.error).toBe('forbidden_role');
    const r4 = await request(app).patch('/api/drivers/999/deactivate').set('Authorization', `Bearer ${auditorToken}`);
    expect(r4.status).toBe(403);
    expect(r4.body.error).toBe('forbidden_role');
    const r5 = await request(app).post('/api/fueling/emergency-unlock').set('Authorization', `Bearer ${auditorToken}`);
    expect(r5.status).toBe(403);
    expect(r5.body.error).toBe('forbidden_role');
    const r6 = await request(app).post('/api/drivers').set('Authorization', `Bearer ${auditorToken}`);
    expect(r6.status).toBe(403);
    expect(r6.body.error).toBe('forbidden_role');
  });

  it('manager: Settings PUT is 403, Users GET is 403, but resolve alert is 200', async () => {
    // Create a dummy alert to resolve
    const alertRes = await db.query("INSERT INTO fleet_alerts (truck_id, type, message) VALUES (NULL, 'test', 'msg') RETURNING id");
    const rResolve = await request(app).patch(`/api/alerts/${alertRes.rows[0].id}/resolve`).set('Authorization', `Bearer ${managerToken}`).send({ resolution_note: 'resolvido' });
    expect(rResolve.status).toBe(200);

    const r1 = await request(app).put('/api/settings/alerts').set('Authorization', `Bearer ${managerToken}`).send({ divergence_pct: 10 });
    expect(r1.status).toBe(403);
    expect(r1.body.error).toBe('forbidden_role');
    const r2 = await request(app).get('/api/users').set('Authorization', `Bearer ${managerToken}`);
    expect(r2.status).toBe(403);
    expect(r2.body.error).toBe('forbidden_role');
  });

  it('admin: Settings PUT is 200, Users POST works (no password_hash in response)', async () => {
    const r1 = await request(app).put('/api/settings/alerts').set('Authorization', `Bearer ${adminToken}`).send({
      divergence_pct: 10, divergence_critical_pct: 20, offhours_start_hour: 22, offhours_end_hour: 5, offhours_enabled: 1
    });
    expect(r1.status).toBe(200);

    const r2 = await request(app).post('/api/users').set('Authorization', `Bearer ${adminToken}`).send({
      name: 'New Admin', email: 'new@admin.com', password: 'password123', role: 'admin'
    });
    expect(r2.status).toBe(201);
    expect(r2.body.password_hash).toBeUndefined();
  });

  it('admin: Rebaixando o último admin ativo => 409', async () => {
    // Delete the new admin created above so there's only 1 active admin (adminId)
    await db.query("DELETE FROM users WHERE email = 'new@admin.com'");

    const r1 = await request(app).patch(`/api/users/${adminId}`).set('Authorization', `Bearer ${adminToken}`).send({ role: 'manager' });
    expect(r1.status).toBe(409);
    const r2 = await request(app).patch(`/api/users/${adminId}`).set('Authorization', `Bearer ${adminToken}`).send({ is_active: false });
    expect(r2.status).toBe(409);
  });

  it('admin: Reativando o único admin não dá 409 falso', async () => {
    const r1 = await request(app).patch(`/api/users/${adminId}`).set('Authorization', `Bearer ${adminToken}`).send({ is_active: true });
    expect(r1.status).toBe(200);
  });

  it('PATCH usuário inexistente => 404 e pool ok', async () => {
    const r1 = await request(app).patch(`/api/users/999999`).set('Authorization', `Bearer ${adminToken}`).send({ role: 'manager' });
    expect(r1.status).toBe(404);
    const actRes = await db.query("SELECT count(*) as count FROM pg_stat_activity WHERE state = 'idle in transaction' AND datname = current_database()");
    expect(parseInt(actRes.rows[0].count)).toBe(0);
  });

  it('usuário desativado com token válido => 401', async () => {
    const r1 = await request(app).get('/api/alerts').set('Authorization', `Bearer ${inactiveToken}`);
    expect(r1.status).toBe(401);
  });

  it('rebaixar usuário vale na requisição seguinte', async () => {
    // We have a manager. We change them to auditor.
    await request(app).patch(`/api/users/${managerId}`).set('Authorization', `Bearer ${adminToken}`).send({ role: 'auditor' });
    // Same token used, but should be auditor in DB now
    const r1 = await request(app).post('/api/drivers').set('Authorization', `Bearer ${managerToken}`).send({ name: 'D1' });
    expect(r1.status).toBe(403);
    expect(r1.body.error).toBe('forbidden_role');
  });

  it('token antigo sem role funciona como manager (default no backend)', async () => {
    // Restore manager to manager
    await request(app).patch(`/api/users/${managerId}`).set('Authorization', `Bearer ${adminToken}`).send({ role: 'manager' });
    // oldToken has no role
    const r1 = await request(app).post('/api/drivers').set('Authorization', `Bearer ${oldToken}`).send({ name: 'D2' });
    expect(r1.status).toBe(201);
  });

  it('login de usuário desativado => 401', async () => {
    const r1 = await request(app).post('/api/auth/login').send({ email: 'i@i.com', password: 'h' });
    expect(r1.status).toBe(401);
  });
});











