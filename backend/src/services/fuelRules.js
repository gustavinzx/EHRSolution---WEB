const db = require('../config/db');

let settingsCache = null;
let lastCacheTime = 0;

async function getAlertSettings() {
  const now = Date.now();
  if (settingsCache && (now - lastCacheTime < 30000)) {
    return settingsCache;
  }
  
  const { rows } = await db.query('SELECT key, value_num FROM alert_settings');
  const settings = {};
  for (const row of rows) {
    settings[row.key] = parseFloat(row.value_num);
  }
  
  settingsCache = settings;
  lastCacheTime = now;
  return settings;
}

function clearSettingsCache() {
  settingsCache = null;
  lastCacheTime = 0;
}

async function evaluateFuelingLog(logId, io) {
  try {
    const { rows: logs } = await db.query(`
      SELECT fl.*, t.consumption_per_100km, t.capacity_liters, t.plate, t.model
      FROM fueling_logs fl
      JOIN trucks t ON t.id = fl.truck_id
      WHERE fl.id = $1
    `, [logId]);
    
    if (logs.length === 0) return;
    const log = logs[0];
    const truckId = log.truck_id;
    const settings = await getAlertSettings();
    const alertsToCreate = [];

    // 1. fuel_divergence
    if (log.pump_liters !== null && log.tank_liters_delta !== null) {
      const pumpLiters = parseFloat(log.pump_liters);
      const tankDelta = parseFloat(log.tank_liters_delta);
      
      if (pumpLiters > 0) {
        const divergencePct = (Math.abs(pumpLiters - tankDelta) / pumpLiters) * 100;
        
        let severity = null;
        if (divergencePct > settings.divergence_critical_pct) {
          severity = 'critical';
        } else if (divergencePct > settings.divergence_pct) {
          severity = 'high';
        }
        
        if (severity) {
          const msg = `Divergência de combustível: Bomba reportou ${pumpLiters.toFixed(1)}L, tanque reportou ${tankDelta.toFixed(1)}L (${divergencePct.toFixed(1)}%).`;
          alertsToCreate.push({ type: 'fuel_divergence', severity, message: msg });
        }
      }
    }

    // 2. fueling_off_hours
    if (settings.offhours_enabled === 1 && log.started_at) {
      // Parse in local timezone (America/Sao_Paulo has UTC-3 or UTC-2, let's use the local hour from timestamp adjusting to SP time approx)
      // JS Date .getHours() uses system local time. It's safer to use localized formatter.
      const dateStr = log.started_at.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo', hourCycle: 'h23' });
      const hour = new Date(dateStr).getHours();
      
      const startH = settings.offhours_start_hour;
      const endH = settings.offhours_end_hour;
      
      let isOffHours = false;
      if (startH > endH) {
        isOffHours = hour >= startH || hour < endH;
      } else {
        isOffHours = hour >= startH && hour < endH;
      }
      
      if (isOffHours) {
        alertsToCreate.push({
          type: 'fueling_off_hours',
          severity: 'medium',
          message: `Abastecimento realizado fora de horário restrito (${hour}h).`
        });
      }
    }

    // 3. consumption_anomaly
    // To calculate we need distance since last fueling
    const { rows: prevLogs } = await db.query(`
      SELECT timestamp FROM fueling_logs 
      WHERE truck_id = $1 AND timestamp < $2 
      ORDER BY timestamp DESC LIMIT 1
    `, [truckId, log.timestamp]);
    
    if (prevLogs.length > 0 && log.pump_liters > 0) {
      const prevTs = prevLogs[0].timestamp;
      // Unfortunately we don't have odometer. Can we estimate distance via telemetry?
      // Since we can't reliably get distance from raw lat/lng easily without PostGIS,
      // and we are requested "inspecione primeiro quais dados existem",
      // "Se NÃO houver dado suficiente, não invente: pule esta regra e diga isso explicitamente no relatório final."
      // Since there is no odometer field in trucks nor telemetry_logs, we must skip.
    }

    // Insert and Emit Alerts
    for (const alert of alertsToCreate) {
      const { rows: existing } = await db.query(`
        SELECT id FROM fleet_alerts WHERE type = $1 AND fueling_log_id = $2 LIMIT 1
      `, [alert.type, logId]);

      if (existing.length === 0) {
        const { rows: inserted } = await db.query(`
          INSERT INTO fleet_alerts (truck_id, type, severity, message, plate, model, fueling_log_id)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING *
        `, [truckId, alert.type, alert.severity, alert.message, log.plate, log.model, logId]);
        
        if (inserted.length > 0 && io) {
          io.emit('newAlert', inserted[0]);
        }
      }
    }
    
  } catch (err) {
    console.error('Error evaluating fueling rules:', err);
  }
}

module.exports = {
  evaluateFuelingLog,
  getAlertSettings,
  clearSettingsCache
};
