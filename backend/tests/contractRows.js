const request = require('supertest');
const { app } = require('../src/index');

module.exports = [
  // Globais
  { name: "HW 401", method: "get", path: (ids) => `/api/fueling/sessions/${ids.truckId}/active`, auth: "hwWrong", status: 401, error: "Invalid Hardware API Key" },
  { name: "Drv 401 missing", method: "post", path: () => "/api/fueling/sessions", auth: "none", status: 401, error: "Authorization token missing or invalid" },
  { name: "Drv 401 bad", method: "post", path: () => "/api/fueling/sessions", auth: "bad", status: 401, error: "Invalid or expired token" },
  { name: "Mgr call drv", method: "post", path: () => `/api/fueling/sessions/99999/verify-face`, auth: "mgr", status: 403, error: "Acesso restrito ao app do motorista" },
  { name: "Drv inactive", method: "post", path: () => "/api/fueling/sessions", auth: "inactDrv", status: 403, error: "driver_inactive" },
  { name: "Drv call mgr", method: "get", path: () => "/api/fueling/sessions/pending-emergency", auth: "drv", status: 403, error: "Acesso negado para motoristas" },
  { name: "Auditor forbidden_role", method: "post", path: () => "/api/fueling/sessions", auth: "auditor", status: 403, error: "forbidden_role" },
  { name: "User not found", method: "post", path: () => "/api/fueling/sessions", auth: "deletedUserMgr", status: 401, error: "User not found" },
  { name: "User deactivated", method: "post", path: () => "/api/fueling/sessions", auth: "deactMgr", status: 401, error: "User is deactivated" },

  // Login
  { name: "Login 401", method: "post", path: () => "/api/auth/driver/login", body: () => ({ email: "d@c.com", password: "wrong" }), status: 401, error: "Credenciais inválidas" },
  
  // Validation id
  { name: "Sessions id invalido", method: "post", path: () => "/api/fueling/sessions/abc/finish", auth: "mgr", status: 400, error: "id inválido" },
  { name: "Sessions truckId invalido", method: "get", path: () => "/api/fueling/sessions/abc/active", auth: "hw", status: 400, error: "truckId inválido" },

  // Create Session
  { name: "Create Session 400 truck_id", method: "post", path: () => "/api/fueling/sessions", auth: "drv", body: () => ({ release_method: "facial" }), status: 400, error: "truck_id é obrigatório" },
  { name: "Create Session 400 method", method: "post", path: () => "/api/fueling/sessions", auth: "drv", body: (ids) => ({ truck_id: ids.truckId, release_method: "invalid" }), status: 400, error: "invalid_release_method" },
  { name: "Create Session 404 truck", method: "post", path: () => "/api/fueling/sessions", auth: "drv", body: () => ({ truck_id: 99999, release_method: "facial" }), status: 404, error: "Caminhão não encontrado" },
  { name: "Create Session 403 unlink", method: "post", path: () => "/api/fueling/sessions", auth: "drv", body: (ids) => ({ truck_id: ids.otherTruckId, release_method: "facial" }), status: 403, error: "Este caminhão não está vinculado a você" },
  
  { name: "Create Session 201 facial", setup: async (ids) => await ids.newSession(ids.truckId), method: "post", path: () => "/api/fueling/sessions", auth: "drv", body: (ids) => ({ truck_id: ids.truckId, release_method: "facial" }), status: 201, assertBody: (b, ids) => { ids.sessFacial = b.id; } },
  { name: "Create Session 409 active", method: "post", path: () => "/api/fueling/sessions", auth: "drv", body: (ids) => ({ truck_id: ids.truckId, release_method: "facial" }), status: 409, error: "Já existe uma sessão ativa para este caminhão" },
  
  // verify-face (Image validation runs FIRST)
  { name: "Verify 400 missing img", method: "post", path: (ids) => `/api/fueling/sessions/${ids.sessFacial}/verify-face`, auth: "drv", body: () => ({}), status: 400, error: "image_base64 é obrigatório" },
  { name: "Verify 400 not string", method: "post", path: (ids) => `/api/fueling/sessions/${ids.sessFacial}/verify-face`, auth: "drv", body: () => ({ image_base64: 123 }), status: 400, error: "A imagem deve ser uma string em base64" },
  { name: "Verify 400 format", method: "post", path: (ids) => `/api/fueling/sessions/${ids.sessFacial}/verify-face`, auth: "drv", body: () => ({ image_base64: "data:image/jpeg;base64,123" }), status: 400, error: "Formato de imagem inválido. Apenas JPEG e PNG são permitidos." },
  { name: "Verify 400 large img", method: "post", path: (ids) => `/api/fueling/sessions/${ids.sessFacial}/verify-face`, auth: "drv", body: (ids) => ({ image_base64: Buffer.concat([Buffer.from('ffd8ffe0', 'hex'), Buffer.alloc(2.2 * 1024 * 1024)]).toString('base64') }), status: 400, error: "A imagem excede o tamanho máximo de 2MB" },

  // verify-face (business logic)
  { name: "Verify 404", method: "post", path: () => `/api/fueling/sessions/99999/verify-face`, auth: "drv", body: (ids) => ({ image_base64: ids.validBase64 }), status: 404, error: "Sessão não encontrada" },
  { name: "Verify 403 other drv", method: "post", path: (ids) => `/api/fueling/sessions/${ids.sessFacial}/verify-face`, auth: "otherDrv", body: (ids) => ({ image_base64: ids.validBase64 }), status: 403, error: "Sessão de outro motorista" },
  
  { name: "Create Session OD", setup: async (ids) => await ids.newSession(ids.otherTruckId), method: "post", path: () => "/api/fueling/sessions", auth: "otherDrv", body: (ids) => ({ truck_id: ids.otherTruckId, release_method: "facial" }), status: 201, assertBody: (b, ids) => { ids.odSess = b.id; } },
  { name: "Verify 409 not enrolled", method: "post", path: (ids) => `/api/fueling/sessions/${ids.odSess}/verify-face`, auth: "otherDrv", body: (ids) => ({ image_base64: ids.validBase64 }), status: 409, error: "face_not_enrolled" },
  
  // verify success & fail
  { name: "Verify 200 false", method: "post", path: (ids) => `/api/fueling/sessions/${ids.sessFacial}/verify-face`, auth: "drv", body: (ids) => ({ image_base64: ids.validBase64Fail }), status: 200, assertBody: (b) => { expect(b.verified).toBe(false); } },
  { name: "Verify 200 true", method: "post", path: (ids) => `/api/fueling/sessions/${ids.sessFacial}/verify-face`, auth: "drv", body: (ids) => ({ image_base64: ids.validBase64 }), status: 200, assertBody: (b) => { expect(b.verified).toBe(true); } },
  
  // authorize
  { name: "Auth 403 other drv", method: "post", path: (ids) => `/api/fueling/sessions/${ids.sessFacial}/authorize`, auth: "otherDrv", body: () => ({ lat: -23, lng: -46 }), status: 403, error: "Sessão pertence a outro motorista" },
  { name: "Auth 403 mgr override", setup: async (ids) => { await ids.newSession(ids.truckId); ids.mgrSess = (await request(app).post('/api/fueling/sessions').set('Authorization', 'Bearer ' + ids.mgrToken).send({ truck_id: ids.truckId, release_method: 'manager_override' })).body.id; }, method: "post", path: (ids) => `/api/fueling/sessions/${ids.mgrSess}/authorize`, auth: "drv", body: () => ({ lat: -23, lng: -46 }), status: 403, error: "driver_cannot_use_manager_override" },
  { name: "Auth 403 geofence", setup: async (ids) => { await ids.newSession(ids.truckId); ids.sessFacial = (await ids.createSess(ids.truckId, "facial")).id; await request(app).post(`/api/fueling/sessions/${ids.sessFacial}/verify-face`).set('Authorization', 'Bearer ' + ids.drvToken).send({ image_base64: ids.validBase64 }); }, method: "post", path: (ids) => `/api/fueling/sessions/${ids.sessFacial}/authorize`, auth: "drv", body: () => ({ lat: 10, lng: 10 }), status: 403, error: "Caminhão fora da área do posto autorizado. Tentativa bloqueada e alertada." },
  { name: "Auth 404 not found", method: "post", path: () => `/api/fueling/sessions/99999/authorize`, auth: "drv", body: () => ({ lat: -23, lng: -46 }), status: 404, error: "Sessão não encontrada ou já autorizada" },
  { name: "Auth 200", setup: async (ids) => { await ids.newSession(ids.truckId); ids.sessFacial = (await ids.createSess(ids.truckId, "facial")).id; await request(app).post(`/api/fueling/sessions/${ids.sessFacial}/verify-face`).set('Authorization', 'Bearer ' + ids.drvToken).send({ image_base64: ids.validBase64 }); }, method: "post", path: (ids) => `/api/fueling/sessions/${ids.sessFacial}/authorize`, auth: "drv", body: () => ({ lat: -23, lng: -46 }), status: 200 },
  { name: "Auth 409 processed", method: "post", path: (ids) => `/api/fueling/sessions/${ids.sessFacial}/authorize`, auth: "drv", body: () => ({ lat: -23, lng: -46 }), status: 409, error: "Sessão já foi processada" },
  
  { name: "Auth 403 already used", setup: async (ids) => { await ids.newSession(ids.truckId); ids.sessFacial = (await ids.createSess(ids.truckId, "facial")).id; await ids.db.query("UPDATE fueling_sessions SET status='requested', facial_verified_at=NOW(), facial_consumed_at=NOW() WHERE id=$1", [ids.sessFacial]); }, method: "post", path: (ids) => `/api/fueling/sessions/${ids.sessFacial}/authorize`, auth: "drv", body: () => ({ lat: -23, lng: -46 }), status: 403, error: "facial_verification_already_used" },
  { name: "Auth 403 expired", setup: async (ids) => { await ids.db.query("UPDATE fueling_sessions SET status='requested', facial_verified_at=NOW() - INTERVAL '3 minutes', facial_consumed_at=NULL WHERE id=$1", [ids.sessFacial]); }, method: "post", path: (ids) => `/api/fueling/sessions/${ids.sessFacial}/authorize`, auth: "drv", body: () => ({ lat: -23, lng: -46 }), status: 403, error: "facial_verification_expired" },
  { name: "Auth 403 required", setup: async (ids) => { await ids.db.query("UPDATE fueling_sessions SET status='requested', facial_verified_at=NULL, facial_consumed_at=NULL WHERE id=$1", [ids.sessFacial]); }, method: "post", path: (ids) => `/api/fueling/sessions/${ids.sessFacial}/authorize`, auth: "drv", body: () => ({ lat: -23, lng: -46 }), status: 403, error: "facial_verification_required" },
  
  // active hardware
  { name: "Active 403 hw wrong truck", method: "get", path: (ids) => `/api/fueling/sessions/${ids.truckId}/active`, auth: "hwOther", status: 403, error: "API Key não pertence a este caminhão" },
  { name: "Active 403 not assigned", method: "get", path: (ids) => `/api/fueling/sessions/${ids.truckId}/active`, auth: "drv", setup: async (ids) => { await ids.db.query("DELETE FROM driver_trucks"); }, status: 403, error: "Este caminhão não está vinculado a você" },
  { name: "Active 200 hw", method: "get", path: (ids) => `/api/fueling/sessions/${ids.truckId}/active`, auth: "hw", setup: async (ids) => { await ids.db.query("INSERT INTO driver_trucks (driver_id, truck_id) VALUES ($1, $2)", [ids.drvId, ids.truckId]); await ids.db.query("UPDATE fueling_sessions SET status='authorized' WHERE id=$1", [ids.sessFacial]); }, status: 200, assertBody: (b) => { expect(b.unlock).toBe(true); } },
  
  // pump reading
  { name: "Pump 400 no liters", setup: async (ids) => { await ids.newSession(ids.truckId); ids.sessFacial = (await ids.createSess(ids.truckId, "facial")).id; await ids.db.query("UPDATE fueling_sessions SET status='active' WHERE id=$1", [ids.sessFacial]); }, method: "post", path: (ids) => `/api/fueling/sessions/${ids.sessFacial}/pump-reading`, auth: "hw", body: () => ({}), status: 400, error: "pump_liters é obrigatório e numérico" },
  { name: "Pump 400 limit", method: "post", path: (ids) => `/api/fueling/sessions/${ids.sessFacial}/pump-reading`, auth: "hw", body: () => ({ pump_liters: 9999 }), status: 400, error: "pump_liters inválido (fora do limite da capacidade)" },
  { name: "Pump 403 hw", method: "post", path: (ids) => `/api/fueling/sessions/${ids.sessFacial}/pump-reading`, auth: "hwOther", body: () => ({ pump_liters: 10 }), status: 403, error: "Hardware API Key não pertence a este caminhão" },
  { name: "Pump 200", method: "post", path: (ids) => `/api/fueling/sessions/${ids.sessFacial}/pump-reading`, auth: "hw", body: () => ({ pump_liters: 10 }), status: 200, assertBody: (b) => { expect(b.success).toBe(true); expect(b.pump_liters).toBe(10); } },
  
  // finish
  { name: "Finish 404 not found", method: "post", path: () => `/api/fueling/sessions/99999/finish`, auth: "mgr", status: 404, error: "Sessão não encontrada ou não está ativa" },
  { name: "Finish 403 perm", method: "post", path: (ids) => `/api/fueling/sessions/${ids.sessFacial}/finish`, auth: "otherDrv", status: 403, error: "Sem permissão para esta sessão" },
  { name: "Finish 200", method: "post", path: (ids) => `/api/fueling/sessions/${ids.sessFacial}/finish`, auth: "drv", status: 200 },
  { name: "Pump 409 not active", setup: async (ids) => { await ids.db.query("UPDATE fueling_sessions SET status='requested' WHERE id=$1", [ids.sessFacial]); }, method: "post", path: (ids) => `/api/fueling/sessions/${ids.sessFacial}/pump-reading`, auth: "hw", body: () => ({ pump_liters: 10 }), status: 409, error: "Sessão não está ativa nem concluída" },
  
  // BLE flow
  { name: "Create BLE", method: "post", path: () => "/api/fueling/sessions", auth: "drv", setup: async (ids) => await ids.newSession(ids.truckId), body: (ids) => ({ truck_id: ids.truckId, release_method: "ble_fallback" }), status: 201, assertBody: (b, ids) => { ids.sessBle = b.id; } },
  { name: "BLE confirm 409 not ble", setup: async (ids) => { await ids.db.query("UPDATE fueling_sessions SET status='requested' WHERE id=$1", [ids.sessFacial]); }, method: "post", path: (ids) => `/api/fueling/sessions/${ids.sessFacial}/ble-confirmed`, auth: "hw", status: 409, error: "Sessão não usa BLE fallback" },
  { name: "BLE confirm 403 hw", method: "post", path: (ids) => `/api/fueling/sessions/${ids.sessBle}/ble-confirmed`, auth: "hwOther", status: 403, error: "Esta sessão pertence a outro caminhão" },
  { name: "BLE confirm 409 wait", method: "post", path: (ids) => `/api/fueling/sessions/${ids.sessBle}/ble-confirmed`, auth: "hw", setup: async (ids) => { await ids.db.query("UPDATE fueling_sessions SET status='completed' WHERE id=$1", [ids.sessBle]); }, status: 409, error: "Sessão não encontrada ou não aguardando" },
  { name: "BLE confirm 200", method: "post", path: (ids) => `/api/fueling/sessions/${ids.sessBle}/ble-confirmed`, auth: "hw", setup: async (ids) => { await ids.db.query("UPDATE fueling_sessions SET status='requested' WHERE id=$1", [ids.sessBle]); }, status: 200 },
  
  // Authorize with BLE
  { name: "Auth BLE 200", method: "post", path: (ids) => `/api/fueling/sessions/${ids.sessBle}/authorize`, auth: "drv", body: () => ({ lat: -23, lng: -46 }), status: 200 },
  
  // ble_confirmation errors
  { name: "Auth BLE 403 already used", method: "post", path: (ids) => `/api/fueling/sessions/${ids.sessBle}/authorize`, auth: "drv", body: () => ({ lat: -23, lng: -46 }), setup: async (ids) => { await ids.newSession(ids.truckId); ids.sessBle = (await ids.createSess(ids.truckId, "ble_fallback")).id; await ids.db.query("UPDATE fueling_sessions SET status='requested', ble_confirmed_at=NOW(), ble_consumed_at=NOW() WHERE id=$1", [ids.sessBle]); }, status: 403, error: "ble_confirmation_already_used" },
  { name: "Auth BLE 403 expired", method: "post", path: (ids) => `/api/fueling/sessions/${ids.sessBle}/authorize`, auth: "drv", body: () => ({ lat: -23, lng: -46 }), setup: async (ids) => { await ids.db.query("UPDATE fueling_sessions SET status='requested', ble_confirmed_at=NOW() - INTERVAL '3 minutes', ble_consumed_at=NULL WHERE id=$1", [ids.sessBle]); }, status: 403, error: "ble_confirmation_expired" },
  { name: "Auth BLE 403 required", method: "post", path: (ids) => `/api/fueling/sessions/${ids.sessBle}/authorize`, auth: "drv", body: () => ({ lat: -23, lng: -46 }), setup: async (ids) => { await ids.db.query("UPDATE fueling_sessions SET ble_confirmed_at=NULL, ble_consumed_at=NULL WHERE id=$1", [ids.sessBle]); }, status: 403, error: "ble_confirmation_required" },
  
  // facial-failure
  { name: "Facial Fail 404", method: "post", path: () => `/api/fueling/sessions/99999/facial-failure`, auth: "drv", status: 404, error: "Sessão não encontrada ou já processada" },
  { name: "Facial Fail 200", method: "post", path: (ids) => `/api/fueling/sessions/${ids.sessFacial}/facial-failure`, auth: "drv", setup: async (ids) => { await ids.newSession(ids.truckId); ids.sessFacial = (await ids.createSess(ids.truckId, "facial")).id; }, status: 200 },
  
  // 429 logic
  { name: "Verify 429 max limit", method: "post", path: (ids) => `/api/fueling/sessions/${ids.sessFacial}/verify-face`, auth: "drv", body: (ids) => ({ image_base64: ids.validBase64 }), setup: async (ids) => { 
      await ids.db.query("DELETE FROM facial_attempts WHERE driver_id=$1", [ids.drvId]);
      await ids.db.query("INSERT INTO facial_attempts (driver_id, session_id, success) VALUES ($1,$2,false),($1,$2,false),($1,$2,false)", [ids.drvId, ids.sessFacial]);
    }, status: 429, error: "Limite de tentativas da sessão atingido." },
    
  // Hourly limit
  { name: "Verify 429 max hour", method: "post", path: (ids) => `/api/fueling/sessions/${ids.sessFacial}/verify-face`, auth: "drv", body: (ids) => ({ image_base64: ids.validBase64 }), setup: async (ids) => { 
      await ids.db.query("DELETE FROM facial_attempts WHERE driver_id=$1", [ids.drvId]);
      const prevSess = ids.sessFacial;
      await ids.newSession(ids.truckId);
      ids.sessFacial = (await ids.createSess(ids.truckId, "facial")).id;
      let values = [];
      for(let i=0; i<10; i++) values.push(`(${ids.drvId}, ${prevSess}, false)`);
      await ids.db.query(`INSERT INTO facial_attempts (driver_id, session_id, success) VALUES ${values.join(',')}`);
    }, status: 429, error: "Limite de tentativas por hora atingido." },

  // Provider Unavailable
  { name: "Verify 503 provider error", method: "post", path: (ids) => `/api/fueling/sessions/${ids.sessFacial}/verify-face`, auth: "drv", body: (ids) => ({ image_base64: ids.validBase64Fail }), setup: async (ids) => { 
      await ids.newSession(ids.truckId);
      ids.sessFacial = (await ids.createSess(ids.truckId, "facial")).id;
      await ids.db.query("DELETE FROM facial_attempts WHERE driver_id=$1", [ids.drvId]);
      const faceProvider = require('../src/services/faceProvider/mockProvider');
      ids.providerSpy = jest.spyOn(faceProvider, 'verify').mockRejectedValue(new Error('unavailable'));
    }, status: 503, error: "face_provider_unavailable" }
];
