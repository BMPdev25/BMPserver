const { body } = require('express-validator')

const createBookingRules = [
  body('priestId')
    .notEmpty().withMessage('Priest ID is required')
    .isMongoId().withMessage('Invalid priest ID'),
  body('ceremonyType')
    .trim()
    .notEmpty().withMessage('Ceremony type is required')
    .isLength({ max: 100 }).withMessage('Ceremony type too long'),
  body('date')
    .notEmpty().withMessage('Date is required')
    .isISO8601().withMessage('Date must be a valid date (YYYY-MM-DD)')
    .custom(value => {
      if (new Date(value) < new Date().setHours(0, 0, 0, 0)) {
        throw new Error('Booking date cannot be in the past')
      }
      return true
    }),
  body('startTime')
    .notEmpty().withMessage('Start time is required')
    .matches(/^\d{2}:\d{2}$/).withMessage('Start time must be HH:MM'),
  body('endTime')
    .notEmpty().withMessage('End time is required')
    .matches(/^\d{2}:\d{2}$/).withMessage('End time must be HH:MM')
    .custom((value, { req }) => {
      if (value <= req.body.startTime) {
        throw new Error('End time must be after start time')
      }
      return true
    }),
  body('location.address')
    .notEmpty().withMessage('Location address is required')
    .isLength({ max: 300 }).withMessage('Address too long'),
  body('location.city')
    .notEmpty().withMessage('Location city is required')
    .isLength({ max: 100 }).withMessage('City name too long'),
]

const verifyPaymentRules = [
  body('bookingId')
    .notEmpty().withMessage('Booking ID is required')
    .isMongoId().withMessage('Invalid booking ID'),
  body('rzpPaymentId')
    .notEmpty().withMessage('Payment ID is required'),
  body('rzpOrderId')
    .notEmpty().withMessage('Order ID is required'),
  body('rzpSignature')
    .notEmpty().withMessage('Signature is required'),
]

const cancelBookingRules = [
  body('reason')
    .optional()
    .isLength({ max: 200 }).withMessage('Reason must be under 200 characters'),
]

module.exports = { createBookingRules, verifyPaymentRules, cancelBookingRules }
