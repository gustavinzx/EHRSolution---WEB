const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const authController = require('../controllers/authController');
const authDriver = require('../middleware/authDriver');
const rateLimit = require('express-rate-limit');

const router = express.Router();

// keyGenerator combinando IP e e-mail normalizado: um IP compartilhado não bloqueia outros usuários
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10, // limite de 10 requisições por (IP + e-mail) na janela de tempo
  keyGenerator: (req) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    return `${ip}:${email}`;
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { keyGeneratorIpFallback: false },
  message: { error: 'Muitas tentativas de login. Tente novamente após 15 minutos.' }
});

router.post('/login', loginLimiter, [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required')
], validate, authController.login);

router.post('/driver/login', loginLimiter, [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required')
], validate, authController.driverLogin);

router.get('/driver/me', authDriver, authController.driverMe);

module.exports = router;
