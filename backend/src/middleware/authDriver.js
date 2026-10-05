const jwt = require('jsonwebtoken');

const authDriver = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Driver Authorization token missing or invalid' });
  }

  const token = authHeader.split(' ')[1];

  try {
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET is not defined');
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'driver') {
        return res.status(403).json({ error: 'Forbidden: Drivers only' });
    }
    req.driver = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired driver token' });
  }
};

module.exports = authDriver;
