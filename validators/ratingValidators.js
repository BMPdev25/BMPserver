const { body } = require('express-validator')

const submitRatingRules = [
  body('bookingId')
    .notEmpty().withMessage('Booking ID is required')
    .isMongoId().withMessage('Invalid booking ID'),
  body('priestId')
    .notEmpty().withMessage('Priest ID is required')
    .isMongoId().withMessage('Invalid priest ID'),
  body('rating')
    .notEmpty().withMessage('Rating is required')
    .isInt({ min: 1, max: 5 })
      .withMessage('Rating must be an integer between 1 and 5'),
  body('categories.punctuality')
    .notEmpty().withMessage('Punctuality rating is required')
    .isInt({ min: 1, max: 5 }),
  body('categories.knowledge')
    .notEmpty().withMessage('Knowledge rating is required')
    .isInt({ min: 1, max: 5 }),
  body('categories.behavior')
    .notEmpty().withMessage('Behavior rating is required')
    .isInt({ min: 1, max: 5 }),
  body('categories.overall')
    .notEmpty().withMessage('Overall rating is required')
    .isInt({ min: 1, max: 5 }),
  body('ceremonyType')
    .notEmpty().withMessage('Ceremony type is required'),
  body('ceremonyDate')
    .notEmpty().withMessage('Ceremony date is required'),
  body('review')
    .optional()
    .isLength({ max: 500 })
      .withMessage('Review must be under 500 characters'),
]

module.exports = { submitRatingRules }
