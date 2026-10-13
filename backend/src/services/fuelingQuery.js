const db = require('../config/db');
const { getAlertSettings } = require('./fuelRules');

function buildStationMatchProjection(row) {
  if (!row || (!row.station_match_status && !row.anp_cnpj)) {
    return null;
  }
  return {
    status: row.station_match_status || null,
    distance_m:
      row.station_match_distance_m !== null && row.station_match_distance_m !== undefined
        ? Number(row.station_match_distance_m)
        : null,
    station: row.anp_cnpj
      ? {
          cnpj: String(row.anp_cnpj).trim(),
          razao_social: row.anp_razao_social || null,
          municipio: row.anp_municipio || null,
          uf: row.anp_uf ? String(row.anp_uf).trim() : null,
          bandeira: row.anp_bandeira || null
        }
      : null
  };
}

function formatFuelingLogRow(row) {
  if (!row) return null;
  const station_match = buildStationMatchProjection(row);
  const {
    anp_station_id,
    station_match_status,
    station_match_distance_m,
    station_match_source,
    anp_cnpj,
    anp_razao_social,
    anp_municipio,
    anp_uf,
    anp_bandeira,
    ...rest
  } = row;
  return {
    ...rest,
    station_match
  };
}

exports.buildStationMatchProjection = buildStationMatchProjection;
exports.formatFuelingLogRow = formatFuelingLogRow;

exports.buildFuelingLogsQuery = async (filters = {}) => {
  const { truck_id, driver_id, start, end, dataSource, onlyDivergence } = filters;
  const settings = await getAlertSettings();
  const divLimit = settings.divergence_pct || 5;

  let query = `
    SELECT f.id, f.session_id, f.driver_id, f.truck_id, f.timestamp,
           f.lat, f.lng, f.level_before, f.level_after, f.release_method,
           f.station_id, COALESCE(fs.name, f.station_name) as station_name,
           f.started_at, f.completed_at, f.duration_minutes, f.volume_liters,
           f.pump_liters, f.tank_liters_delta, f.data_source,
           f.station_match_status, f.station_match_distance_m,
           anp.cnpj as anp_cnpj, anp.razao_social as anp_razao_social,
           anp.municipio as anp_municipio, anp.uf as anp_uf, anp.bandeira as anp_bandeira,
           d.name as driver_name, t.plate, t.model,
           CASE 
             WHEN f.pump_liters IS NOT NULL AND f.tank_liters_delta IS NOT NULL AND f.pump_liters > 0 
             THEN ABS(f.pump_liters - f.tank_liters_delta) 
             ELSE NULL 
           END as divergence_liters,
           CASE 
             WHEN f.pump_liters IS NOT NULL AND f.tank_liters_delta IS NOT NULL AND f.pump_liters > 0 
             THEN (ABS(f.pump_liters - f.tank_liters_delta) / f.pump_liters * 100)
             ELSE NULL 
           END as divergence_pct
    FROM fueling_logs f
    LEFT JOIN drivers d ON f.driver_id = d.id
    JOIN trucks t ON f.truck_id = t.id
    LEFT JOIN fuel_stations fs ON f.station_id = fs.id
    LEFT JOIN anp_stations anp ON f.anp_station_id = anp.id
    WHERE 1=1
  `;
  const values = [];
  let idx = 1;
  
  if (truck_id)  { query += ` AND f.truck_id = $${idx++}`;   values.push(truck_id); }
  if (driver_id) { query += ` AND f.driver_id = $${idx++}`;  values.push(driver_id); }
  if (dataSource) { query += ` AND f.data_source = $${idx++}`; values.push(dataSource); }
  if (onlyDivergence === 'true') {
    query += ` AND (
      f.pump_liters IS NOT NULL AND f.tank_liters_delta IS NOT NULL AND f.pump_liters > 0 AND 
      (ABS(f.pump_liters - f.tank_liters_delta) / f.pump_liters * 100) > $${idx++}
    )`;
    values.push(divLimit);
  }
  if (start) { query += ` AND f.timestamp >= $${idx++}::date`; values.push(start); }
  if (end)   { query += ` AND f.timestamp < ($${idx++}::date + INTERVAL '1 day')`; values.push(end); }
  
  query += " ORDER BY f.timestamp DESC";
  return { query, values };
};

