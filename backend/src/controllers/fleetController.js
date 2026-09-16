const db = require('../config/db');

exports.list = async (req, res) => {
  try {
    const query = `
      SELECT 
        t.id, t.plate, t.model, t.capacity_liters, t.current_level_liters, 
        t.lat, t.lng, t.speed_kmh, t.status, t.sim_state,
        t.origin_name, t.dest_name, t.route_index, t.created_at,
        json_agg(json_build_object('id', d.id, 'name', d.name)) FILTER (WHERE d.id IS NOT NULL) as current_drivers
      FROM trucks t
      LEFT JOIN driver_trucks dt ON t.id = dt.truck_id
      LEFT JOIN drivers d ON dt.driver_id = d.id AND d.is_active = true
      GROUP BY t.id
      ORDER BY t.created_at DESC
    `;
    
    const result = await db.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('List fleet error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.getOne = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(`
      SELECT t.*, 
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object('id', d.id, 'name', d.name)
          ) FILTER (WHERE d.id IS NOT NULL), 
          '[]'
        ) as current_drivers
      FROM trucks t
      LEFT JOIN driver_trucks dt ON t.id = dt.truck_id
      LEFT JOIN drivers d ON dt.driver_id = d.id AND d.is_active = true
      WHERE t.id = $1
      GROUP BY t.id
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Truck not found' });
    }
    
    const truck = result.rows[0];

    const logsQuery = `
      SELECT fl.*, d.name as driver_name
      FROM fueling_logs fl
      LEFT JOIN drivers d ON fl.driver_id = d.id
      WHERE fl.truck_id = $1
      ORDER BY fl.timestamp DESC
      LIMIT 5
    `;
    
    const logsResult = await db.query(logsQuery, [id]);
    truck.recent_fueling_logs = logsResult.rows;
    
    res.json(truck);
  } catch (error) {
    console.error('Get truck error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.getRoute = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Busca os últimos 100 pontos de telemetria ordenados cronologicamente
    const routeQuery = `
      SELECT lat, lng, speed_kmh, fuel_level_liters, timestamp
      FROM telemetry_logs
      WHERE truck_id = $1
      ORDER BY timestamp ASC
      LIMIT 100
    `;
    
    const result = await db.query(routeQuery, [id]);
    res.json(result.rows);
  } catch (error) {
    console.error('Get route error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.configureRoute = async (req, res) => {
  try {
    const { id } = req.params;
    const { origin, destination } = req.body;

    if (!origin || !destination) {
      return res.status(400).json({ error: 'Origin and destination are required' });
    }

    // 1. Geocoding com Nominatim (OpenStreetMap)
    const getCoords = async (address) => {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`, {
        headers: { 'User-Agent': 'EHR-Fleet-Prototype/1.0' }
      });
      const data = await response.json();
      if (!data || data.length === 0) throw new Error(`Address not found: ${address}`);
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), name: data[0].display_name };
    };

    const originData = await getCoords(origin);
    const destData = await getCoords(destination);

    // 2. Routing com OSRM
    const osrmUrl = `http://router.project-osrm.org/route/v1/driving/${originData.lng},${originData.lat};${destData.lng},${destData.lat}?overview=full&geometries=geojson`;
    const osrmRes = await fetch(osrmUrl);
    const osrmData = await osrmRes.json();

    if (osrmData.code !== 'Ok' || !osrmData.routes || osrmData.routes.length === 0) {
      return res.status(400).json({ error: 'Route could not be calculated' });
    }

    // geometry.coordinates vem no formato [lng, lat]
    const geometry = osrmData.routes[0].geometry.coordinates;

    // 3. Update Truck in Database
    await db.query(`
      UPDATE trucks 
      SET origin_name = $1, dest_name = $2, route_geometry = $3, route_index = 0, lat = $4, lng = $5
      WHERE id = $6
    `, [originData.name, destData.name, JSON.stringify(geometry), originData.lat, originData.lng, id]);

    // Limpar o histórico de telemetria antigo para esse caminhão não ter pulos gigantes
    await db.query(`DELETE FROM telemetry_logs WHERE truck_id = $1`, [id]);

    res.json({ message: 'Route configured successfully', route_points: geometry.length });
  } catch (error) {
    console.error('Configure route error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

// ─── Live Events: últimos abastecimentos + caminhões abastecendo agora ────────
exports.liveEvents = async (req, res) => {
  try {
    // Caminhões abastecendo neste momento
    const { rows: fueling } = await db.query(`
      SELECT id, plate, model, lat, lng, current_level_liters, capacity_liters
      FROM trucks
      WHERE sim_state = 'fueling'
      ORDER BY id
    `);

    // Últimos 8 fueling_logs (última hora)
    const { rows: recent } = await db.query(`
      SELECT fl.id, fl.timestamp, fl.lat, fl.lng,
             fl.level_before, fl.level_after, fl.release_method,
             t.plate, t.model,
             d.name as driver_name
      FROM fueling_logs fl
      JOIN trucks t ON fl.truck_id = t.id
      LEFT JOIN drivers d ON fl.driver_id = d.id
      WHERE fl.timestamp > NOW() - INTERVAL '2 hours'
      ORDER BY fl.timestamp DESC
      LIMIT 8
    `);

    res.json({ fueling_now: fueling, recent_logs: recent });
  } catch (error) {
    console.error('Live events error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

