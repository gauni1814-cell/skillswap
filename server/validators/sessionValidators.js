const { body } = require('express-validator');

exports.scheduleSession = [
  body('sessionId').notEmpty().withMessage('sessionId is required'),
  body('date').notEmpty().withMessage('Date is required').isISO8601().withMessage('Invalid date'),
  body('time').notEmpty().withMessage('Time is required').matches(/^([01]?\d|2[0-3]):([0-5]\d)$/).withMessage('Time must be HH:MM'),
  // custom future check will be handled in controller too
];
