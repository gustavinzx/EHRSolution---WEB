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

exports.list = async (req, res) => {
  try {
    const truckId = parseInt(req.params.id, 10);
    if (!Number.isInteger(truckId) || truckId <= 0) {
      return res.status(400).json({ error: 'id inválido' });
    }
    const data = await lockStateService.listLockStates({
      truckId,
      cursorId: req.query.cursor,
      limit: req.query.limit,
    });
    res.status(200).json(data);
  } catch (error) {
    if (error.status === 400) return res.status(400).json({ error: error.message });
    console.error('Lock state list error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
