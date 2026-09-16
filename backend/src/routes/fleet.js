const express = require('express');
const fleetController = require('../controllers/fleetController');

const router = express.Router();

router.get('/live-events', fleetController.liveEvents);
router.get('/', fleetController.list);
router.get('/:id', fleetController.getOne);
router.get('/:id/route', fleetController.getRoute);
router.post('/:id/route', fleetController.configureRoute);

module.exports = router;

