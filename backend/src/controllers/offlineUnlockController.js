const offlineUnlockService = require('../services/offlineUnlockService');

exports.issueToken = async (req, res) => {
  try {
    const sessionId = parseInt(req.params.id, 10);
    const token = await offlineUnlockService.issueSessionUnlockToken({
      sessionId,
      actor: req.actor,
    });
    res.status(200).json(token);
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error('Issue offline unlock token error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
