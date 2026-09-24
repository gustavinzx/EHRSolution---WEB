const dataProvider = require('../services/fleetDataProvider');
const db = require('../config/db');
const security = require('../services/securityService');

exports.list = async (req, res) => {
  try {
    const fleet = await dataProvider.getFleetSnapshot();
    res.json(fleet);
  } catch (error) {
    console.error('List fleet error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.getOne = async (req, res) => {
  try {
    const { id } = req.params;
    const truck = await dataProvider.getTruckTelemetry(id);
    
    if (!truck) {
      return res.status(404).json({ error: 'Truck not found' });
    }
    res.json(truck);
  } catch (error) {
    console.error('Get truck error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.liveEvents = async (req, res) => {
  try {
    const events = await dataProvider.getLiveEvents();
    res.json(events);
  } catch (error) {
    console.error('Live events error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.getRoute = async (req, res) => {
  try {
    const { id } = req.params;
    const route = await dataProvider.getTruckRoute(id);
    res.json(route);
  } catch (error) {
    console.error('Route get error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.forceFueling = async (req, res) => {
  try {
    const { id } = req.params;
    await db.query(`UPDATE trucks SET sim_state = 'fueling', route_phase = 'fueling' WHERE id = $1`, [id]);
    res.json({ success: true, message: 'Simulação de abastecimento forçada para o caminhão ' + id });
  } catch (error) {
    console.error('Force fueling error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// POST /api/fleet/:id/security-events — bridge for device/IoT security signals
exports.securityEvent = async (req, res) => {
  try {
    const { type, severity, source, payload } = req.body || {};
    if (!type) return res.status(400).json({ error: 'O campo type é obrigatório' });
    const result = await security.recordSecurityEvent({ truckId: req.params.id, type, severity, source, payload, io: req.io });
    res.status(201).json(result);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || 'Internal server error' });
  }
};

exports.configureRoute = async (req, res) => {
  const { id } = req.params;
  const { origin, destination } = req.body;

  if (!origin || !origin.lat || !origin.lng || !destination || !destination.lat || !destination.lng) {
    return res.status(400).json({ error: 'Origem e destino incompletos. Por favor, pesquise e selecione um endereço válido.' });
  }

  try {
    const originData = {
      lat: parseFloat(origin.lat),
      lng: parseFloat(origin.lng),
      name: origin.name || 'Origem'
    };
    
    const destData = {
      lat: parseFloat(destination.lat),
      lng: parseFloat(destination.lng),
      name: destination.name || 'Destino'
    };

    const osrmUrl = `http://router.project-osrm.org/route/v1/driving/${originData.lng},${originData.lat};${destData.lng},${destData.lat}?overview=full&geometries=geojson`;
    const osrmRes = await fetch(osrmUrl, { signal: AbortSignal.timeout(8000) });
    const osrmData = await osrmRes.json();

    if (osrmData.code !== 'Ok' || !osrmData.routes || osrmData.routes.length === 0) {
      return res.status(400).json({ error: 'Não foi possível calcular uma rota rodoviária entre esses dois pontos' });
    }

    const geometry = osrmData.routes[0].geometry.coordinates;
    
    await db.query(`
      UPDATE trucks 
      SET origin_name = $1, dest_name = $2, route_geometry = $3, planned_route_geometry = $3, route_phase = 'planned', fuel_station_id = NULL, route_index = 0, lat = $4, lng = $5, sim_state = 'driving', status = 'ok', fueling_ticks = 0, updated_at = NOW()
      WHERE id = $6
    `, [originData.name, destData.name, JSON.stringify(geometry), originData.lat, originData.lng, id]);

    res.json({ 
      message: 'Rota configurada com sucesso', 
      route_points: geometry.length,
      origin: originData.name,
      destination: destData.name
    });

  } catch (error) {
    console.error('Configure route error:', error);
    res.status(500).json({ error: 'Falha interna ao tentar configurar a rota' });
  }
};

exports.getUnloadingEvents = async (req, res) => {
  try {
    const { truck_id, start, end } = req.query;
    const events = await dataProvider.getUnloadingEvents({ truck_id, start, end });
    res.json(events);
  } catch (error) {
    console.error('List unloading events error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.getDashboardStats = async (req, res) => {
  try {
    const stats = await dataProvider.getDashboardStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

const { buildReturnToBase } = require('../services/returnRoute');

exports.cancelRoute = async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await db.query("SELECT * FROM trucks WHERE id=$1", [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Truck not found' });
    const truck = rows[0];

    try {
      const returnRoute = await buildReturnToBase(truck);
      await db.query(`
        UPDATE trucks 
        SET 
          dest_name = origin_name,
          route_geometry = $2,
          planned_route_geometry = $2,
          route_phase = 'returning_to_base',
          fuel_station_id = NULL,
          route_index = 0,
          route_resume_index = NULL,
          sim_state = 'driving',
          fueling_ticks = 0,
          updated_at = NOW()
        WHERE id = $1
      `, [id, JSON.stringify(returnRoute)]);
      return res.json({ success: true, message: 'Viagem cancelada, retornando para a base' });
    } catch (e) {
      console.error('Falha ao traçar rota de retorno:', e.message);
      // Fallback
      await db.query(`
        UPDATE trucks 
        SET 
          route_phase = 'arrived',
          sim_state = 'idle',
          speed_kmh = 0
        WHERE id = $1
      `, [id]);
      return res.json({ success: true, message: 'Viagem parada imediatamente' });
    }
  } catch (error) {
    console.error('Cancel route error:', error);
    res.status(500).json({ error: 'Erro ao cancelar a rota' });
  }
};

exports.getInvestigation = async (req, res) => {
  try {
    const { id } = req.params;
    const { rows: truckRows } = await db.query(
      `SELECT t.*, d.name AS driver_name, d.phone AS driver_phone
       FROM trucks t
       LEFT JOIN driver_trucks dt ON dt.truck_id = t.id
       LEFT JOIN drivers d ON d.id = dt.driver_id AND d.is_active = true
       WHERE t.id = $1 LIMIT 1`, [id]
    );
    if (!truckRows.length) return res.status(404).json({ error: 'Truck not found' });
    const truck = truckRows[0];

    const { rows: telemetry } = await db.query(
      `SELECT timestamp, fuel_level_liters, lat, lng, speed_kmh
       FROM telemetry_logs WHERE truck_id = $1
       ORDER BY timestamp DESC LIMIT 20`, [id]
    );

    const { rows: fuelingLogs } = await db.query(
      `SELECT f.*, fs.name AS station_name, fs.lat AS station_lat, fs.lng AS station_lng,
              d.name AS driver_name
       FROM fueling_logs f
       LEFT JOIN fuel_stations fs ON f.station_id = fs.id
       LEFT JOIN drivers d ON f.driver_id = d.id
       WHERE f.truck_id = $1
       ORDER BY f.timestamp DESC LIMIT 10`, [id]
    );

    const { rows: sessions } = await db.query(
      `SELECT s.*, d.name AS driver_name, fs.name AS station_name
       FROM fueling_sessions s
       LEFT JOIN drivers d ON s.driver_id = d.id
       LEFT JOIN fuel_stations fs ON s.station_id = fs.id
       WHERE s.truck_id = $1
       ORDER BY s.requested_at DESC LIMIT 10`, [id]
    );

    const { rows: alerts } = await db.query(
      `SELECT * FROM fleet_alerts WHERE truck_id = $1
       ORDER BY created_at DESC LIMIT 20`, [id]
    );

    res.json({ truck, telemetry, fuelingLogs, sessions, alerts });
  } catch (error) {
    console.error('Investigation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.ingestTelemetry = async (req, res) => {
  try {
    const { id } = req.params;
    const { fuel_level_liters, lat, lng, speed_kmh } = req.body;

    // Update truck current status
    const { rows: updated } = await db.query(
      `UPDATE trucks SET current_level_liters=$1, lat=$2, lng=$3, speed_kmh=$4 WHERE id=$5 RETURNING *`,
      [fuel_level_liters, lat, lng, speed_kmh, id]
    );

    if (updated.length === 0) return res.status(404).json({ error: 'Truck not found' });

    // Log telemetry
    await db.query(
      `INSERT INTO telemetry_logs (truck_id, lat, lng, speed_kmh, fuel_level_liters) VALUES ($1, $2, $3, $4, $5)`,
      [id, lat, lng, speed_kmh, fuel_level_liters]
    );

    // If io is available, we could emit a fleetUpdate here, but the simulator handles regular sync.
    res.json({ success: true, truck: updated[0] });
  } catch (error) {
    console.error('Ingest telemetry error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
