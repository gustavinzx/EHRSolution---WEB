const { startSimulator } = require('./services/simulator');
require('dotenv').config();
const express = require('express');
const cors = require('cors');

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

const allowedOrigin = process.env.FRONTEND_URL || 'http://localhost:5173';

const io = new Server(server, {
  cors: {
    origin: allowedOrigin,
    methods: ["GET", "POST"]
  }
});

app.use(cors({ origin: allowedOrigin }));
app.use(express.json());

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

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  startSimulator(io);
});
