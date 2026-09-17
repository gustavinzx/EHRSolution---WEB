const db = require('../config/db');

// Thresholds
const FUEL_DROP_THRESHOLD_PCT = 8;   // % drop that triggers alert
const TIME_WINDOW_MINUTES = 5;        // window to check for fueling log

/**
 * Check for suspicious fuel drops for all trucks.
 * Compares last two telemetry readings; if drop > threshold
 * and no fueling_log exists in that window, creates an alert.
 */
async function detectFuelAnomalies(io) {
  try {
    // Get the two most recent telemetry readings per truck
    const { rows: readings } = await db.query(`
      SELECT DISTINCT ON (truck_id)
        tl.truck_id,
        tl.fuel_level_liters AS current_level,
        tl.timestamp         AS current_ts,
        prev.fuel_level_liters AS prev_level,
        prev.timestamp         AS prev_ts,
        t.capacity_liters,
        t.plate,
        t.model,
        t.sim_state
      FROM telemetry_logs tl
      JOIN trucks t ON t.id = tl.truck_id
      JOIN LATERAL (
        SELECT fuel_level_liters, timestamp
        FROM telemetry_logs
        WHERE truck_id = tl.truck_id AND timestamp < tl.timestamp
        ORDER BY timestamp DESC
        LIMIT 1
      ) prev ON true
      ORDER BY tl.truck_id, tl.timestamp DESC
    `);

    for (const row of readings) {
      // Skip trucks that are fueling (expected drop)
      if (row.sim_state === 'fueling' || row.sim_state === 'resuming') continue;

      const cap = parseFloat(row.capacity_liters);
      if (!cap || cap === 0) continue;

      const currentLvl = parseFloat(row.current_level);
      const prevLvl    = parseFloat(row.prev_level);
      const dropLiters = prevLvl - currentLvl;
      const dropPct    = (dropLiters / cap) * 100;

      if (dropPct < FUEL_DROP_THRESHOLD_PCT) continue;

      // Check if there is a fueling_log in the time window
      const { rows: fuelLogs } = await db.query(`
        SELECT id FROM fueling_logs
        WHERE truck_id = $1
          AND timestamp BETWEEN $2 - INTERVAL '${TIME_WINDOW_MINUTES} minutes'
          AND $2 + INTERVAL '1 minute'
        LIMIT 1
      `, [row.truck_id, row.current_ts]);

      if (fuelLogs.length > 0) continue; // Legitimate fueling event

      // Check if we already created this alert recently (dedup - last 10 min)
      const { rows: existingAlerts } = await db.query(`
        SELECT id FROM fleet_alerts
        WHERE truck_id = $1
          AND type = 'suspicious_fuel_drop'
          AND created_at > NOW() - INTERVAL '10 minutes'
        LIMIT 1
      `, [row.truck_id]);

      if (existingAlerts.length > 0) continue;

      // Create alert
      const message = `Queda suspeita de ${dropPct.toFixed(1)}% (${dropLiters.toFixed(1)}L) sem abastecimento registrado.`;
      const { rows: inserted } = await db.query(`
        INSERT INTO fleet_alerts (truck_id, type, severity, message, plate, model)
        VALUES ($1, 'suspicious_fuel_drop', 'critical', $2, $3, $4)
        RETURNING *
      `, [row.truck_id, message, row.plate, row.model]);

      console.log(`[ALERT] Queda suspeita de combustível detectada: Caminhão ${row.plate} — ${dropPct.toFixed(1)}% de queda`);

      // Emit via WebSocket
      if (io && inserted.length > 0) {
        io.emit('newAlert', inserted[0]);
      }
    }
  } catch (err) {
    console.error('[ANOMALY] Erro no detector de anomalias:', err.message);
  }
}

module.exports = { detectFuelAnomalies };
