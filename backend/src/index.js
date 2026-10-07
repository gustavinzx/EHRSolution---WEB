const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { startSimulator } = require('./services/simulator');
const { startAnomalyEngine } = require('./services/anomalyDetector');
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

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

// SECURITY NOTE 2.4: Em produção defina CORS_ORIGINS (lista separada por vírgula). Sem ela, libera tudo (dev / app mobile).
const allowedOrigin = process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',').map(s => s.trim()) : '*';

const io = new Server(server, {
  cors: {
    origin: allowedOrigin,
    methods: ["GET", "POST"]
  }
});

// FIX 2.1: Apply helmet for essential HTTP security headers (CSP, HSTS, X-Frame-Options, etc.)
app.use(helmet());
app.use(cors({ origin: allowedOrigin }));
app.use(express.json());
app.use(compression());

// FIX 2.2: General rate limiter for all protected API routes (150 req/min per IP).
// More permissive than the login limiter (10/15min), but prevents accidental DoS.
// SECURITY NOTE 2.3: JWT is stored in localStorage, which is readable by any JS on the page (XSS risk).
// Migrating to httpOnly cookies would eliminate this risk but requires significant refactor.
// Acceptable for an academic/demo project — document and revisit before any public deployment.
const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 150,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas requisições. Aguarde um momento e tente novamente.' }
});

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

// Protected routes (JWT auth + general rate limit)
app.use('/api/drivers', generalLimiter, authMiddleware, driversRoutes);
app.use('/api/fleet', generalLimiter, fleetRoutes);
app.use('/api/fueling', generalLimiter, fuelingRoutes);
app.use('/api/reports', generalLimiter, authMiddleware, reportsRoutes);
app.use('/api/alerts', generalLimiter, authMiddleware, require('./routes/alerts'));

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

server.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);

  try {
    await ensureSecuritySchema();
  } catch (err) {
    console.error('[SECURITY] Schema init failed:', err.message);
  }

  // Simulador é só para demonstração: com hardware real ele sobrescreveria posição/combustível.
  if (process.env.SIMULATOR_ENABLED === 'true') {
    console.log('[SIM] SIMULATOR_ENABLED=true — dados de telemetria serão simulados.');
    startSimulator(io);
  } else {
    console.log('[SIM] Simulador desativado — aguardando telemetria real do hardware.');
  }
  startAnomalyEngine(io);
});
 
 
 
