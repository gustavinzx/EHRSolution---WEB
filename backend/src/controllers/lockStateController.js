const lockStateService = require('../services/lockStateService');

exports.ingest = async (req, res) => {
  try {
    if (!req.truck || req.truck.id !== parseInt(req.params.id, 10)) {
      return res.status(403).json({ error: 'API Key não pertence a este caminhão' });
    }
    const { log, alert } = await lockStateService.recordLockState({
      truckId: req.truck.id,
      body: req.body,
      io: req.io,
    });
    res.status(201).json({ success: true, state: log.derived_state, mismatch: log.mismatch, alert_id: alert ? alert.id : null });
  } catch (error) {
    if (error.status === 400) return res.status(400).json({ error: error.message });
    console.error('Lock state ingest error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
