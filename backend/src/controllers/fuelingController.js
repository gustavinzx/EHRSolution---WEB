"use strict";
const db = require("../config/db");
const faceProvider = require("../services/faceProvider");
const { buildReturnRoute } = require("../services/returnRoute");
const security = require("../services/securityService");

const FACIAL_MAX_ATTEMPTS = parseInt(process.env.FACIAL_MAX_ATTEMPTS || "3", 10);
const GEOFENCE_KM = parseFloat(process.env.GEOFENCE_KM || "0.2"); // 200 m
const SESSION_TTL_MIN = 30;

// ─── Helpers ────────────────────────────────────────────────────────────────
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function expireStaleSessions(truckId) {
  const params = [];
  let where = "status IN ('requested','authorized','active') AND expires_at IS NOT NULL AND expires_at < NOW()";
  if (truckId) { where += " AND truck_id = $1"; params.push(truckId); }
  await db.query(`UPDATE fueling_sessions SET status='expired' WHERE ${where}`, params);
}

async function driverOwnsTruck(driverId, truckId) {
  const { rows } = await db.query(
    "SELECT 1 FROM driver_trucks WHERE driver_id=$1 AND truck_id=$2 LIMIT 1",
    [driverId, truckId]
  );
  return rows.length > 0;
}

async function loadSession(id) {
  const { rows } = await db.query(
    `SELECT s.*, t.plate, t.model, d.name AS driver_name, fs.name AS station_name
       FROM fueling_sessions s
       JOIN trucks t ON t.id = s.truck_id
       LEFT JOIN drivers d ON d.id = s.driver_id
       LEFT JOIN fuel_stations fs ON fs.id = s.station_id
      WHERE s.id = $1`,
    [id]
  );
  return rows[0] || null;
}

function emitSession(req, session, event = "fuelingSessionUpdate") {
  if (req.io && session) req.io.emit(event, session);
}

// Garante que o ator só mexe em sessões que lhe pertencem.
function canTouchSession(req, session) {
  if (!req.actor) return false;
  if (req.actor.type === "manager") return true;
  if (req.actor.type === "driver") return session.driver_id === req.actor.id;
  if (req.actor.type === "hardware") return session.truck_id === req.actor.id;
  return false;
}

async function authorizeAndUnlock(sessionId, releaseMethod, extraMeta = {}, actorType = null) {
  if (releaseMethod === 'manager_override' && actorType !== 'manager') return null;
  const { rows } = await db.query(
    `UPDATE fueling_sessions
        SET status='authorized', authorized_at=NOW(), release_method=$2,
            facial_consumed_at = CASE WHEN $4 = 'facial' THEN NOW() ELSE facial_consumed_at END,
            ble_consumed_at = CASE WHEN $4 = 'ble_fallback' THEN NOW() ELSE ble_consumed_at END,
            expires_at = NOW() + INTERVAL '${SESSION_TTL_MIN} minutes',
            metadata = COALESCE(metadata,'{}'::jsonb) || $3::jsonb
      WHERE id=$1 AND status IN ('requested') RETURNING *`,
    [sessionId, releaseMethod, JSON.stringify(extraMeta), releaseMethod]
  );
  if (!rows[0]) return null;
  await db.query(
    "UPDATE trucks SET route_phase='fueling', sim_state='fueling', fueling_ticks=0 WHERE id=$1",
    [rows[0].truck_id]
  );
  return rows[0];
}

// ─── Fueling Logs ────────────────────────────────────────────────────────────
exports.list = async (req, res) => {
  try {
    const { buildFuelingLogsQuery } = require('../services/fuelingQuery');
    let { query, values } = await buildFuelingLogsQuery(req.query);
    query += " LIMIT 100";
    const { rows } = await db.query(query, values);
    res.json(rows);
  } catch (err) {
    console.error("List fueling logs error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ─── Sessions ────────────────────────────────────────────────────────────────
exports.requestSession = async (req, res) => {
  try {
    const { truck_id, station_id, release_method } = req.body;
    if (!truck_id) return res.status(400).json({ error: "truck_id é obrigatório" });

    const { rows: trucks } = await db.query("SELECT id, fuel_station_id FROM trucks WHERE id=$1", [truck_id]);
    if (!trucks.length) return res.status(404).json({ error: "Caminhão não encontrado" });

    let driverId = req.body.driver_id || null;
    if (req.actor.type === "driver") {
      driverId = req.actor.id;
      if (!(await driverOwnsTruck(driverId, truck_id))) {
        return res.status(403).json({ error: "Este caminhão não está vinculado a você" });
      }
    } else if (!driverId) {
      const { rows } = await db.query(
        "SELECT driver_id FROM driver_trucks WHERE truck_id=$1 ORDER BY assigned_at DESC LIMIT 1", [truck_id]);
      driverId = rows[0]?.driver_id || null;
    }

    await expireStaleSessions(truck_id);
    const { rows: active } = await db.query(
      "SELECT id FROM fueling_sessions WHERE truck_id=$1 AND status IN ('requested','authorized','active') LIMIT 1",
      [truck_id]
    );
    if (active.length > 0) {
      const existing = await loadSession(active[0].id);
      return res.status(409).json({ error: "Já existe uma sessão ativa para este caminhão", session: existing, session_id: active[0].id });
    }

    let method = release_method || 'facial';
    if (req.actor.type === 'driver') {
      if (method !== 'facial' && method !== 'ble_fallback') {
        return res.status(400).json({ error: 'invalid_release_method' });
      }
    } else {
      method = ["facial", "ble_fallback", "manager_override"].includes(method) ? method : "facial";
    }
    const expiresAt = new Date(Date.now() + SESSION_TTL_MIN * 60 * 1000);
    const { rows } = await db.query(
      `INSERT INTO fueling_sessions (truck_id, driver_id, station_id, release_method, expires_at, metadata)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [truck_id, driverId, station_id || trucks[0].fuel_station_id || null, method, expiresAt,
       JSON.stringify({ requested_by: req.actor.type, facial_failures: 0 })]
    );
    const session = await loadSession(rows[0].id);
    emitSession(req, session);
    res.status(201).json(session);
  } catch (err) {
    console.error("Request session error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.authorizeSession = async (req, res) => {
  try {
    const { id } = req.params;
    const { rows: sessions } = await db.query(
      `SELECT s.*, t.lat as truck_lat, t.lng as truck_lng,
              fs.lat as station_lat, fs.lng as station_lng
         FROM fueling_sessions s
         JOIN trucks t ON s.truck_id = t.id
         LEFT JOIN fuel_stations fs ON s.station_id = fs.id
        WHERE s.id=$1 AND s.status='requested'`,
      [id]
    );
    if (!sessions.length) return res.status(404).json({ error: "Sessão não encontrada ou já autorizada" });
    const session = sessions[0];
    if (!canTouchSession(req, session)) return res.status(403).json({ error: "Sessão pertence a outro motorista" });

    const effectiveMethod = req.actor.type === "manager" ? "manager_override" : session.release_method;
    if (req.actor.type === "driver" && effectiveMethod !== 'facial' && effectiveMethod !== 'ble_fallback') {
      return res.status(403).json({ error: 'driver_cannot_use_manager_override' });
    }

    if (effectiveMethod === 'facial') {
      if (session.facial_consumed_at) return res.status(403).json({ error: "facial_verification_already_used" });
      if (!session.facial_verified_at) return res.status(403).json({ error: "facial_verification_required" });
      const verifiedAt = new Date(session.facial_verified_at).getTime();
      if (Date.now() - verifiedAt > 2 * 60 * 1000) return res.status(403).json({ error: "facial_verification_expired" });
    } else if (effectiveMethod === 'ble_fallback') {
      if (!session.ble_confirmed_at) return res.status(403).json({ error: "ble_confirmation_required" });
      if (session.ble_consumed_at) return res.status(403).json({ error: "ble_confirmation_already_used" });
      const confirmedAt = new Date(session.ble_confirmed_at).getTime();
      if (Date.now() - confirmedAt > 2 * 60 * 1000) return res.status(403).json({ error: "ble_confirmation_expired" });
    }

    // Geofence: o caminhão precisa estar no posto (posição atual reportada ou enviada pelo app)
    const lat = req.body?.lat ?? session.truck_lat;
    const lng = req.body?.lng ?? session.truck_lng;
    if (session.station_lat && session.station_lng && lat && lng) {
      const distance = haversineKm(+lat, +lng, +session.station_lat, +session.station_lng);
      if (distance > GEOFENCE_KM) {
        await security.recordSecurityEvent({
          truckId: session.truck_id,
          type: "unauthorized_fueling_attempt",
          severity: "critical",
          source: req.actor.type === "driver" ? "app" : "device",
          payload: { reason: "outside_geofence", distance_km: Number(distance.toFixed(3)) },
          io: req.io,
        });
        await db.query("UPDATE fueling_sessions SET status='cancelled' WHERE id=$1", [id]);
        emitSession(req, await loadSession(id));
        return res.status(403).json({ error: "Caminhão fora da área do posto autorizado. Tentativa bloqueada e alertada." });
      }
    }

    const method = req.actor.type === "manager" ? "manager_override" : (session.release_method || "facial");
    const updated = await authorizeAndUnlock(id, method, { authorized_by: req.actor.type, authorized_by_id: req.actor.id }, req.actor.type);
    if (!updated) return res.status(409).json({ error: "Sessão já foi processada" });
      if (effectiveMethod === 'ble_fallback') {
        const al = await db.query(`INSERT INTO fleet_alerts (truck_id, type, severity, message, plate, model) 
          SELECT $1, 'ble_fallback_used', 'medium', 'Abastecimento liberado via BLE Fallback sem biometria facial.', t.plate, t.model
          FROM trucks t WHERE t.id = $1 RETURNING *`, [session.truck_id]);
        if (req.io && al.rows[0]) req.io.emit('newAlert', al.rows[0]);
      }
      const full = await loadSession(id);
    emitSession(req, full);
    res.json(full);
  } catch (err) {
    console.error("Authorize session error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.finishSession = async (req, res) => {
  try {
    const { id } = req.params;
    const { rows: sessions } = await db.query(
      "SELECT * FROM fueling_sessions WHERE id=$1 AND status IN ('authorized','active') LIMIT 1",
      [id]
    );
    if (!sessions.length) return res.status(404).json({ error: "Sessão não encontrada ou não está ativa" });
    const session = sessions[0];
    if (!canTouchSession(req, session)) return res.status(403).json({ error: "Sem permissão para esta sessão" });

    const { rows: trucks } = await db.query(
      `SELECT t.*, fs.name AS station_name FROM trucks t
       LEFT JOIN fuel_stations fs ON fs.id = COALESCE($2::int, t.fuel_station_id)
       WHERE t.id=$1`,
      [session.truck_id, session.station_id]
    );
    if (!trucks.length) return res.status(404).json({ error: "Caminhão não encontrado" });
    const truck = trucks[0];

    const capacity    = parseFloat(truck.capacity_liters);
    
    const actorType = req.actor?.type;
    let dataSource = 'unverified';
    let levelBeforeStr = null;
    let levelAfterStr = null;
    
    if (actorType === 'manager' || actorType === 'hardware') {
      levelBeforeStr = req.body?.level_before;
      levelAfterStr = req.body?.level_after;
      // Reverter para unverified se level_after não for um número válido
      if (levelAfterStr == null || isNaN(parseFloat(levelAfterStr))) {
        dataSource = 'unverified';
      } else {
        dataSource = actorType;
      }
    }

    const pumpLiters = session.pump_liters ?? null;
    const now = new Date();
    const startedAt = session.authorized_at || session.requested_at;
    const durationMin = (now - new Date(startedAt)) / 60000;

    let levelBefore = null;
    let levelAfter = null;
    let volume = null;
    let tankLitersDelta = null;

    if (dataSource !== 'unverified') {
      levelBefore = parseFloat(levelBeforeStr ?? truck.current_level_liters);
      levelAfter = parseFloat(levelAfterStr);
      levelAfter = Math.min(Math.max(levelAfter, 0), capacity);
      volume = Math.max(levelAfter - levelBefore, 0);
      tankLitersDelta = volume;
    } else {
      // Unverified logic: we don't know the exact levels without hardware.
      // We still record the level_before as the truck's last known level, 
      // but leave level_after and volume as NULL.
      levelBefore = parseFloat(truck.current_level_liters);
    }

    const { rows: insertedLogs } = await db.query(
      `INSERT INTO fueling_logs
         (session_id, driver_id, truck_id, lat, lng, level_before, level_after, release_method,
          station_id, station_name, started_at, completed_at, duration_minutes, volume_liters,
          pump_liters, tank_liters_delta, data_source)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING id`,
      [id, session.driver_id, session.truck_id, truck.lat, truck.lng,
       levelBefore, levelAfter, session.release_method || "facial",
       session.station_id, truck.station_name || null,
       startedAt, now, durationMin.toFixed(1), volume,
       pumpLiters, tankLitersDelta, dataSource]
    );

    await db.query(`
      UPDATE fueling_sessions 
      SET status='completed', completed_at=NOW(), tank_liters_delta=$2, data_source=$3
      WHERE id=$1`, 
      [id, tankLitersDelta, dataSource]
    );

    if (dataSource === 'unverified') {
      const { rows: alerts } = await db.query(
        `INSERT INTO fleet_alerts (truck_id, type, severity, message, plate, model, fueling_log_id)
         VALUES ($1, 'unverified_fueling', 'high', 'Abastecimento finalizado sem medição de hardware (driver).', $2, $3, $4)
         RETURNING *`,
        [truck.id, truck.plate, truck.model, insertedLogs[0].id]
      );
      if (req.io && alerts.length > 0) req.io.emit('newAlert', alerts[0]);
    }

    // Retorno à rota só faz sentido se houver rota planejada
    let returning = null;
    try { returning = await buildReturnRoute(truck); } catch (e) { returning = null; }
    
    // IMPORTANTE: Só atualizamos o nível de combustível do caminhão se a fonte for confiável.
    const updatedLevel = dataSource !== 'unverified' ? levelAfter : truck.current_level_liters;

    if (returning?.route) {
      await db.query(`
        UPDATE trucks SET current_level_liters=$1, speed_kmh=0, status='ok',
          sim_state='driving', route_phase='returning_to_route', fueling_ticks=0,
          route_geometry=$2, route_index=0, route_resume_index=$3 WHERE id=$4
      `, [updatedLevel, JSON.stringify(returning.route), returning.index, session.truck_id]);
    } else {
      await db.query(
        "UPDATE trucks SET current_level_liters=$1, status='ok', sim_state='idle', route_phase='planned', fueling_ticks=0 WHERE id=$2",
        [updatedLevel, session.truck_id]
      );
    }

    emitSession(req, await loadSession(id));
    
    // Evaluate rules
    try {
      const { evaluateFuelingLog } = require('../services/fuelRules');
      await evaluateFuelingLog(insertedLogs[0].id, req.io);
    } catch (e) {
      console.error("Rule evaluation failed:", e);
    }

    res.json({ success: true, volume_liters: volume, duration_minutes: durationMin.toFixed(1) });
  } catch (err) {
    console.error("Finish session error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.getActiveSession = async (req, res) => {
  try {
    const truckId = parseInt(req.params.truckId, 10);
    if (!truckId) return res.status(400).json({ error: "truckId inválido" });
    if (req.actor.type === "hardware" && req.actor.id !== truckId) {
      return res.status(403).json({ error: "API Key não pertence a este caminhão" });
    }
    if (req.actor.type === "driver" && !(await driverOwnsTruck(req.actor.id, truckId))) {
      return res.status(403).json({ error: "Este caminhão não está vinculado a você" });
    }
    await expireStaleSessions(truckId);
    const { rows } = await db.query(
      `SELECT s.*, fs.name AS station_name, d.name AS driver_name
         FROM fueling_sessions s
         LEFT JOIN fuel_stations fs ON s.station_id = fs.id
         LEFT JOIN drivers d ON s.driver_id = d.id
        WHERE s.truck_id=$1 AND s.status IN ('requested','authorized','active')
        ORDER BY s.requested_at DESC LIMIT 1`,
      [truckId]
    );
    const session = rows[0] || null;
    if (req.actor.type === "hardware") {
      // Resposta enxuta para o firmware: abre a trava só com sessão autorizada.
      return res.json({
        unlock: !!session && ["authorized", "active"].includes(session.status),
        session_id: session?.id || null,
        status: session?.status || null,
        expires_at: session?.expires_at || null,
      });
    }
    res.json(session);
  } catch (err) {
    console.error("Get active session error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ─── Biometria / Emergência ────────────────────────────────────────────────
// App reporta falha de reconhecimento facial. Após X falhas, o gestor é
// notificado em tempo real para liberar manualmente.
exports.reportFacialFailure = async (req, res) => {
  try {
    const session = await loadSession(req.params.id);
    if (!session || session.status !== "requested") {
      return res.status(404).json({ error: "Sessão não encontrada ou já processada" });
    }
    if (!canTouchSession(req, session)) return res.status(403).json({ error: "Sessão pertence a outro motorista" });

    const failures = (parseInt(session.metadata?.facial_failures, 10) || 0) + 1;
    const needsManager = failures >= FACIAL_MAX_ATTEMPTS;
    await db.query(
      `UPDATE fueling_sessions
          SET metadata = COALESCE(metadata,'{}'::jsonb) || $2::jsonb
        WHERE id=$1`,
      [session.id, JSON.stringify({ facial_failures: failures, needs_manager: needsManager, last_failure_at: new Date().toISOString() })]
    );

    await security.recordSecurityEvent({
      truckId: session.truck_id,
      type: needsManager ? "facial_auth_locked" : "facial_auth_failed",
      severity: needsManager ? "high" : "medium",
      source: "app",
      payload: { session_id: session.id, attempt: failures, max_attempts: FACIAL_MAX_ATTEMPTS, driver_id: session.driver_id },
      io: req.io,
    });

    const updated = await loadSession(session.id);
    if (needsManager && req.io) req.io.emit("emergencyUnlockRequest", updated);
    emitSession(req, updated);

    res.json({
      attempts: failures,
      max_attempts: FACIAL_MAX_ATTEMPTS,
      remaining: Math.max(FACIAL_MAX_ATTEMPTS - failures, 0),
      needs_manager: needsManager,
    });
  } catch (err) {
    console.error("Facial failure error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.listPendingEmergency = async (req, res) => {
  try {
    await expireStaleSessions();
    const { rows } = await db.query(
      `SELECT s.*, t.plate, t.model, d.name AS driver_name, fs.name AS station_name
         FROM fueling_sessions s
         JOIN trucks t ON t.id = s.truck_id
         LEFT JOIN drivers d ON d.id = s.driver_id
         LEFT JOIN fuel_stations fs ON fs.id = s.station_id
        WHERE s.status='requested' AND (s.metadata->>'needs_manager')::boolean IS TRUE
        ORDER BY s.requested_at DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error("Pending emergency error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

async function recordOverride(req, truckId, sessionId, reason) {
  await security.recordSecurityEvent({
    truckId,
    type: "manager_override",
    severity: "medium",
    source: "manager",
    payload: { session_id: sessionId, reason, manager_id: req.actor.id, manager_email: req.actor.email },
    io: req.io,
  });
}

// Libera uma sessão pendente (motorista travado na biometria)
exports.emergencyUnlockSession = async (req, res) => {
  try {
    const reason = String(req.body?.reason || "").trim();
    if (reason.length < 5) return res.status(400).json({ error: "Informe o motivo da liberação (mín. 5 caracteres)" });
    const session = await loadSession(req.params.id);
    if (!session || session.status !== "requested") {
      return res.status(404).json({ error: "Sessão não encontrada ou já processada" });
    }
    const updated = await authorizeAndUnlock(session.id, "manager_override", { override_reason: reason, authorized_by: "manager", authorized_by_id: req.actor.id }, req.actor.type);
    if (!updated) return res.status(409).json({ error: "Sessão já foi processada" });
    await recordOverride(req, session.truck_id, session.id, reason);
    const full = await loadSession(session.id);
    emitSession(req, full);
    res.json(full);
  } catch (err) {
    console.error("Emergency unlock session error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Liberação direta a partir da tela do caminhão (cria e autoriza a sessão)
exports.emergencyUnlockTruck = async (req, res) => {
  try {
    const truckId = parseInt(req.body?.truck_id, 10);
    const reason = String(req.body?.reason || "").trim();
    if (!truckId) return res.status(400).json({ error: "truck_id é obrigatório" });
    if (reason.length < 5) return res.status(400).json({ error: "Informe o motivo da liberação (mín. 5 caracteres)" });

    const { rows: trucks } = await db.query("SELECT id, fuel_station_id FROM trucks WHERE id=$1", [truckId]);
    if (!trucks.length) return res.status(404).json({ error: "Caminhão não encontrado" });

    await expireStaleSessions(truckId);
    const { rows: active } = await db.query(
      "SELECT id, status FROM fueling_sessions WHERE truck_id=$1 AND status IN ('requested','authorized','active') LIMIT 1",
      [truckId]
    );

    let sessionId;
    if (active.length && active[0].status !== "requested") {
      return res.status(409).json({ error: "A trava já está liberada para este caminhão", session: await loadSession(active[0].id) });
    }
    if (active.length) {
      sessionId = active[0].id;
    } else {
      const { rows: drv } = await db.query(
        "SELECT driver_id FROM driver_trucks WHERE truck_id=$1 ORDER BY assigned_at DESC LIMIT 1", [truckId]);
      const { rows } = await db.query(
        `INSERT INTO fueling_sessions (truck_id, driver_id, station_id, release_method, expires_at, metadata)
         VALUES ($1,$2,$3,'manager_override', NOW() + INTERVAL '${SESSION_TTL_MIN} minutes', $4) RETURNING id`,
        [truckId, drv[0]?.driver_id || null, trucks[0].fuel_station_id || null, JSON.stringify({ requested_by: "manager" })]
      );
      sessionId = rows[0].id;
    }

    const updated = await authorizeAndUnlock(sessionId, "manager_override", { override_reason: reason, authorized_by: "manager", authorized_by_id: req.actor.id }, req.actor.type);
    if (!updated) return res.status(409).json({ error: "Sessão já foi processada" });
    await recordOverride(req, truckId, sessionId, reason);
    const full = await loadSession(sessionId);
    emitSession(req, full);
    res.status(201).json(full);
  } catch (err) {
    console.error("Emergency unlock truck error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.reportPumpReading = async (req, res) => {
  try {
    const { id } = req.params;
    const { pump_liters } = req.body;
    
    if (pump_liters == null || isNaN(parseFloat(pump_liters))) {
      return res.status(400).json({ error: "pump_liters é obrigatório e numérico" });
    }

    const val = parseFloat(pump_liters);
    
    const { rows: sessions } = await db.query(
      "SELECT s.*, t.capacity_liters FROM fueling_sessions s JOIN trucks t ON s.truck_id = t.id WHERE s.id=$1",
      [id]
    );
    if (!sessions.length) return res.status(404).json({ error: "Sessão não encontrada" });
    
    const session = sessions[0];
    
    if (session.truck_id !== req.truck?.id) {
      return res.status(403).json({ error: "Hardware API Key não pertence a este caminhão" });
    }

    if (val < 0 || val > parseFloat(session.capacity_liters)) {
      return res.status(400).json({ error: "pump_liters inválido (fora do limite da capacidade)" });
    }

    if (!['active', 'completed'].includes(session.status)) {
      return res.status(409).json({ error: "Sessão não está ativa nem concluída" });
    }

    await db.query("UPDATE fueling_sessions SET pump_liters = $1 WHERE id = $2", [val, id]);
    
    let logIdToEval = null;
    if (session.status === 'completed') {
      const { rows: updatedLogs } = await db.query("UPDATE fueling_logs SET pump_liters = $1 WHERE session_id = $2 RETURNING id", [val, id]);
      if (updatedLogs.length > 0) logIdToEval = updatedLogs[0].id;
    }
    
    res.json({ success: true, pump_liters: val });
    
    if (logIdToEval) {
      try {
        const { evaluateFuelingLog } = require('../services/fuelRules');
        await evaluateFuelingLog(logIdToEval, req.io);
      } catch (e) {
        console.error("Rule evaluation failed after pump reading:", e);
      }
    }
  } catch (err) {
    console.error("Pump reading error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};



exports.verifyFace = async (req, res) => {
  let client;
  let clientReleased = false;
  try {
    const { id } = req.params;
    const { image_base64 } = req.body;
    if (!image_base64) return res.status(400).json({ error: "image_base64 é obrigatório" });
    
    const { validateImageBase64 } = require('../services/imageValidation');
    const { buffer } = validateImageBase64(image_base64);

    client = await db.pool.connect();
    await client.query("BEGIN");

    const { rows: sessions } = await client.query("SELECT * FROM fueling_sessions WHERE id=$1 AND status='requested' FOR UPDATE", [id]);
    if (!sessions.length) {
      await client.query("ROLLBACK");
      clientReleased = true;
      client.release();
      return res.status(404).json({ error: "Sessão não encontrada" });
    }
    const session = sessions[0];
    
    if (session.driver_id !== req.actor.id) {
      await client.query("ROLLBACK");
      clientReleased = true;
      client.release();
      return res.status(403).json({ error: "Sessão de outro motorista" });
    }

    const { rows: drivers } = await client.query("SELECT face_enrolled, face_template_ref FROM drivers WHERE id=$1", [req.actor.id]);
    if (!drivers[0]?.face_enrolled || !drivers[0]?.face_template_ref) {
      await client.query("ROLLBACK");
      clientReleased = true;
      client.release();
      return res.status(409).json({ error: "face_not_enrolled" });
    }

    const { rows: limits } = await client.query("SELECT COUNT(*) as cnt FROM facial_attempts WHERE driver_id=$1 AND created_at >= NOW() - INTERVAL '1 hour'", [req.actor.id]);
    if (parseInt(limits[0].cnt) >= 10) {
      await client.query("ROLLBACK");
      clientReleased = true;
      client.release();
      return res.status(429).json({ error: "Limite de tentativas por hora atingido." });
    }

    const { rows: sessionAtt } = await client.query("SELECT COUNT(*) as cnt FROM facial_attempts WHERE session_id=$1", [id]);
    if (parseInt(sessionAtt[0].cnt) >= 3) {
      await client.query("ROLLBACK");
      clientReleased = true;
      client.release();
      return res.status(429).json({ error: "Limite de tentativas da sessão atingido." });
    }

    let providerResult;
    let providerName = process.env.FACE_PROVIDER || 'disabled';
    try {
      providerResult = await faceProvider.verify(req.actor.id, drivers[0].face_template_ref, buffer);
    } catch(e) {
      await client.query("ROLLBACK");
      clientReleased = true;
      client.release();
      await security.recordSecurityEvent({
        truckId: session.truck_id,
        type: "face_provider_error",
        severity: "high",
        source: "app",
        payload: { error: e.message, provider: providerName },
        io: req.io
      });
      return res.status(503).json({ error: 'face_provider_unavailable' });
    }

    const threshold = parseFloat(process.env.FACE_MATCH_THRESHOLD || "0.90");
    const isSuccess = providerResult.match && providerResult.score >= threshold && providerResult.livenessPassed;
    
    const { rows: attemptIns } = await client.query(
      "INSERT INTO facial_attempts (session_id, driver_id, truck_id, success, score, liveness_passed, provider, failure_reason) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id",
      [id, req.actor.id, session.truck_id, isSuccess, providerResult.score || 0, !!providerResult.livenessPassed, providerName, providerResult.error || null]
    );

    if (isSuccess) {
      await client.query("UPDATE fueling_sessions SET facial_verified_at=NOW(), facial_attempt_id=$1 WHERE id=$2", [attemptIns[0].id, id]);
      await client.query("COMMIT");
      clientReleased = true;
      client.release();
      return res.json({ verified: true });
    } else {
      const attemptsCount = parseInt(sessionAtt[0].cnt) + 1;
      let needsManager = false;
      if (attemptsCount >= 3) {
        needsManager = true;
        await client.query(
          "UPDATE fueling_sessions SET metadata = COALESCE(metadata,'{}'::jsonb) || $2::jsonb WHERE id=$1",
          [session.id, JSON.stringify({ facial_failures: attemptsCount, needs_manager: true, last_failure_at: new Date().toISOString() })]
        );
      }
      
      await client.query("COMMIT");
      clientReleased = true;
      client.release();
      
      if (needsManager) {
        await security.recordSecurityEvent({
          truckId: session.truck_id,
          type: "facial_auth_locked",
          severity: "high",
          source: "app",
          payload: { session_id: session.id, attempt: attemptsCount, max_attempts: 3, driver_id: session.driver_id },
          io: req.io,
        });
      }

      return res.json({ verified: false, attempts: attemptsCount, attempts_left: Math.max(3 - attemptsCount, 0), error: providerResult.error });
    }
  } catch (err) {
    if (client && !clientReleased) {
      await client.query("ROLLBACK");
      clientReleased = true;
      client.release();
    }
    console.error("Verify face error:", err);
    if (err.status) return res.status(err.status).json({ error: err.message });
    res.status(500).json({ error: "Internal server error" });
  } finally {
    if (client && !clientReleased) client.release();
  }
};

exports.bleConfirmed = async (req, res) => {
  try {
    const { id } = req.params;
    const { rows: sessions } = await db.query("SELECT * FROM fueling_sessions WHERE id=$1 AND status='requested'", [id]);
    if (!sessions.length) return res.status(409).json({ error: "Sessão não encontrada ou não aguardando" });
    const session = sessions[0];
    
    if (session.truck_id !== req.truck.id) return res.status(403).json({ error: "Esta sessão pertence a outro caminhão" });
    if (session.release_method !== 'ble_fallback') return res.status(409).json({ error: "Sessão não usa BLE fallback" });
    
    await db.query("UPDATE fueling_sessions SET ble_confirmed_at=NOW() WHERE id=$1", [id]);
    res.json({ success: true });
  } catch (err) {
    console.error("BLE confirmed error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};










exports.emitSession = emitSession;

exports.loadSession = loadSession;



