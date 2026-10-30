const express = require('express');
const alertsController = require('../controllers/alertsController');
const authMiddleware = require('../middleware/auth');
const requireRole = authMiddleware.requireRole('admin', 'manager');

const router = express.Router();

router.get('/', authMiddleware, alertsController.list);

// Task 1: Immutable Alerts
router.patch('/:id/resolve', authMiddleware, requireRole, alertsController.resolve);

module.exports = router;
