const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const driversController = require('../controllers/driversController');
const authMiddleware = require('../middleware/auth');
const requireRole = authMiddleware.requireRole('admin', 'manager');

const router = express.Router();

router.get('/', driversController.list);
router.get('/ranking', driversController.ranking);
router.get('/:id/score', driversController.getScore);

router.post('/', requireRole, [
  body('name').notEmpty().withMessage('Name is required'),
  body('email').optional({ checkFalsy: true }).isEmail().withMessage('Must be a valid email'),
  body('phone').optional()
], validate, driversController.create);

router.put('/:id', requireRole, [
  body('name').notEmpty().withMessage('Name is required'),
  body('email').optional({ checkFalsy: true }).isEmail().withMessage('Must be a valid email'),
  body('phone').optional()
], validate, driversController.update);

router.patch('/:id/deactivate', requireRole, driversController.deactivate);
router.patch('/:id/activate', requireRole, driversController.activate);

router.post('/:id/face/enroll', requireRole, driversController.enrollFace);
router.delete('/:id/face', requireRole, driversController.removeFace);

router.post('/:id/trucks', requireRole, [
  body('truck_id').notEmpty().withMessage('truck_id is required')
], validate, driversController.assignTruck);

module.exports = router;
