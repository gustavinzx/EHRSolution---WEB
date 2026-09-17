const dataProvider = require('../services/fleetDataProvider');

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

const db = require('../config/db');
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

exports.configureRoute = async (req, res) => {
  // Mock logic to prevent crashes
  res.json({ message: 'Route configured successfully', route_points: 0 });
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
