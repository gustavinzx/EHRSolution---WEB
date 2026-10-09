const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/db');

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const emailNorm = email.toLowerCase().trim();
    const result = await db.query('SELECT * FROM users WHERE email = $1', [emailNorm]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = result.rows[0];
    if (user.is_active === false) {
      return res.status(401).json({ error: 'User is deactivated' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET is not defined in environment variables');
    }

    const role = user.role || 'manager';

    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name, role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.driverLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const emailNorm = email.toLowerCase().trim();
    // Find driver
    const result = await db.query('SELECT * FROM drivers WHERE email = $1 AND is_active = true', [emailNorm]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const driver = result.rows[0];
    const isMatch = await bcrypt.compare(password, driver.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    // Get assigned truck
    const truckRes = await db.query(`
      SELECT t.* FROM trucks t
      JOIN driver_trucks dt ON dt.truck_id = t.id
      WHERE dt.driver_id = $1
      LIMIT 1
    `, [driver.id]);
    
    const vehicle = truckRes.rows.length > 0 ? truckRes.rows[0] : null;

    if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not defined');

    const token = jwt.sign(
      { id: driver.id, email: driver.email, name: driver.name, role: 'driver' },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      token,
      driver: {
        id: driver.id,
        name: driver.name,
        email: driver.email,
        phone: driver.phone
      },
      vehicle: vehicle ? {
        id: vehicle.id,
        plate: vehicle.plate,
        model: vehicle.model,
        brand: vehicle.model.split(' ')[0],
        capacity: vehicle.capacity_liters
      } : null
    });
  } catch (error) {
    console.error('Driver Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

