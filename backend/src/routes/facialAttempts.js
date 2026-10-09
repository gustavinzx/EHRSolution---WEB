const express = require('express');
const facialAttemptsController = require('../controllers/facialAttemptsController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.get('/', authMiddleware, facialAttemptsController.list);

module.exports = router;
