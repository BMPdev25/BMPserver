const { body } = require('express-validator');

const updateUserProfileRules = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be 2–50 characters'),
  body('phone').optional().isMobilePhone('en-IN').withMessage('Invalid Indian phone number'),
];

const updatePriestProfileRules = [
  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Bio must be under 500 characters'),
  body('experience')
    .optional()
    .isInt({ min: 0, max: 70 })
    .withMessage('Experience must be between 0 and 70 years'),
  body('services').optional().isArray().withMessage('Services must be an array'),
  body('services.*.price')
    .optional()
    .isFloat({ min: 100, max: 500000 })
    .withMessage('Service price must be between ₹100 and ₹5,00,000'),
  body('services.*.ceremonyId').optional().isMongoId().withMessage('Invalid ceremony ID'),
  body('services.*.durationMinutes')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Duration must be at least 1 minute'),
];

const addAddressRules = [
  body('houseNo').trim().notEmpty().withMessage('House/flat number is required'),
  body('street').trim().notEmpty().withMessage('Street is required'),
  body('city').trim().notEmpty().withMessage('City is required'),
  body('state').trim().notEmpty().withMessage('State is required'),
  body('pincode')
    .notEmpty()
    .withMessage('Pincode is required')
    .matches(/^\d{6}$/)
    .withMessage('Pincode must be exactly 6 digits'),
];

module.exports = {
  updateUserProfileRules,
  updatePriestProfileRules,
  addAddressRules,
};
