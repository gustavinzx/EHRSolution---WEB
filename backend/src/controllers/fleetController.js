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
    await db.query(`UPDATE trucks SET sim_state = 'fueling' WHERE id = $1`, [id]);
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

  if (!origin || !destination) {
    return res.status(400).json({ error: 'Os campos origin e destination são obrigatórios' });
  }
  if (!String(origin).includes(',') || !String(destination).includes(',')) {
    return res.status(400).json({ error: 'Informe origem e destino no formato Cidade, UF (ex.: Brasília, DF)' });
  }
  const normalizePlace = (value) => {
    const [city, ...stateParts] = String(value).split(',');
    const state = stateParts.join(',').trim();
    if (!city.trim() || !state || state.length < 2) return null;
    return `${city.trim()}, ${state.length === 2 ? state.toUpperCase() : state}`;
  };
  const normalizedOrigin = normalizePlace(origin);
  const normalizedDestination = normalizePlace(destination);
  if (!normalizedOrigin || !normalizedDestination) {
    return res.status(400).json({ error: 'Use o padrão Cidade, UF ou Cidade, Estado para qualquer local do Brasil' });
  }

  const getCoords = async (address) => {
    try {
      const response = await fetch('https://nominatim.openstreetmap.org/search?q=' + encodeURIComponent(address) + '&format=json&limit=1', {
        headers: { 'User-Agent': 'EHR-Fleet-Platform/1.0' }
      });
      const data = await response.json();
      if (!data || data.length === 0) return null;
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), name: data[0].display_name };
    } catch (e) {
      console.error('Geocoding failed:', e);
      return null;
    }
  };

  try {
    const originData = await getCoords(normalizedOrigin);
    if (!originData) {
      return res.status(400).json({ error: `Não foi possível encontrar as coordenadas para a origem: ${origin}` });
    }

    const destData = await getCoords(normalizedDestination);
    if (!destData) {
      return res.status(400).json({ error: `Não foi possível encontrar as coordenadas para o destino: ${destination}` });
    }

    const osrmUrl = `http://router.project-osrm.org/route/v1/driving/${originData.lng},${originData.lat};${destData.lng},${destData.lat}?overview=full&geometries=geojson`;
    const osrmRes = await fetch(osrmUrl);
    const osrmData = await osrmRes.json();

    if (osrmData.code !== 'Ok' || !osrmData.routes || osrmData.routes.length === 0) {
      return res.status(400).json({ error: 'Não foi possível calcular uma rota rodoviária entre esses dois pontos' });
    }

    const geometry = osrmData.routes[0].geometry.coordinates;
    
    await db.query(`
      UPDATE trucks 
      SET origin_name = $1, dest_name = $2, route_geometry = $3, planned_route_geometry = $3, route_phase = 'planned', fuel_station_id = NULL, route_index = 0, lat = $4, lng = $5, sim_state = 'driving', status = 'ok', fueling_ticks = 0, updated_at = NOW()
      WHERE id = $6
    `, [normalizedOrigin, normalizedDestination, JSON.stringify(geometry), originData.lat, originData.lng, id]);

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
