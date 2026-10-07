const jwt = require('jsonwebtoken');

// Autenticação do painel do gestor. Tokens de motorista (app) são recusados com 403
// para que um motorista não consiga acessar as APIs administrativas.
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization token missing or invalid' });
  }

  const token = authHeader.split(' ')[1];

  let decoded;
  try {
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET is not defined');
    }
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  if (decoded.role === 'driver') {
    return res.status(403).json({ error: 'Acesso restrito ao gestor' });
  }
  req.user = decoded;
  req.actor = { type: 'manager', id: decoded.id, email: decoded.email };
  next();
};

module.exports = authMiddleware;
