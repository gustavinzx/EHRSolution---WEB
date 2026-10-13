"use strict";
const db = require("../config/db");
const { loadSession, safeSessionProjection } = require("../controllers/fuelingController");
const { releaseTruckIfIdle } = require("./sessionRelease");

let isRunning = false;
let checkInterval = null;

async function checkAndProcessSessions(io) {
  if (isRunning) return;
  isRunning = true;
  try {
    // 1. Sessões autorizadas (rosto ou BLE aprovado pelo app) -> Iniciar bomba
    const { rows: authorizedSessions } = await db.query(`
      SELECT s.id, s.truck_id, s.driver_id, s.status, s.station_id, s.release_method, s.authorized_at, s.started_at,
             t.capacity_liters, t.current_level_liters, t.plate, t.model, t.lat, t.lng, t.fuel_station_id,
             fs.name AS station_name
      FROM fueling_sessions s
      JOIN trucks t ON t.id = s.truck_id
      LEFT JOIN fuel_stations fs ON fs.id = COALESCE(s.station_id, t.fuel_station_id)
      WHERE s.status = 'authorized'
        AND s.authorized_at IS NOT NULL
        AND s.authorized_at < NOW() - INTERVAL '3 seconds'
      ORDER BY s.id ASC
    `);

    for (const sess of authorizedSessions) {
      console.log(`[VIRTUAL-HARDWARE] Trava liberada para Sessão #${sess.id} (${sess.plate}). Iniciando abastecimento...`);
      await db.query(`
        UPDATE fueling_sessions
        SET status = 'active', started_at = COALESCE(started_at, NOW())
        WHERE id = $1 AND status = 'authorized'
      `, [sess.id]);

      await db.query(`
        UPDATE trucks
        SET sim_state = 'fueling', route_phase = 'fueling'
        WHERE id = $1
      `, [sess.truck_id]);

      if (io) {
        const full = await loadSession(sess.id);
        if (full) io.emit('fuelingSessionUpdate', safeSessionProjection(full));
      }
    }

    // 2. Sessões em andamento há mais de 8s -> Finalizar com medição de combustível
    const { rows: activeSessions } = await db.query(`
      SELECT s.id, s.truck_id, s.driver_id, s.status, s.station_id, s.release_method, s.authorized_at, s.started_at,
             s.anp_station_id, s.station_match_status, s.station_match_distance_m, s.station_match_source,
             t.capacity_liters, t.current_level_liters, t.plate, t.model, t.lat, t.lng, t.fuel_station_id,
             fs.name AS station_name
      FROM fueling_sessions s
      JOIN trucks t ON t.id = s.truck_id
      LEFT JOIN fuel_stations fs ON fs.id = COALESCE(s.station_id, t.fuel_station_id)
      WHERE s.status = 'active'
        AND s.started_at IS NOT NULL
        AND s.started_at < NOW() - INTERVAL '8 seconds'
      ORDER BY s.id ASC
    `);

    for (const sess of activeSessions) {
      console.log(`[VIRTUAL-HARDWARE] Fluxo finalizado para Sessão #${sess.id} (${sess.plate}). Registrando telemetria...`);
      const capacity = parseFloat(sess.capacity_liters) || 600;
      const currentLevel = parseFloat(sess.current_level_liters) || 300;
      const space = Math.max(capacity - currentLevel, 50);
      const volume = Math.min(space, 250);
      const levelAfter = Math.min(currentLevel + volume, capacity);
      const durationMin = Math.max(((Date.now() - new Date(sess.started_at).getTime()) / 60000), 0.2).toFixed(1);

      const { rows: insertedLogs } = await db.query(`
        INSERT INTO fueling_logs
          (session_id, driver_id, truck_id, lat, lng, level_before, level_after, release_method,
           station_id, station_name, started_at, completed_at, duration_minutes, volume_liters,
           pump_liters, tank_liters_delta, data_source,
           anp_station_id, station_match_status, station_match_distance_m, station_match_source)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), $12, $13, $14, $15, 'simulated', $16, $17, $18, $19)
        RETURNING id
      `, [
        sess.id, sess.driver_id, sess.truck_id, sess.lat, sess.lng,
        currentLevel, levelAfter, sess.release_method || 'facial',
        sess.station_id || sess.fuel_station_id, sess.station_name,
        sess.started_at, durationMin, volume, volume, volume,
        sess.anp_station_id || null, sess.station_match_status || null,
        sess.station_match_distance_m ?? null, sess.station_match_source || null
      ]);

      await db.query(`
        UPDATE fueling_sessions
        SET status = 'completed', completed_at = NOW(), tank_liters_delta = $2, data_source = 'simulated'
        WHERE id = $1
      `, [sess.id, volume]);

      await db.query(`
        UPDATE trucks
        SET current_level_liters = $1
        WHERE id = $2
      `, [levelAfter, sess.truck_id]);

      await releaseTruckIfIdle(sess.truck_id);

      console.log(`[VIRTUAL-HARDWARE] Sucesso: +${volume}L abastecidos (${currentLevel}L -> ${levelAfter}L). Log #${insertedLogs[0]?.id}`);

      if (io) {
        const full = await loadSession(sess.id);
        if (full) io.emit('fuelingSessionUpdate', safeSessionProjection(full));
      }
    }
  } catch (err) {
    console.error('[VIRTUAL-HARDWARE] Erro:', err.message);
  } finally {
    isRunning = false;
  }
}

function startVirtualHardware(io) {
  if (process.env.VIRTUAL_HARDWARE_ENABLED === 'true' && process.env.NODE_ENV === 'production') {
    throw new Error('VIRTUAL_HARDWARE_ENABLED não pode ser ativado em ambiente de produção!');
  }
  if (process.env.VIRTUAL_HARDWARE_ENABLED !== 'true') {
    return;
  }
  console.log('[VIRTUAL-HARDWARE] Modo de Hardware Virtual ATIVO (simulando bomba e sensores automaticamente).');
  if (checkInterval) clearInterval(checkInterval);
  checkInterval = setInterval(() => checkAndProcessSessions(io), 2000);
}

function stopVirtualHardware() {
  if (checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
  }
  isRunning = false;
}

module.exports = {
  startVirtualHardware,
  stopVirtualHardware,
  checkAndProcessSessions,
};
