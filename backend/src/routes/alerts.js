const express = require('express');
const alertsController = require('../controllers/alertsController');
const authMiddleware = require('../middleware/auth');
const requireRole = authMiddleware.requireRole('admin', 'manager');

const router = express.Router();

router.get('/', authMiddleware, alertsController.list);

// Task 2: Protect simulation endpoint
router.post('/simulate-fuel-drop/:truckId', (req, res, next) => {
  if (process.env.SIMULATOR_ENABLED === 'true' && process.env.NODE_ENV !== 'production') {
    return alertsController.simulateFuelDrop(req, res, next);
  }
  return res.status(404).json({ error: 'Not found or simulation disabled' });
});

// Task 1: Immutable Alerts
router.patch('/:id/resolve', authMiddleware, requireRole, alertsController.resolve);

module.exports = router;
