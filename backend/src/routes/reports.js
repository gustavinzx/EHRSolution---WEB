const express = require('express');
const reportsController = require('../controllers/reportsController');

const router = express.Router();

router.get('/export', reportsController.exportCSV);
router.get('/export-pdf', reportsController.exportPDF);

module.exports = router;
