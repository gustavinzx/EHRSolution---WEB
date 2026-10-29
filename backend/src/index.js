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

const app = express();
const server = http.createServer(app);

if (process.env.TRUST_PROXY !== undefined && process.env.TRUST_PROXY !== '') {
  const rawTp = String(process.env.TRUST_PROXY).trim();
  const parsedTp = rawTp === 'true' ? true : rawTp === 'false' ? false : /^\d+$/.test(rawTp) ? Number(rawTp) : rawTp;
  app.set('trust proxy', parsedTp);
} else if (process.env.NODE_ENV === 'production') {
  console.warn(
    '\n====================================================================\n' +
    '[AVISO DE SEGURANÇA EM PRODUÇÃO] TRUST_PROXY não está definido!\n' +
    'Se o servidor estiver atrás de proxy reverso (Nginx, Cloudflare, Traefik, etc.),\n' +
    'req.ip poderá refletir o IP do proxy em vez do cliente real,\n' +
    'impactando o rate limiting e auditorias. Defina TRUST_PROXY=true ou quantidade de hops.\n' +
    '====================================================================\n'
  );
}

// SECURITY NOTE 2.4: Em produção defina CORS_ORIGINS (lista separada por vírgula). Sem ela, libera tudo (dev / app mobile).
const configuredOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(s => s.trim()).filter(Boolean)
  : [];

const corsOriginValidator = (origin, callback) => {
  if (!origin) return callback(null, true);
  if (configuredOrigins.length > 0) {
    if (configuredOrigins.includes(origin) || configuredOrigins.includes('*')) {
      return callback(null, true);
    }
    return callback(new Error(`Bloqueio CORS: A origem ${origin} não está autorizada.`));
  }
  if (process.env.NODE_ENV !== 'production') {
    return callback(null, true);
  }
  console.warn(`[CORS REJEITADO] Origem web não autorizada em produção: ${origin}. Defina CORS_ORIGINS no .env.`);
  return callback(new Error('Origem não autorizada por política de segurança CORS em produção.'));
};

const allowedOrigin = corsOriginValidator;

const io = new Server(server, {
  cors: {
    origin: allowedOrigin,
    methods: ["GET", "POST"]
  }
});

// Redirecionamento HTTPS forçado em produção (atrás de proxy reverso/load balancer ou direto)
// Exceção mantida exclusivamente para GET /api/health
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.method === 'GET' && req.path === '/api/health') {
      return next();
    }
    const proto = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
    if (proto !== 'https') {
      return res.redirect(301, `https://${req.headers.host}${req.url}`);
    }
    next();
  });
}

// FIX 2.1: Apply helmet for essential HTTP security headers (CSP, HSTS, X-Frame-Options, etc.)
app.use(helmet({
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  contentSecurityPolicy: false,
}));

app.use(cors({
  origin: allowedOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  // CORS justificado: 'x-api-key' é necessário para comunicação dos bocais IoT/hardware com a telemetria
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
}));

// High limit ONLY for facial endpoints
app.post('/api/drivers/:id/face/enroll', express.json({ limit: '3mb' }));
app.post('/api/fueling/sessions/:id/verify-face', express.json({ limit: '3mb' }));
app.use(express.json({ limit: '100kb' }));
app.use(compression());

// General rate limiter para rotas de API da aplicação
if (process.env.NODE_ENV === 'production' && process.env.DISABLE_RATE_LIMIT === 'true') {
  console.warn('[SECURITY WARNING] DISABLE_RATE_LIMIT=true é ignorado em produção. O rate limiter permanece ativo.');
}

const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: process.env.NODE_ENV === 'production' ? 1000 : 5000,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => {
    if (process.env.NODE_ENV === 'production') {
      return false;
    }
    return process.env.DISABLE_RATE_LIMIT === 'true';
  },
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

// Rotas de hardware isoladas (montadas antes do generalLimiter e protegidas por authHardware com limite próprio)
const fleetController = require('./controllers/fleetController');
const authHardware = require('./middleware/authHardware');
app.post('/api/fleet/:id/security-events', authHardware, fleetController.securityEvent);
app.post('/api/fleet/:id/telemetry', authHardware, fleetController.ingestTelemetry);

// Protected routes (JWT auth + general rate limit)
app.use('/api/drivers', generalLimiter, authMiddleware, driversRoutes);
app.use('/api/fleet', generalLimiter, fleetRoutes);
app.use('/api/fueling', generalLimiter, fuelingRoutes);
app.use('/api/reports', generalLimiter, authMiddleware, reportsRoutes);
app.use('/api/alerts', generalLimiter, authMiddleware, require('./routes/alerts'));
app.use('/api/settings', generalLimiter, authMiddleware, require('./routes/settings'));
app.use('/api/facial-attempts', generalLimiter, authMiddleware, require('./routes/facialAttempts'));
app.use('/api/users', generalLimiter, authMiddleware, require('./routes/users'));
app.use('/api/anp', generalLimiter, authMiddleware, require('./routes/anp'));

// Em deploys unificados gratuitos (ex: Render.com), serve o build do Painel Web na mesma porta da API
if (process.env.SERVE_FRONTEND === 'true') {
  const frontendDist = path.join(__dirname, '../../frontend/dist');
  app.use(express.static(frontendDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) return next();
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Payload too large' });
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

require('./services/stationMatcher').validateStationMatchRadius(process.env.STATION_MATCH_RADIUS_M);

if (process.env.NODE_ENV !== 'test') {
  require('./services/jwtValidator').validateJwtSecret(process.env.JWT_SECRET, process.env.NODE_ENV);
  server.listen(PORT, async () => {
    console.log('Server running on port ' + PORT);

    try {
      const { runMigrations } = require('./migrations/runner');
      await runMigrations();
      const { seedIfEmpty } = require('./seed/seedIfEmpty');
      await seedIfEmpty();
    } catch (err) {
      console.error('[MIGRATIONS] Schema init failed:', err.message);
      process.exit(1);
    }

    if (process.env.NODE_ENV !== 'production') {
      console.log('[SIM] Ambiente de desenvolvimento — iniciando simulador de frota.');
      startSimulator(io);
    } else {
      console.log('[SIM] Ambiente de produção — simulador desativado, aguardando telemetria real do hardware.');
    }
    startAnomalyEngine(io);
    // Virtual Hardware Runner (simulação de bomba/trava física)
    const { startVirtualHardware } = require('./services/virtualHardware');
    startVirtualHardware(io);
    const { startRetentionRoutine } = require('./services/retentionService');
    startRetentionRoutine();
  });
}

module.exports = { app, server, io };
