const express = require('express');
const reportsController = require('../controllers/reportsController');

const router = express.Router();

router.get('/export', reportsController.exportCSV);

module.exports = router;
