const express = require('express');
const facialAttemptsController = require('../controllers/facialAttemptsController');

const router = express.Router();

router.get('/', facialAttemptsController.list);

module.exports = router;
