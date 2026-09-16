const express = require('express');
const fuelingController = require('../controllers/fuelingController');

const router = express.Router();

router.get('/', fuelingController.list);

module.exports = router;
