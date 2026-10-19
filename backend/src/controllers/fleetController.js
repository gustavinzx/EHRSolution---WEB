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
    if (!req.truck || req.truck.id !== parseInt(req.params.id, 10)) {
      return res.status(403).json({ error: 'API Key não pertence a este caminhão' });
    }
    const { type, severity, source, payload } = req.body || {};
    if (!type) return res.status(400).json({ error: 'O campo type é obrigatório' });
    const allowedSeverity = ['low', 'medium', 'high', 'critical'];
    const result = await security.recordSecurityEvent({
      truckId: req.truck.id, type: String(type).slice(0, 50),
      severity: allowedSeverity.includes(severity) ? severity : undefined,
      source: source || 'device', payload, io: req.io,
    });
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
const { FUELING_LOG_BASE_COLS, formatFuelingLogRow } = require('../services/fuelingQuery');

exports.cancelRoute = async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await db.query(
      "SELECT id, plate, model, lat, lng, origin_name, dest_name, route_geometry, planned_route_geometry, route_index, route_resume_index FROM trucks WHERE id=$1",
      [id]
    );
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
      `SELECT t.id, t.plate, t.model, t.capacity_liters, t.current_level_liters, t.lat, t.lng, t.status, t.speed_kmh, t.sim_state, t.route_phase, t.route_index, t.route_resume_index, t.route_progress, t.fuel_station_id, t.fueling_ticks, t.origin_name, t.dest_name, t.route_geometry, t.planned_route_geometry, t.created_at, d.name AS driver_name, d.phone AS driver_phone
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

    const { rows: rawFuelingLogs } = await db.query(
      `SELECT ${FUELING_LOG_BASE_COLS},
              COALESCE(f.station_name, fs.name) AS station_name,
              fs.lat AS station_lat, fs.lng AS station_lng,
              d.name AS driver_name,
              anp.cnpj AS anp_cnpj, anp.razao_social AS anp_razao_social,
              anp.municipio AS anp_municipio, anp.uf AS anp_uf, anp.bandeira AS anp_bandeira
       FROM fueling_logs f
       LEFT JOIN fuel_stations fs ON f.station_id = fs.id
       LEFT JOIN drivers d ON f.driver_id = d.id
       LEFT JOIN anp_stations anp ON f.anp_station_id = anp.id
       WHERE f.truck_id = $1
       ORDER BY f.timestamp DESC LIMIT 10`, [id]
    );
    const fuelingLogs = rawFuelingLogs.map(formatFuelingLogRow);

    const { rows: sessions } = await db.query(
      `SELECT s.id, s.truck_id, s.driver_id, s.status, s.release_method,
              s.station_id, s.pump_liters, s.tank_liters_delta,
              s.requested_at, s.authorized_at, s.started_at, s.completed_at, s.expires_at,
              s.duration_minutes, s.data_source,
              d.name AS driver_name, fs.name AS station_name
       FROM fueling_sessions s
       LEFT JOIN drivers d ON s.driver_id = d.id
       LEFT JOIN fuel_stations fs ON s.station_id = fs.id
       WHERE s.truck_id = $1
       ORDER BY s.requested_at DESC LIMIT 10`, [id]
    );

    const { rows: alerts } = await db.query(
      `SELECT id, truck_id, type, severity, message, plate, model, resolved_at, resolved_by, resolution_note, created_at, fueling_log_id
       FROM fleet_alerts WHERE truck_id = $1
       ORDER BY created_at DESC LIMIT 20`, [id]
    );

    res.json({ truck, telemetry, fuelingLogs, sessions, alerts });
  } catch (error) {
    console.error('Investigation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

let lastBroadcast = 0;
async function broadcastFleet(io) {
  if (!io) return;
  const now = Date.now();
  if (now - lastBroadcast < 1000) return; // no máximo 1x por segundo
  lastBroadcast = now;
  try {
    io.emit('fleetUpdate', await dataProvider.getFleetSnapshot());
  } catch (e) {
    console.error('Broadcast fleet error:', e.message);
  }
}
exports.broadcastFleet = broadcastFleet;

exports.ingestTelemetry = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!req.truck || req.truck.id !== id) {
      return res.status(403).json({ error: 'API Key não pertence a este caminhão' });
    }
    const num = (v) => (v === undefined || v === null || v === '' ? null : Number(v));
    const fuel = num(req.body.fuel_level_liters);
    const lat = num(req.body.lat);
    const lng = num(req.body.lng);
    const speed = num(req.body.speed_kmh);

    if ([fuel, lat, lng, speed].some(v => v !== null && !Number.isFinite(v))) {
      return res.status(400).json({ error: 'Valores de telemetria inválidos' });
    }
    if ((lat !== null && Math.abs(lat) > 90) || (lng !== null && Math.abs(lng) > 180)) {
      return res.status(400).json({ error: 'Coordenadas fora do intervalo válido' });
    }

    const { rows: updated } = await db.query(
      `UPDATE trucks SET
         current_level_liters = COALESCE($1, current_level_liters),
         lat = COALESCE($2, lat), lng = COALESCE($3, lng),
         speed_kmh = COALESCE($4, speed_kmh),
         status = CASE
           WHEN status = 'security_alert' THEN status
           WHEN COALESCE($1, current_level_liters) < capacity_liters * 0.2 THEN 'low_fuel'
           ELSE 'ok' END,
         updated_at = NOW()
       WHERE id=$5 RETURNING id, status, current_level_liters, lat, lng, speed_kmh`,
      [fuel, lat, lng, speed, id]
    );
    if (updated.length === 0) return res.status(404).json({ error: 'Truck not found' });
    const t = updated[0];

    await db.query(
      `INSERT INTO telemetry_logs (truck_id, lat, lng, speed_kmh, fuel_level_liters) VALUES ($1, $2, $3, $4, $5)`,
      [id, t.lat ?? 0, t.lng ?? 0, t.speed_kmh ?? 0, t.current_level_liters]
    );

    broadcastFleet(req.io);
    res.json({ success: true, truck: { id: t.id, status: t.status } });
  } catch (error) {
    console.error('Ingest telemetry error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.createTruck = async (req, res) => {
  try {
    const { plate, model, capacity_liters, current_level_liters } = req.body;
    if (!plate || !model || !capacity_liters) {
      return res.status(400).json({ error: 'Placa, modelo e capacidade são obrigatórios.' });
    }
    const cap = parseFloat(capacity_liters);
    if (isNaN(cap) || cap <= 0) {
      return res.status(400).json({ error: 'Capacidade deve ser um número positivo.' });
    }
    const lvl = current_level_liters != null && !isNaN(parseFloat(current_level_liters)) ? parseFloat(current_level_liters) : cap;
    const plateUpper = String(plate).trim().toUpperCase();
    const modelTrim = String(model).trim();
    
    const { rows } = await db.query(
      `INSERT INTO trucks (plate, model, capacity_liters, current_level_liters, status, sim_state)
       VALUES ($1, $2, $3, $4, 'ok', 'idle')
       RETURNING id, plate, model, capacity_liters, current_level_liters, status, created_at`,
      [plateUpper, modelTrim, cap, lvl]
    );
    broadcastFleet(req.io);
    res.status(201).json(rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Já existe um caminhão cadastrado com esta placa.' });
    }
    console.error('Create truck error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const crypto = require('crypto');

function parseTruckIdParam(rawId) {
  const str = String(rawId ?? '');
  if (!/^\d+$/.test(str)) return null;
  const num = Number(str);
  if (!Number.isSafeInteger(num) || num <= 0) return null;
  return num;
}

exports.generateHardwareKey = async (req, res) => {
  try {
    const truckId = parseTruckIdParam(req.params.id);
    if (!truckId) {
      return res.status(400).json({ error: 'id inválido' });
    }

    const rawKey = crypto.randomBytes(32).toString('hex');

    const { rows } = await db.query(
      `UPDATE trucks
       SET api_key = $2,
           api_key_last_used_at = NULL
       WHERE id = $1
       RETURNING id, api_key_prefix AS prefix, api_key_created_at AS created_at`,
      [truckId, rawKey]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Caminhão não encontrado' });
    }

    try {
      await security.recordSecurityEvent({
        truckId,
        type: 'hardware_key_generated',
        severity: 'low',
        source: 'manager',
        payload: {
          user_id: req.user?.id || null,
          truck_id: truckId,
        },
        io: req.io,
      });
    } catch (eventErr) {
      console.error(`Failed to record hardware_key_generated security event for truck #${truckId}:`, eventErr.message || eventErr);
    }

    return res.status(201).json({
      api_key: rawKey,
      prefix: rows[0].prefix,
      created_at: rows[0].created_at,
    });
  } catch (error) {
    console.error('Generate hardware key error:', error.message || error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

exports.getHardwareKeyStatus = async (req, res) => {
  try {
    const truckId = parseTruckIdParam(req.params.id);
    if (!truckId) {
      return res.status(400).json({ error: 'id inválido' });
    }

    const { rows } = await db.query(
      `SELECT id,
              (api_key_hash IS NOT NULL) AS configured,
              api_key_prefix AS prefix,
              api_key_created_at AS created_at,
              api_key_last_used_at AS last_used_at
       FROM trucks
       WHERE id = $1`,
      [truckId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Caminhão não encontrado' });
    }

    const row = rows[0];
    const configured = Boolean(row.configured);
    return res.json({
      configured,
      prefix: configured ? row.prefix : null,
      created_at: configured ? row.created_at : null,
      last_used_at: configured ? row.last_used_at : null,
    });
  } catch (error) {
    console.error('Get hardware key status error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

exports.revokeHardwareKey = async (req, res) => {
  try {
    const truckId = parseTruckIdParam(req.params.id);
    if (!truckId) {
      return res.status(400).json({ error: 'id inválido' });
    }

    const { rows } = await db.query(
      `UPDATE trucks
       SET api_key = NULL,
           api_key_hash = NULL,
           api_key_prefix = NULL,
           api_key_created_at = NULL,
           api_key_last_used_at = NULL
       WHERE id = $1
       RETURNING id`,
      [truckId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Caminhão não encontrado' });
    }

    try {
      await security.recordSecurityEvent({
        truckId,
        type: 'hardware_key_revoked',
        severity: 'low',
        source: 'manager',
        payload: {
          user_id: req.user?.id || null,
          truck_id: truckId,
        },
        io: req.io,
      });
    } catch (eventErr) {
      console.error(`Failed to record hardware_key_revoked security event for truck #${truckId}:`, eventErr.message || eventErr);
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('Revoke hardware key error:', error.message || error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};


