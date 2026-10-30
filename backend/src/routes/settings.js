const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const authMiddleware = require('../middleware/auth');
const requireRole = authMiddleware.requireRole('admin');

router.get('/alerts', authMiddleware, settingsController.getAlertSettings);
router.put('/alerts', authMiddleware, requireRole, settingsController.updateAlertSettings);
router.get('/alerts/history', authMiddleware, settingsController.getAlertSettingsHistory);

module.exports = router;
