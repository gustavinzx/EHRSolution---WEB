const db = require('../config/db');
const { detectFuelAnomalies } = require('../services/anomalyDetector');

// GET /api/alerts — return recent alerts (last 24h)
exports.list = async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT * FROM fleet_alerts
      WHERE resolved_at IS NULL
      ORDER BY created_at DESC
      LIMIT 50
    `);
    res.json(rows);
  } catch (err) {
    console.error('List alerts error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// POST /api/alerts/simulate-fuel-drop/:truckId — dev demo endpoint
exports.simulateFuelDrop = async (req, res) => {
  try {
    const { truckId } = req.params;

    const { rows: trucks } = await db.query(
      'SELECT id, plate, model, current_level_liters, capacity_liters FROM trucks WHERE id = $1',
      [truckId]
    );
    if (!trucks.length) return res.status(404).json({ error: 'Truck not found' });

    const truck = trucks[0];
    const cap = parseFloat(truck.capacity_liters);
    const currentLevel = parseFloat(truck.current_level_liters);
    
    // Force a suspicious drop: reduce fuel by 12% without a fueling log
    const dropLiters = cap * 0.12;
    const newLevel = Math.max(0, currentLevel - dropLiters);

    await db.query(
      'UPDATE trucks SET current_level_liters = $1 WHERE id = $2',
      [newLevel, truckId]
    );

    // Insert a telemetry record showing the drop
    const { rows: lastTel } = await db.query(
      'SELECT lat, lng FROM trucks WHERE id = $1',
      [truckId]
    );
    if (lastTel.length) {
      await db.query(
        'INSERT INTO telemetry_logs (truck_id, lat, lng, speed_kmh, fuel_level_liters) VALUES ($1, $2, $3, 60, $4)',
        [truckId, lastTel[0].lat, lastTel[0].lng, newLevel]
      );
      // Insert a prev reading that is higher so the detector sees the drop
      await db.query(
        'INSERT INTO telemetry_logs (truck_id, lat, lng, speed_kmh, fuel_level_liters, timestamp) VALUES ($1, $2, $3, 60, $4, NOW() - INTERVAL \'2 minutes\')',
        [truckId, lastTel[0].lat, lastTel[0].lng, currentLevel]
      );
    }

    // Create the alert immediately (don't wait for next tick)
    const dropPct = (dropLiters / cap) * 100;
    const message = `[DEMO] Queda suspeita de ${dropPct.toFixed(1)}% (${dropLiters.toFixed(1)}L) sem abastecimento registrado.`;
    
    const { rows: inserted } = await db.query(`
      INSERT INTO fleet_alerts (truck_id, type, severity, message, plate, model)
      VALUES ($1, 'suspicious_fuel_drop', 'critical', $2, $3, $4)
      RETURNING *
    `, [truckId, message, truck.plate, truck.model]);

    // Emit via WebSocket in real time
    if (req.io && inserted.length > 0) {
      req.io.emit('newAlert', inserted[0]);
    }

    res.json({ 
      message: 'Fuel drop simulated successfully', 
      alert: inserted[0],
      dropLiters: dropLiters.toFixed(1),
      dropPct: dropPct.toFixed(1)
    });
  } catch (err) {
    console.error('Simulate fuel drop error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// DELETE /api/alerts/:id — dismiss an alert
exports.dismiss = async (req, res) => {
  try {
    await db.query('DELETE FROM fleet_alerts WHERE id = $1', [req.params.id]);
    res.json({ message: 'Alert dismissed' });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.resolve = async (req, res) => {
  try {
    const { id } = req.params;
    const { resolution_note, resolved_by } = req.body;
    
    const { rows } = await db.query(
      `UPDATE fleet_alerts 
       SET resolved_at = NOW(), resolution_note = $1, resolved_by = $2
       WHERE id = $3 AND resolved_at IS NULL
       RETURNING *`,
      [resolution_note || null, resolved_by || null, id]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ error: "Alerta não encontrado ou já resolvido" });
    }
    
    res.json(rows[0]);
  } catch (err) {
    console.error("Resolve alert error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};
