const { startSimulator } = require('./services/simulator');
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const compression = require('compression');

const authMiddleware = require('./middleware/auth');
const authRoutes = require('./routes/auth');
const driversRoutes = require('./routes/drivers');
const fleetRoutes = require('./routes/fleet');
const fuelingRoutes = require('./routes/fueling');
const reportsRoutes = require('./routes/reports');

const http = require('http');
const { Server } = require('socket.io');
const { ensureSecuritySchema } = require('./services/securityService');

const app = express();
const server = http.createServer(app);

const allowedOrigin = process.env.FRONTEND_URL || 'http://localhost:5173';

const io = new Server(server, {
  cors: {
    origin: allowedOrigin,
    methods: ["GET", "POST"]
  }
});

app.use(cors({ origin: allowedOrigin }));
app.use(express.json());
app.use(compression());

// Make io accessible in requests if needed
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Public routes
app.use('/api/auth', authRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Protected routes
app.use('/api/drivers', authMiddleware, driversRoutes);
app.use('/api/fleet', authMiddleware, fleetRoutes);
app.use('/api/fueling', authMiddleware, fuelingRoutes);
app.use('/api/reports', authMiddleware, reportsRoutes);
app.use('/api/alerts', authMiddleware, require('./routes/alerts'));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

const jwt = require('jsonwebtoken');
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('Authentication error'));
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = decoded;
    next();
  } catch (err) {
    next(new Error('Authentication error'));
  }
});

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  
  console.log(`Server running on port ${PORT}`);
  
  // Verificação de segurança: rotas ausentes
  const db = require('./config/db');
  db.query('SELECT COUNT(*) FROM trucks WHERE route_geometry IS NULL')
    .then(res => {
      const count = parseInt(res.rows[0].count);
      if (count > 0) {
        console.warn(`\n[AVISO CRÍTICO] Existem ${count} caminhões sem rota calculada (route_geometry IS NULL).`);
        console.warn('[AVISO CRÍTICO] O simulador não moverá esses caminhões. Rode "npm run seed" para repopular as rotas!\n');
      }
    })
    .catch(console.error);

  startSimulator(io);
  ensureSecuritySchema().catch(err => console.error('[SECURITY] Schema init failed:', err.message));

});
