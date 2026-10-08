const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const authMiddleware = require('../middleware/auth');

router.get('/alerts', authMiddleware, settingsController.getAlertSettings);
router.put('/alerts', authMiddleware, settingsController.updateAlertSettings);

module.exports = router;
