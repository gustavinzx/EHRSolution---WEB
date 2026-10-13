const express = require('express');
const router = express.Router();
const anpController = require('../controllers/anpController');

router.get('/stations', anpController.listStations);
router.get('/stations/summary', anpController.getSummary);
router.get('/stations/in-bounds', anpController.getInBounds);
router.get('/stations/:cnpj', anpController.getByCnpj);

module.exports = router;
