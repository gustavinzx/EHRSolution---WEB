const auditImportService = require('../services/auditImportService');

exports.importCsv = async (req, res) => {
  try {
    if (!req.truck || req.truck.id !== parseInt(req.params.id, 10)) {
      return res.status(403).json({ error: 'API Key não pertence a este caminhão' });
    }
    if (typeof req.body !== 'string') {
      return res.status(415).json({ error: 'Content-Type deve ser text/csv' });
    }
    const result = await auditImportService.importAudit({ truckId: req.truck.id, csv: req.body });
    res.status(201).json({ success: true, ...result });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    console.error('Audit import error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
