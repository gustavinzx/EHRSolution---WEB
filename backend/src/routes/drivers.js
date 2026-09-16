const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const driversController = require('../controllers/driversController');

const router = express.Router();

router.get('/', driversController.list);

router.post('/', [
  body('name').notEmpty().withMessage('Name is required'),
  body('email').optional({ checkFalsy: true }).isEmail().withMessage('Must be a valid email'),
  body('phone').optional()
], validate, driversController.create);

router.put('/:id', [
  body('name').notEmpty().withMessage('Name is required'),
  body('email').optional({ checkFalsy: true }).isEmail().withMessage('Must be a valid email'),
  body('phone').optional()
], validate, driversController.update);

router.patch('/:id/deactivate', driversController.deactivate);

router.post('/:id/trucks', [
  body('truck_id').notEmpty().withMessage('truck_id is required')
], validate, driversController.assignTruck);

module.exports = router;
