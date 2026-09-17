const dataProvider = require('../services/fleetDataProvider');

exports.list = async (req, res) => {
  try {
    const { truck_id, driver_id, start, end } = req.query;
    const logs = await dataProvider.getFuelingLogs({ truck_id, driver_id, start, end });
    res.json(logs);
  } catch (error) {
    console.error('List fueling logs error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
