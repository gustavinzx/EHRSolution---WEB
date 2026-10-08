const db = require('../config/db');
const { getAlertSettings } = require('./fuelRules');

exports.buildFuelingLogsQuery = async (filters = {}) => {
  const { truck_id, driver_id, start, end, dataSource, onlyDivergence } = filters;
  const settings = await getAlertSettings();
  const divLimit = settings.divergence_pct || 5;

  let query = `
    SELECT f.*, d.name as driver_name, t.plate, t.model,
           COALESCE(fs.name, f.station_name) as station_name,
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
