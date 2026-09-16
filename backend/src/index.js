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

const app = express();

app.use(cors());
app.use(express.json());

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

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  startSimulator();
});
