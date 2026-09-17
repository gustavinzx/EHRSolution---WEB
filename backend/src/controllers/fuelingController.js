"use strict";
const db = require("../config/db");

// ─── Fueling Logs ────────────────────────────────────────────────────────────
exports.list = async (req, res) => {
  try {
    const { truck_id, driver_id, start, end } = req.query;
    let query = `
      SELECT f.*, d.name as driver_name, t.plate, t.model,
             fs.name as station_name
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
    if (start)     { query += ` AND f.timestamp >= $${idx++}`; values.push(start); }
    if (end)       { query += ` AND f.timestamp <= $${idx++}`; values.push(end); }
    query += " ORDER BY f.timestamp DESC LIMIT 100";
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
    const { truck_id, driver_id, station_id, release_method } = req.body;
    if (!truck_id) return res.status(400).json({ error: "truck_id e obrigatorio" });

    // Check no active session
    const { rows: active } = await db.query(
      "SELECT id FROM fueling_sessions WHERE truck_id=$1 AND status IN ('requested','authorized','active') LIMIT 1",
      [truck_id]
    );
    if (active.length > 0) {
      return res.status(409).json({ error: "Ja existe uma sessao ativa para este caminhao", session_id: active[0].id });
    }

    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 min
    const { rows } = await db.query(
      `INSERT INTO fueling_sessions (truck_id, driver_id, station_id, release_method, expires_at)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [truck_id, driver_id||null, station_id||null, release_method||"facial", expiresAt]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error("Request session error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.authorizeSession = async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await db.query(
      `UPDATE fueling_sessions SET status='authorized', authorized_at=NOW()
       WHERE id=$1 AND status='requested' RETURNING *`,
      [id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Sessao nao encontrada ou ja autorizada" });

    // Update truck phase to fueling
    await db.query(
      "UPDATE trucks SET route_phase='fueling', sim_state='fueling', fueling_ticks=0 WHERE id=$1",
      [rows[0].truck_id]
    );
    res.json(rows[0]);
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
    if (sessions.length === 0) return res.status(404).json({ error: "Sessao nao encontrada ou nao esta ativa" });

    const session = sessions[0];

    // Get truck info
    const { rows: trucks } = await db.query(
      "SELECT t.*, fs.name AS station_name FROM trucks t LEFT JOIN fuel_stations fs ON t.fuel_station_id=fs.id WHERE t.id=$1",
      [session.truck_id]
    );
    if (trucks.length === 0) return res.status(404).json({ error: "Caminhao nao encontrado" });
    const truck = trucks[0];

    const levelBefore = parseFloat(truck.current_level_liters);
    const levelAfter  = parseFloat(truck.capacity_liters);
    const volume      = levelAfter - levelBefore;
    const now         = new Date();
    const startedAt   = session.authorized_at || session.requested_at;
    const durationMin = (now - new Date(startedAt)) / 60000;

    // Create single fueling_log
    await db.query(
      `INSERT INTO fueling_logs
         (driver_id, truck_id, lat, lng, level_before, level_after, release_method,
          station_id, station_name, started_at, completed_at, duration_minutes, volume_liters)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [session.driver_id, session.truck_id, truck.lat, truck.lng,
       levelBefore, levelAfter, session.release_method || "facial",
       session.station_id, truck.station_name || null,
       startedAt, now, durationMin.toFixed(1), volume]
    );

    // Mark session complete
    await db.query(
      "UPDATE fueling_sessions SET status='completed', completed_at=NOW() WHERE id=$1",
      [id]
    );

    // Restore truck to planned route
    const resumeIndex = parseInt(truck.route_resume_index) || 0;
    const plannedRoute = truck.planned_route_geometry
      ? (typeof truck.planned_route_geometry === "string" ? truck.planned_route_geometry : JSON.stringify(truck.planned_route_geometry))
      : truck.route_geometry;

    await db.query(`
      UPDATE trucks SET
        current_level_liters=$1, speed_kmh=0, status='ok',
        sim_state='driving', route_phase='planned',
        fueling_ticks=0, fuel_station_id=NULL,
        route_geometry=$2, route_index=$3
      WHERE id=$4
    `, [levelAfter, plannedRoute, resumeIndex, session.truck_id]);

    res.json({ success: true, volume_liters: volume, duration_minutes: durationMin.toFixed(1) });
  } catch (err) {
    console.error("Finish session error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.getActiveSession = async (req, res) => {
  try {
    const { truckId } = req.params;
    const { rows } = await db.query(
      `SELECT s.*, fs.name AS station_name, d.name AS driver_name
       FROM fueling_sessions s
       LEFT JOIN fuel_stations fs ON s.station_id = fs.id
       LEFT JOIN drivers d ON s.driver_id = d.id
       WHERE s.truck_id=$1 AND s.status IN ('requested','authorized','active')
       ORDER BY s.requested_at DESC LIMIT 1`,
      [truckId]
    );
    res.json(rows[0] || null);
  } catch (err) {
    console.error("Get active session error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};
