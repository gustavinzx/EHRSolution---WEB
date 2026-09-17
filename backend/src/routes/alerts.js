const express = require('express');
const alertsController = require('../controllers/alertsController');

const router = express.Router();

router.get('/', alertsController.list);
router.post('/simulate-fuel-drop/:truckId', alertsController.simulateFuelDrop);
router.delete('/:id', alertsController.dismiss);

module.exports = router;
