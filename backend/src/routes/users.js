const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const usersController = require('../controllers/usersController');
const authMiddleware = require('../middleware/auth');
const requireRole = authMiddleware.requireRole('admin');

const router = express.Router();

router.get('/', authMiddleware, requireRole, usersController.list);
router.post('/', authMiddleware, requireRole, [
  body('email').isEmail().withMessage('Must be a valid email'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters long'),
  body('name').notEmpty().withMessage('Name is required'),
  body('role').isIn(['admin', 'manager', 'auditor']).withMessage('Invalid role')
], validate, usersController.create);
router.patch('/:id', authMiddleware, requireRole, [
  body('role').optional().isIn(['admin', 'manager', 'auditor']).withMessage('Invalid role'),
  body('is_active').optional().isBoolean()
], validate, usersController.update);

router.patch('/:id/password', authMiddleware, requireRole, [
  body('password').isLength({ min: 8 }).withMessage('A senha deve ter pelo menos 8 caracteres')
], validate, usersController.updatePassword);

module.exports = router;

