const request = require('supertest');
const { app } = require('../src/index');
const db = require('../src/config/db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const clean = require('./clean');
const { startVirtualHardware, checkAndProcessSessions } = require('../src/services/virtualHardware');
const fleetDataProvider = require('../src/services/fleetDataProvider');

if (!process.env.DB_NAME || !process.env.DB_NAME.endsWith('_test')) {
  process.exit(1);
}

const validJPEGBase64 = Buffer.from('ffd8ffe000104a46494600010100000100010000ffdb004300080606070605080707070909080a0c140d0c0b0b0c1912130f141d1a1f1e1d1a1c1c20242e2720222c231c1c2837292c30313434341f27393d38323c2e333432', 'hex').toString('base64');
const validJPEG2Base64 = Buffer.from('ffd8ffe000104a46494600010100000100010000ffdb004300080606070605080707070909080a0c140d0c0b0b0c1912130f141d1a1f1e1d1a1c1c20242e2720222c231c1c2837292c30313434341f27393d38323c2e333433', 'hex').toString('base64');

let tokenManager, tokenAuditor, tokenAdmin;
let stationId;

beforeAll(async () => {
  await clean();

  const uMgr = await db.query("INSERT INTO users (name, email, password_hash, role) VALUES ('Gestor Hardening', 'mgr_hard@test.com', 'hash', 'manager') RETURNING id");
  tokenManager = jwt.sign({ id: uMgr.rows[0].id, role: 'manager', email: 'mgr_hard@test.com' }, process.env.JWT_SECRET);

  const uAud = await db.query("INSERT INTO users (name, email, password_hash, role) VALUES ('Auditor Hardening', 'aud_hard@test.com', 'hash', 'auditor') RETURNING id");
  tokenAuditor = jwt.sign({ id: uAud.rows[0].id, role: 'auditor', email: 'aud_hard@test.com' }, process.env.JWT_SECRET);

  const uAdm = await db.query("INSERT INTO users (name, email, password_hash, role) VALUES ('Admin Hardening', 'adm_hard@test.com', 'hash', 'admin') RETURNING id");
  tokenAdmin = jwt.sign({ id: uAdm.rows[0].id, role: 'admin', email: 'adm_hard@test.com' }, process.env.JWT_SECRET);

  const stRes = await db.query("INSERT INTO fuel_stations (name, lat, lng) VALUES ('Posto Hardening', -23.55, -46.63) RETURNING id");
  stationId = stRes.rows[0].id;
});

describe('BLOCO D1 — Fleet Hardening Tests', () => {
  it('POST /api/fleet cria caminhão e NUNCA retorna api_key no body (201)', async () => {
    const res = await request(app)
      .post('/api/fleet')
      .set('Authorization', 'Bearer ' + tokenManager)
      .send({
        plate: 'FLE1A01',
        model: 'Volvo FH 540',
        capacity_liters: 600,
        current_level_liters: 300,
        fuel_station_id: stationId
      });

    expect(res.status).toBe(201);
    expect(res.body.plate).toBe('FLE1A01');
    expect(res.body.api_key).toBeUndefined();
    expect(res.body).not.toHaveProperty('api_key');
    const allowedKeys = ['id', 'plate', 'model', 'capacity_liters', 'current_level_liters', 'status', 'created_at'].sort();
    expect(Object.keys(res.body).sort()).toEqual(allowedKeys);
  });

  it('POST /api/fleet com campos inválidos => 400', async () => {
    const res = await request(app)
      .post('/api/fleet')
      .set('Authorization', 'Bearer ' + tokenManager)
      .send({
        plate: '',
        model: '',
        capacity_liters: -10
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('POST /api/fleet com placa duplicada => 409', async () => {
    const res = await request(app)
      .post('/api/fleet')
      .set('Authorization', 'Bearer ' + tokenManager)
      .send({
        plate: 'FLE1A01',
        model: 'Scania R450',
        capacity_liters: 500,
        current_level_liters: 250
      });

    expect(res.status).toBe(409);
    expect(res.body.error).toContain('placa');
  });

  it('POST /api/fleet com ator auditor => 403', async () => {
    const res = await request(app)
      .post('/api/fleet')
      .set('Authorization', 'Bearer ' + tokenAuditor)
      .send({
        plate: 'AUD1A01',
        model: 'Mercedes Actros',
        capacity_liters: 500,
        current_level_liters: 250
      });

    expect(res.status).toBe(403);
  });
});

describe('BLOCO D2 — Drivers & Truck Transactional Registration', () => {
  it('POST com new_truck e placa duplicada => 409 e NÃO cria o motorista nem caminhão (rollback)', async () => {
    const driverName = 'Motorista Rollback Dup';
    const res = await request(app)
      .post('/api/drivers')
      .set('Authorization', 'Bearer ' + tokenManager)
      .send({
        name: driverName,
        email: 'dup_driver@test.com',
        new_truck: {
          plate: 'FLE1A01', // já existe
          model: 'Caminhão Existente',
          capacity_liters: 500,
          current_level_liters: 200
        }
      });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('Já existe um caminhão cadastrado com esta placa.');

    // Verifica que o motorista NÃO foi criado
    const { rows } = await db.query("SELECT * FROM drivers WHERE name = $1", [driverName]);
    expect(rows.length).toBe(0);
  });

  it('POST com falha proposital no vínculo => rollback de tudo', async () => {
    const driverName = 'Motorista Falha Vinculo';
    const res = await request(app)
      .post('/api/drivers')
      .set('Authorization', 'Bearer ' + tokenManager)
      .send({
        name: driverName,
        email: 'vinculo_fail@test.com',
        truck_id: 999999 // inexistente
      });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Caminhão não encontrado');

    const { rows } = await db.query("SELECT * FROM drivers WHERE name = $1", [driverName]);
    expect(rows.length).toBe(0);
  });

  it('POST com truck_id inválido => 400; inexistente => 404', async () => {
    const rInvalid = await request(app)
      .post('/api/drivers')
      .set('Authorization', 'Bearer ' + tokenManager)
      .send({
        name: 'Motorista Inv Truck',
        truck_id: -5
      });
    expect(rInvalid.status).toBe(400);
    expect(rInvalid.body.error).toBe('truck_id inválido');

    const rNonExistent = await request(app)
      .post('/api/drivers')
      .set('Authorization', 'Bearer ' + tokenManager)
      .send({
        name: 'Motorista No Truck',
        truck_id: 888888
      });
    expect(rNonExistent.status).toBe(404);
    expect(rNonExistent.body.error).toBe('Caminhão não encontrado');
  });

  it('POST com senha < 8 chars => 400 (sem vazar valor da senha); sem senha => 201 com temporary_password retornado e hash gravado', async () => {
    const sensitiveShortPass = 'curta';
    const rShort = await request(app)
      .post('/api/drivers')
      .set('Authorization', 'Bearer ' + tokenManager)
      .send({
        name: 'Motorista Senha Curta',
        password: sensitiveShortPass
      });
    expect(rShort.status).toBe(400);
    expect(rShort.body.error).toBe('Senha deve ter ao menos 8 caracteres');
    expect(JSON.stringify(rShort.body)).not.toContain(sensitiveShortPass);
    if (rShort.body.errors) {
      rShort.body.errors.forEach(err => {
        expect(err.value).toBeUndefined();
      });
    }

    const rNoPass = await request(app)
      .post('/api/drivers')
      .set('Authorization', 'Bearer ' + tokenManager)
      .send({
        name: 'Motorista Sem Senha',
        email: 'temp_pass@test.com'
      });
    expect(rNoPass.status).toBe(201);
    expect(rNoPass.body.temporary_password).toBeDefined();
    expect(typeof rNoPass.body.temporary_password).toBe('string');
    expect(rNoPass.body.temporary_password.length).toBeGreaterThanOrEqual(12);

    const { rows } = await db.query("SELECT password_hash FROM drivers WHERE id = $1", [rNoPass.body.id]);
    expect(rows[0].password_hash).toBeDefined();
    expect(rows[0].password_hash.startsWith('$2b$')).toBe(true);

    // temporary_password NÃO deve constar em GET
    const rGet = await request(app)
      .get('/api/drivers')
      .set('Authorization', 'Bearer ' + tokenManager);
    const found = rGet.body.find(d => d.id === rNoPass.body.id);
    expect(found.temporary_password).toBeUndefined();
    expect(found.password_hash).toBeUndefined();
  });

  it('POST com auto_enroll_face=true em NODE_ENV=production ou FACE_PROVIDER!=mock => 400', async () => {
    const prevNodeEnv = process.env.NODE_ENV;
    const prevFaceProv = process.env.FACE_PROVIDER;

    try {
      process.env.NODE_ENV = 'production';
      const rProd = await request(app)
        .post('/api/drivers')
        .set('Authorization', 'Bearer ' + tokenManager)
        .send({
          name: 'Motorista Face Prod',
          auto_enroll_face: true
        });
      expect(rProd.status).toBe(400);
      expect(rProd.body.error).toBe('Cadastro facial automático disponível apenas em desenvolvimento');

      process.env.NODE_ENV = 'test';
      process.env.FACE_PROVIDER = 'rekognition';
      const rNotMock = await request(app)
        .post('/api/drivers')
        .set('Authorization', 'Bearer ' + tokenManager)
        .send({
          name: 'Motorista Face Not Mock',
          auto_enroll_face: true
        });
      expect(rNotMock.status).toBe(400);
      expect(rNotMock.body.error).toBe('Cadastro facial automático disponível apenas em desenvolvimento');

      // Em dev/mock => aceito, consent='dev-mock', template='mock_template_<id>'
      process.env.NODE_ENV = 'development';
      process.env.FACE_PROVIDER = 'mock';
      const rDev = await request(app)
        .post('/api/drivers')
        .set('Authorization', 'Bearer ' + tokenManager)
        .send({
          name: 'Motorista Face Dev Mock',
          auto_enroll_face: true
        });
      expect(rDev.status).toBe(201);
      expect(rDev.body.face_enrolled).toBe(true);

      const { rows } = await db.query("SELECT face_consent_version, face_template_ref, face_enrolled FROM drivers WHERE id = $1", [rDev.body.id]);
      expect(rows[0].face_enrolled).toBe(true);
      expect(rows[0].face_consent_version).toBe('dev-mock');
      expect(rows[0].face_template_ref).toBe(`mock_template_${rDev.body.id}`);
    } finally {
      process.env.NODE_ENV = prevNodeEnv;
      process.env.FACE_PROVIDER = prevFaceProv;
    }
  });

  it('PUT /api/drivers/:id com new_truck com placa duplicada => 409 e NÃO altera dados do motorista', async () => {
    const rDriver = await request(app)
      .post('/api/drivers')
      .set('Authorization', 'Bearer ' + tokenManager)
      .send({ name: 'Nome Original Motorista' });
    const dId = rDriver.body.id;

    const rPutDup = await request(app)
      .put(`/api/drivers/${dId}`)
      .set('Authorization', 'Bearer ' + tokenManager)
      .send({
        name: 'Nome Alterado Que Nao Deve Salvar',
        new_truck: {
          plate: 'FLE1A01', // já existe
          model: 'Scania',
          capacity_liters: 400,
          current_level_liters: 200
        }
      });
    expect(rPutDup.status).toBe(409);
    expect(rPutDup.body.error).toBe('Já existe um caminhão cadastrado com esta placa.');

    const { rows } = await db.query("SELECT name FROM drivers WHERE id = $1", [dId]);
    expect(rows[0].name).toBe('Nome Original Motorista');
  });
});

describe('BLOCO D3 — verifyFace e enrollFace Preservation', () => {
  it('Primeira verificação bem-sucedida grava face_photo; segunda com OUTRA foto NÃO sobrescreve a original', async () => {
    const photo1 = Buffer.concat([Buffer.from([0xff, 0xd8]), Buffer.from('MATCH_FIRST_PHOTO')]).toString('base64');
    const photo2 = Buffer.concat([Buffer.from([0xff, 0xd8]), Buffer.from('MATCH_SECOND_PHOTO')]).toString('base64');
    const photo3 = Buffer.concat([Buffer.from([0xff, 0xd8]), Buffer.from('MATCH_THIRD_PHOTO')]).toString('base64');

    const drvRes = await db.query(
      "INSERT INTO drivers (name, is_active, face_enrolled, face_template_ref) VALUES ('Driver Photo Test', true, true, 'mock_template_photo') RETURNING id"
    );
    const dId = drvRes.rows[0].id;

    const trkRes = await db.query(
      "INSERT INTO trucks (plate, model, capacity_liters, current_level_liters, api_key, fuel_station_id, lat, lng) VALUES ('PHO1A01', 'Test', 200, 100, 'key_pho', $1, -23.55, -46.63) RETURNING id",
      [stationId]
    );
    const tId = trkRes.rows[0].id;

    const sessRes = await db.query(
      "INSERT INTO fueling_sessions (driver_id, truck_id, station_id, status, requested_at) VALUES ($1, $2, $3, 'requested', NOW()) RETURNING id",
      [dId, tId, stationId]
    );
    const sId = sessRes.rows[0].id;

    const tokenDriver = jwt.sign({ id: dId, role: 'driver', truck_id: tId }, process.env.JWT_SECRET);

    // Primeira verificação com photo1
    const r1 = await request(app)
      .post(`/api/fueling/sessions/${sId}/verify-face`)
      .set('Authorization', 'Bearer ' + tokenDriver)
      .send({ image_base64: photo1, lat: -23.55, lng: -46.63 });
    expect(r1.status).toBe(200);
    expect(r1.body.verified).toBe(true);

    const { rows: rRows1 } = await db.query("SELECT face_photo FROM drivers WHERE id = $1", [dId]);
    expect(rRows1[0].face_photo).toContain(photo1);

    // Criar nova sessão para tentar segunda verificação com photo2
    const sess2Res = await db.query(
      "INSERT INTO fueling_sessions (driver_id, truck_id, station_id, status, requested_at) VALUES ($1, $2, $3, 'requested', NOW()) RETURNING id",
      [dId, tId, stationId]
    );
    const s2Id = sess2Res.rows[0].id;

    const r2 = await request(app)
      .post(`/api/fueling/sessions/${s2Id}/verify-face`)
      .set('Authorization', 'Bearer ' + tokenDriver)
      .send({ image_base64: photo2, lat: -23.55, lng: -46.63 });
    expect(r2.status).toBe(200);
    expect(r2.body.verified).toBe(true);

    // NÃO deve ter sobrescrito face_photo original (permanece photo1)
    const { rows: rRows2 } = await db.query("SELECT face_photo FROM drivers WHERE id = $1", [dId]);
    expect(rRows2[0].face_photo).toContain(photo1);
    expect(rRows2[0].face_photo).not.toContain(photo2);

    // Gestor usando enrollFace pode atualizar normalmente
    const rEnroll = await request(app)
      .post(`/api/drivers/${dId}/face/enroll`)
      .set('Authorization', 'Bearer ' + tokenManager)
      .send({ image_base64: photo3, consent: true });
    expect(rEnroll.status).toBe(200);

    const { rows: rRows3 } = await db.query("SELECT face_photo FROM drivers WHERE id = $1", [dId]);
    expect(rRows3[0].face_photo).toContain(photo3);
  });

  it('Substitui o placeholder 1x1 do simulador pela primeira foto real do app e preserva nas seguintes', async () => {
    const simulatorPlaceholder = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
    const realSelfie1 = Buffer.concat([Buffer.from([0xff, 0xd8]), Buffer.from('MATCH_REAL_SELFIE_ONE')]).toString('base64');
    const realSelfie2 = Buffer.concat([Buffer.from([0xff, 0xd8]), Buffer.from('MATCH_REAL_SELFIE_TWO')]).toString('base64');

    const drvRes = await db.query(
      "INSERT INTO drivers (name, is_active, face_enrolled, face_template_ref, face_photo) VALUES ('Driver Placeholder Test', true, true, 'mock_template_ph', $1) RETURNING id",
      [simulatorPlaceholder]
    );
    const dId = drvRes.rows[0].id;

    const trkRes = await db.query(
      "INSERT INTO trucks (plate, model, capacity_liters, current_level_liters, api_key, fuel_station_id, lat, lng) VALUES ('PHL1A01', 'Test', 200, 100, 'key_phl', $1, -23.55, -46.63) RETURNING id",
      [stationId]
    );
    const tId = trkRes.rows[0].id;

    const sess1 = await db.query(
      "INSERT INTO fueling_sessions (driver_id, truck_id, station_id, status, requested_at) VALUES ($1, $2, $3, 'requested', NOW()) RETURNING id",
      [dId, tId, stationId]
    );
    const tokenDriver = jwt.sign({ id: dId, role: 'driver', truck_id: tId }, process.env.JWT_SECRET);

    const r1 = await request(app)
      .post(`/api/fueling/sessions/${sess1.rows[0].id}/verify-face`)
      .set('Authorization', 'Bearer ' + tokenDriver)
      .send({ image_base64: realSelfie1, lat: -23.55, lng: -46.63 });
    expect(r1.status).toBe(200);
    expect(r1.body.verified).toBe(true);

    const { rows: after1 } = await db.query("SELECT face_photo FROM drivers WHERE id = $1", [dId]);
    expect(after1[0].face_photo).toBe(`data:image/jpeg;base64,${realSelfie1}`);

    const sess2 = await db.query(
      "INSERT INTO fueling_sessions (driver_id, truck_id, station_id, status, requested_at) VALUES ($1, $2, $3, 'requested', NOW()) RETURNING id",
      [dId, tId, stationId]
    );
    const r2 = await request(app)
      .post(`/api/fueling/sessions/${sess2.rows[0].id}/verify-face`)
      .set('Authorization', 'Bearer ' + tokenDriver)
      .send({ image_base64: realSelfie2, lat: -23.55, lng: -46.63 });
    expect(r2.status).toBe(200);

    const { rows: after2 } = await db.query("SELECT face_photo FROM drivers WHERE id = $1", [dId]);
    expect(after2[0].face_photo).toBe(`data:image/jpeg;base64,${realSelfie1}`);
  });
});

describe('BLOCO D4 — Face Photo Leak Checks', () => {
  let leakDriverId, leakTruckId;

  beforeAll(async () => {
    const drv = await db.query(
      "INSERT INTO drivers (name, email, password_hash, is_active, face_enrolled, face_photo) VALUES ('Leak Check Driver', 'leak_drv@test.com', $1, true, true, $2) RETURNING id",
      [await bcrypt.hash('SenhaForte123', 10), validJPEGBase64]
    );
    leakDriverId = drv.rows[0].id;

    const trk = await db.query(
      "INSERT INTO trucks (plate, model, capacity_liters, current_level_liters, api_key, fuel_station_id, lat, lng) VALUES ('LEA1K01', 'Volvo Leak', 500, 250, 'key_leak', $1, -23.55, -46.63) RETURNING id",
      [stationId]
    );
    leakTruckId = trk.rows[0].id;

    await db.query("INSERT INTO driver_trucks (driver_id, truck_id) VALUES ($1, $2)", [leakDriverId, leakTruckId]);
  });

  it('GET /api/fleet NÃO contém face_photo em nenhum lugar', async () => {
    const res = await request(app)
      .get('/api/fleet')
      .set('Authorization', 'Bearer ' + tokenManager);
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).not.toContain(validJPEGBase64);
    res.body.forEach(t => expect(t.face_photo).toBeUndefined());
  });

  it('GET /api/fleet/:id/telemetry NÃO contém face_photo', async () => {
    const res = await request(app)
      .get(`/api/fleet/${leakTruckId}/telemetry`)
      .set('Authorization', 'Bearer ' + tokenManager);
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).not.toContain(validJPEGBase64);
    expect(res.body.face_photo).toBeUndefined();
  });

  it('POST /api/auth/login com credenciais de motorista => 401 (sem fallback)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'leak_drv@test.com',
        password: 'SenhaForte123'
      });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid email or password');
    expect(res.body.token).toBeUndefined();
  });

  it('POST /api/auth/driver/login (motorista) responde 200 e NÃO contém face_photo no body', async () => {
    const res = await request(app)
      .post('/api/auth/driver/login')
      .send({
        email: 'leak_drv@test.com',
        password: 'SenhaForte123'
      });
    expect(res.status).toBe(200);
    expect(res.body.driver).toBeDefined();
    expect(res.body.driver.face_photo).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain(validJPEGBase64);
  });

  it('Sockets (fleetDataProvider.getFleetSnapshot e getTruckTelemetry) NÃO emitem face_photo', async () => {
    const snapshot = await fleetDataProvider.getFleetSnapshot();
    expect(JSON.stringify(snapshot)).not.toContain(validJPEGBase64);
    snapshot.forEach(t => expect(t.face_photo).toBeUndefined());

    const telem = await fleetDataProvider.getTruckTelemetry(leakTruckId);
    expect(JSON.stringify(telem)).not.toContain(validJPEGBase64);
    expect(telem.face_photo).toBeUndefined();
  });

  it('GET /api/drivers contém face_photo para gestor/admin/auditor', async () => {
    const rMgr = await request(app).get('/api/drivers').set('Authorization', 'Bearer ' + tokenManager);
    expect(rMgr.status).toBe(200);
    const dMgr = rMgr.body.find(d => d.id === leakDriverId);
    expect(dMgr.face_photo).toBe(validJPEGBase64);

    const rAdm = await request(app).get('/api/drivers').set('Authorization', 'Bearer ' + tokenAdmin);
    expect(rAdm.status).toBe(200);
    const dAdm = rAdm.body.find(d => d.id === leakDriverId);
    expect(dAdm.face_photo).toBe(validJPEGBase64);

    const rAud = await request(app).get('/api/drivers').set('Authorization', 'Bearer ' + tokenAuditor);
    expect(rAud.status).toBe(200);
    const dAud = rAud.body.find(d => d.id === leakDriverId);
    expect(dAud.face_photo).toBe(validJPEGBase64);
  });
});

describe('BLOCO D5 — Virtual Hardware Unit Tests', () => {
  it('Recusa de boot quando VIRTUAL_HARDWARE_ENABLED=true e NODE_ENV=production', () => {
    const prevNodeEnv = process.env.NODE_ENV;
    const prevVHE = process.env.VIRTUAL_HARDWARE_ENABLED;

    try {
      process.env.NODE_ENV = 'production';
      process.env.VIRTUAL_HARDWARE_ENABLED = 'true';
      expect(() => startVirtualHardware()).toThrow(/VIRTUAL_HARDWARE_ENABLED não pode ser ativado em ambiente de produção/);
    } finally {
      process.env.NODE_ENV = prevNodeEnv;
      process.env.VIRTUAL_HARDWARE_ENABLED = prevVHE;
    }
  });

  it('checkAndProcessSessions: authorized vira active; active vira completed com data_source=simulated e sem alterar trucks.status para ok', async () => {
    const drv = await db.query(
      "INSERT INTO drivers (name, is_active) VALUES ('Driver VHW', true) RETURNING id"
    );
    const dId = drv.rows[0].id;

    // Caminhão com status inicial 'low_fuel'
    const trk = await db.query(
      "INSERT INTO trucks (plate, model, capacity_liters, current_level_liters, status, sim_state, route_phase) VALUES ('VHW1A01', 'Truck VHW', 500, 50, 'low_fuel', 'idle', 'planned') RETURNING id"
    );
    const tId = trk.rows[0].id;

    // 1. Sessão authorized há mais de 3s
    const sessRes = await db.query(
      "INSERT INTO fueling_sessions (driver_id, truck_id, status, authorized_at, release_method) VALUES ($1, $2, 'authorized', NOW() - INTERVAL '5 seconds', 'facial') RETURNING id",
      [dId, tId]
    );
    const sId = sessRes.rows[0].id;

    await checkAndProcessSessions();

    const { rows: rSess1 } = await db.query("SELECT status, started_at FROM fueling_sessions WHERE id = $1", [sId]);
    expect(rSess1[0].status).toBe('active');
    expect(rSess1[0].started_at).not.toBeNull();

    // 2. Simula sessão em andamento há mais de 8s
    await db.query("UPDATE fueling_sessions SET started_at = NOW() - INTERVAL '10 seconds' WHERE id = $1", [sId]);

    await checkAndProcessSessions();

    const { rows: rSess2 } = await db.query("SELECT status, completed_at, data_source FROM fueling_sessions WHERE id = $1", [sId]);
    expect(rSess2[0].status).toBe('completed');
    expect(rSess2[0].completed_at).not.toBeNull();
    expect(rSess2[0].data_source).toBe('simulated');

    // Verifica fueling_logs gravado com data_source = 'simulated'
    const { rows: rLogs } = await db.query("SELECT data_source, volume_liters FROM fueling_logs WHERE session_id = $1", [sId]);
    expect(rLogs.length).toBe(1);
    expect(rLogs[0].data_source).toBe('simulated');
    expect(parseFloat(rLogs[0].volume_liters)).toBeGreaterThan(0);

    // Verifica que o status do caminhão NÃO foi sobrescrito para 'ok' (permaneceu 'low_fuel')
    const { rows: rTruck } = await db.query("SELECT status, sim_state, current_level_liters FROM trucks WHERE id = $1", [tId]);
    expect(rTruck[0].status).toBe('low_fuel');
    expect(rTruck[0].sim_state).toBe('idle');
    expect(parseFloat(rTruck[0].current_level_liters)).toBeGreaterThan(50);
  });
});
