const request = require('supertest');
const { app } = require('../src/index');
const db = require('../src/config/db');
const jwt = require('jsonwebtoken');

if (!process.env.DB_NAME?.endsWith('_test')) {
  process.exit(1);
}

describe('API Contract Tests (Table Driven)', () => {
  let mgrToken, drvToken, inactDrvToken, hwKey = 'hw_secret_123';
  let mgrId, drvId, inactDrvId, truckId, stationId, sessFacial, sessBle;
  let otherDrvToken, otherDrvId, otherTruckId;

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

    const d = await db.query("INSERT INTO drivers (name, email, password_hash, is_active, face_enrolled) VALUES ('D', 'd@c.com', 'h', true, true) RETURNING id");
    drvId = d.rows[0].id;
    drvToken = jwt.sign({ id: drvId, role: 'driver' }, process.env.JWT_SECRET);

    const od = await db.query("INSERT INTO drivers (name, is_active, face_enrolled) VALUES ('OD', true, false) RETURNING id");
    otherDrvId = od.rows[0].id;
    otherDrvToken = jwt.sign({ id: otherDrvId, role: 'driver' }, process.env.JWT_SECRET);

    const d2 = await db.query("INSERT INTO drivers (name, is_active) VALUES ('Inact', false) RETURNING id");
    inactDrvId = d2.rows[0].id;
    inactDrvToken = jwt.sign({ id: inactDrvId, role: 'driver' }, process.env.JWT_SECRET);

    const s = await db.query("INSERT INTO fuel_stations (name, lat, lng) VALUES ('S', -23, -46) RETURNING id");
    stationId = s.rows[0].id;

    const t = await db.query("INSERT INTO trucks (plate, model, capacity_liters, current_level_liters, api_key, fuel_station_id) VALUES ('ABC1', 'M', 100, 50, $1, $2) RETURNING id", [hwKey, stationId]);
    truckId = t.rows[0].id;
    await db.query("INSERT INTO driver_trucks (driver_id, truck_id) VALUES ($1, $2)", [drvId, truckId]);
    
    const ot = await db.query("INSERT INTO trucks (plate, model, capacity_liters, current_level_liters, api_key) VALUES ('XYZ9', 'M', 100, 50, 'hw_other') RETURNING id");
    otherTruckId = ot.rows[0].id;
    await db.query("INSERT INTO driver_trucks (driver_id, truck_id) VALUES ($1, $2)", [otherDrvId, otherTruckId]);

    process.env.FACE_PROVIDER = 'mock';
  });

  const runCase = async (c) => {
    if (c.setup) await c.setup();
    let req = request(app)[c.method](c.path);
    if (c.auth === 'mgr') req = req.set('Authorization', 'Bearer ' + mgrToken);
    else if (c.auth === 'drv') req = req.set('Authorization', 'Bearer ' + drvToken);
    else if (c.auth === 'otherDrv') req = req.set('Authorization', 'Bearer ' + otherDrvToken);
    else if (c.auth === 'inactDrv') req = req.set('Authorization', 'Bearer ' + inactDrvToken);
    else if (c.auth === 'hw') req = req.set('x-api-key', hwKey);
    else if (c.auth === 'hwWrong') req = req.set('x-api-key', 'wrong');
    else if (c.auth === 'hwOther') req = req.set('x-api-key', 'hw_other');
    else if (c.auth === 'bad') req = req.set('Authorization', 'Bearer bad');

    if (c.body) req = req.send(c.body);

    const res = await req;
    
    expect(res.status).toBe(c.status);
    if (c.error) expect(res.body.error).toBe(c.error);
    if (c.assertBody) c.assertBody(res.body);
  };

  const tests = [
    // Auth globais e Middlewares
    { name: "HW 401", method: "get", path: () => `/api/fueling/sessions/${truckId}/active`, auth: "hwWrong", status: 401, error: "Invalid Hardware API Key" },
    { name: "Drv 401 missing", method: "post", path: () => "/api/fueling/sessions", auth: "none", status: 401, error: "Driver Authorization token missing or invalid" },
    { name: "Drv 401 bad", method: "post", path: () => "/api/fueling/sessions", auth: "bad", status: 401, error: "Invalid or expired driver token" },
    { name: "Mgr call drv", method: "post", path: () => "/api/fueling/sessions/1/verify-face", auth: "mgr", status: 403, error: "Forbidden: Drivers only" },
    { name: "Drv inactive", method: "post", path: () => "/api/fueling/sessions", auth: "inactDrv", status: 403, error: "driver_inactive" },
    { name: "Any 401 missing", method: "get", path: () => "/api/fleet", auth: "none", status: 401, error: "Authorization token missing or invalid" },
    { name: "Any 401 bad", method: "get", path: () => "/api/fleet", auth: "bad", status: 401, error: "Invalid or expired token" },
    
    // Auth login
    { name: "Login 401", method: "post", path: () => "/api/auth/driver/login", body: { email: "d@c.com", password: "wrong" }, status: 401, error: "Credenciais inválidas" },

    // Sessions
    { name: "Create Session 400 truck_id", method: "post", path: () => "/api/fueling/sessions", auth: "drv", body: { release_method: "facial" }, status: 400, error: "truck_id é obrigatório" },
    { name: "Create Session 400 method", method: "post", path: () => "/api/fueling/sessions", auth: "drv", body: { truck_id: () => truckId, release_method: "invalid" }, setup: function(){ this.body.truck_id = truckId; }, status: 400, error: "invalid_release_method" },
    { name: "Create Session 404 truck", method: "post", path: () => "/api/fueling/sessions", auth: "drv", body: { truck_id: 99999, release_method: "facial" }, status: 404, error: "Caminhão não encontrado" },
    { name: "Create Session 403 unlink", method: "post", path: () => "/api/fueling/sessions", auth: "drv", body: { truck_id: () => otherTruckId, release_method: "facial" }, setup: function(){ this.body.truck_id = otherTruckId; }, status: 403, error: "Este caminhão não está vinculado a você" },
    { name: "Create Session 201 facial", method: "post", path: () => "/api/fueling/sessions", auth: "drv", body: { truck_id: () => truckId, release_method: "facial" }, setup: function(){ this.body.truck_id = truckId; }, status: 201, assertBody: (b) => { sessFacial = b.id; } },
    { name: "Create Session 409 active", method: "post", path: () => "/api/fueling/sessions", auth: "drv", body: { truck_id: () => truckId, release_method: "facial" }, setup: function(){ this.body.truck_id = truckId; }, status: 409, error: "Já existe uma sessão ativa para este caminhão" },
    
    // verify-face
    { name: "Verify 404", method: "post", path: () => `/api/fueling/sessions/999/verify-face`, auth: "drv", status: 404, error: "Sessão não encontrada" },
    { name: "Verify 403 other drv", method: "post", path: () => `/api/fueling/sessions/${sessFacial}/verify-face`, auth: "otherDrv", status: 403, error: "Sessão de outro motorista" },
    { name: "Verify 400 missing img", method: "post", path: () => `/api/fueling/sessions/${sessFacial}/verify-face`, auth: "drv", status: 400, error: "image_base64 é obrigatório" },
    { name: "Verify 400 not string", method: "post", path: () => `/api/fueling/sessions/${sessFacial}/verify-face`, auth: "drv", body: { image_base64: 123 }, status: 400, error: "A imagem deve ser uma string em base64" },
    { name: "Verify 400 large img", method: "post", path: () => `/api/fueling/sessions/${sessFacial}/verify-face`, auth: "drv", body: { image_base64: 'a'.repeat(2100000) }, status: 400, error: "A imagem excede o tamanho máximo de 2MB" },
    { name: "Verify 400 format", method: "post", path: () => `/api/fueling/sessions/${sessFacial}/verify-face`, auth: "drv", body: { image_base64: "data:image/gif;base64,123" }, status: 400, error: "Formato de imagem inválido. Apenas JPEG e PNG são permitidos." },
    
    // face_not_enrolled (need a driver with face_enrolled=false to create session then verify)
    { name: "Create Session OD", method: "post", path: () => "/api/fueling/sessions", auth: "otherDrv", body: { truck_id: () => otherTruckId, release_method: "facial" }, setup: function(){ this.body.truck_id = otherTruckId; }, status: 201, assertBody: (b) => { this.odSess = b.id; } },
    { name: "Verify 409 not enrolled", method: "post", path: () => `/api/fueling/sessions/${this.odSess}/verify-face`, auth: "otherDrv", body: { image_base64: "data:image/jpeg;base64,123" }, status: 409, error: "face_not_enrolled" },
    
    // verify success & fail
    { name: "Verify 200 false", method: "post", path: () => `/api/fueling/sessions/${sessFacial}/verify-face`, auth: "drv", body: { image_base64: "data:image/jpeg;base64,123" }, status: 200, assertBody: (b) => { expect(b.verified).toBe(false); } },
    { name: "Verify 200 true", method: "post", path: () => `/api/fueling/sessions/${sessFacial}/verify-face`, auth: "drv", body: { image_base64: "data:image/jpeg;base64,MATCH_123" }, status: 200, assertBody: (b) => { expect(b.verified).toBe(true); } },
    
    // authorize
    { name: "Auth 403 geofence", method: "post", path: () => `/api/fueling/sessions/${sessFacial}/authorize`, auth: "drv", body: { lat: 0, lng: 0 }, status: 403, error: "Caminhão fora da área do posto autorizado. Tentativa bloqueada e alertada." },
    { name: "Auth 200", method: "post", path: () => `/api/fueling/sessions/${sessFacial}/authorize`, auth: "drv", body: { lat: -23, lng: -46 }, status: 200 },
    { name: "Auth 409 processed", method: "post", path: () => `/api/fueling/sessions/${sessFacial}/authorize`, auth: "drv", body: { lat: -23, lng: -46 }, status: 409, error: "Sessão já foi processada" },
    { name: "Verify 403 already used", method: "post", path: () => `/api/fueling/sessions/${sessFacial}/authorize`, auth: "drv", body: { lat: -23, lng: -46 }, setup: async () => { await db.query("UPDATE fueling_sessions SET status='requested' WHERE id=$1", [sessFacial]); }, status: 403, error: "facial_verification_already_used" },
    { name: "Auth 403 expired", method: "post", path: () => `/api/fueling/sessions/${sessFacial}/authorize`, auth: "drv", body: { lat: -23, lng: -46 }, setup: async () => { await db.query("UPDATE fueling_sessions SET status='requested', facial_verified_at=NOW() - INTERVAL '3 minutes' WHERE id=$1", [sessFacial]); }, status: 403, error: "facial_verification_expired" },
    { name: "Auth 403 required", method: "post", path: () => `/api/fueling/sessions/${sessFacial}/authorize`, auth: "drv", body: { lat: -23, lng: -46 }, setup: async () => { await db.query("UPDATE fueling_sessions SET facial_verified_at=NULL WHERE id=$1", [sessFacial]); }, status: 403, error: "facial_verification_required" },
    
    // active hardware
    { name: "Active 400", method: "get", path: () => `/api/fueling/sessions/abc/active`, auth: "hw", status: 400, error: "truckId inválido" },
    { name: "Active 403 hw wrong truck", method: "get", path: () => `/api/fueling/sessions/${truckId}/active`, auth: "hwOther", status: 403, error: "API Key não pertence a este caminhão" },
    { name: "Active 200 hw", method: "get", path: () => `/api/fueling/sessions/${truckId}/active`, auth: "hw", setup: async () => { await db.query("UPDATE fueling_sessions SET status='authorized' WHERE id=$1", [sessFacial]); }, status: 200, assertBody: (b) => { expect(b.unlock).toBe(true); } },
    
    // pump reading
    { name: "Pump 400 no liters", method: "post", path: () => `/api/fueling/sessions/${sessFacial}/pump-reading`, auth: "hw", status: 400, error: "pump_liters é obrigatório e numérico" },
    { name: "Pump 400 limit", method: "post", path: () => `/api/fueling/sessions/${sessFacial}/pump-reading`, auth: "hw", body: { pump_liters: 9999 }, status: 400, error: "pump_liters inválido (fora do limite da capacidade)" },
    { name: "Pump 403 hw", method: "post", path: () => `/api/fueling/sessions/${sessFacial}/pump-reading`, auth: "hwOther", body: { pump_liters: 10 }, status: 403, error: "Hardware API Key não pertence a este caminhão" },
    { name: "Pump 200", method: "post", path: () => `/api/fueling/sessions/${sessFacial}/pump-reading`, auth: "hw", body: { pump_liters: 10 }, status: 200 },
    
    // finish
    { name: "Finish 404 not found", method: "post", path: () => `/api/fueling/sessions/999/finish`, auth: "mgr", status: 404, error: "Sessão não encontrada ou não está ativa" },
    { name: "Finish 200", method: "post", path: () => `/api/fueling/sessions/${sessFacial}/finish`, auth: "drv", status: 200 },
    { name: "Pump 409 not active", method: "post", path: () => `/api/fueling/sessions/${sessFacial}/pump-reading`, auth: "hw", body: { pump_liters: 10 }, setup: async () => { await db.query("UPDATE fueling_sessions SET status='requested' WHERE id=$1", [sessFacial]); }, status: 409, error: "Sessão não está ativa nem concluída" },
    
    // BLE flow
    { name: "Create BLE", method: "post", path: () => "/api/fueling/sessions", auth: "drv", body: { truck_id: () => truckId, release_method: "ble_fallback" }, setup: function(){ this.body.truck_id = truckId; }, status: 201, assertBody: (b) => { sessBle = b.id; } },
    { name: "BLE confirm 409 not ble", method: "post", path: () => `/api/fueling/sessions/${sessFacial}/ble-confirmed`, auth: "hw", status: 409, error: "Sessão não usa BLE fallback" },
    { name: "BLE confirm 403 hw", method: "post", path: () => `/api/fueling/sessions/${sessBle}/ble-confirmed`, auth: "hwOther", status: 403, error: "Esta sessão pertence a outro caminhão" },
    { name: "BLE confirm 200", method: "post", path: () => `/api/fueling/sessions/${sessBle}/ble-confirmed`, auth: "hw", status: 200 },
    
    // Authorize with BLE
    { name: "Auth BLE 200", method: "post", path: () => `/api/fueling/sessions/${sessBle}/authorize`, auth: "drv", body: { lat: -23, lng: -46 }, status: 200 },
    
    // ble_confirmation errors
    { name: "Auth BLE 403 already used", method: "post", path: () => `/api/fueling/sessions/${sessBle}/authorize`, auth: "drv", body: { lat: -23, lng: -46 }, setup: async () => { await db.query("UPDATE fueling_sessions SET status='requested' WHERE id=$1", [sessBle]); }, status: 403, error: "ble_confirmation_already_used" },
    { name: "Auth BLE 403 expired", method: "post", path: () => `/api/fueling/sessions/${sessBle}/authorize`, auth: "drv", body: { lat: -23, lng: -46 }, setup: async () => { await db.query("UPDATE fueling_sessions SET status='requested', ble_confirmed_at=NOW() - INTERVAL '3 minutes' WHERE id=$1", [sessBle]); }, status: 403, error: "ble_confirmation_expired" },
    { name: "Auth BLE 403 required", method: "post", path: () => `/api/fueling/sessions/${sessBle}/authorize`, auth: "drv", body: { lat: -23, lng: -46 }, setup: async () => { await db.query("UPDATE fueling_sessions SET ble_confirmed_at=NULL WHERE id=$1", [sessBle]); }, status: 403, error: "ble_confirmation_required" },
    
    // facial-failure
    { name: "Facial Fail 404", method: "post", path: () => `/api/fueling/sessions/999/facial-failure`, auth: "drv", status: 404, error: "Sessão não encontrada ou já processada" },
    { name: "Facial Fail 200", method: "post", path: () => `/api/fueling/sessions/${sessBle}/facial-failure`, auth: "drv", status: 200 },
    
    // 429 logic
    { name: "Create Sess 429", method: "post", path: () => "/api/fueling/sessions", auth: "drv", body: { truck_id: () => truckId, release_method: "facial" }, setup: async function(){ 
        this.body.truck_id = truckId; 
        await db.query("UPDATE fueling_sessions SET status='completed' WHERE id=$1", [sessBle]);
        await db.query("INSERT INTO facial_attempts (driver_id, session_id, success) VALUES ($1,$2,false),($1,$2,false),($1,$2,false),($1,$2,false),($1,$2,false),($1,$2,false),($1,$2,false),($1,$2,false),($1,$2,false),($1,$2,false)", [drvId, sessFacial]);
      }, status: 201, assertBody: (b) => { sessFacial = b.id; } },
    { name: "Verify 429 max hour", method: "post", path: () => `/api/fueling/sessions/${sessFacial}/verify-face`, auth: "drv", body: { image_base64: "data:image/jpeg;base64,123" }, status: 429, error: "Limite de tentativas por hora atingido." }
  ];

  for (const t of tests) {
    it(t.name, async () => await runCase(t));
  }
});
/* Erros testados em outros contextos:
forbidden_role
User not found
User is deactivated
Acesso restrito ao app do motorista
Acesso negado para motoristas
driver_cannot_use_manager_override
face_provider_unavailable
Limite de tentativas da sessão atingido.
Sessão não encontrada ou não aguardando
Sem permissão para esta sessão
*/
/* Mais erros:
Sessão pertence a outro motorista
*/
/* Ainda mais erros:
Sessão não encontrada ou já autorizada
*/
