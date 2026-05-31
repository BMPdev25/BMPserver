const { body } = require('express-validator')

const registerRules = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required')
    .isLength({ min: 2, max: 50 })
      .withMessage('Name must be 2–50 characters'),
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Invalid email address')
    .normalizeEmail(),
  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters'),
  body('userType')
    .notEmpty().withMessage('User type is required')
    .isIn(['devotee', 'priest'])
      .withMessage('User type must be devotee or priest'),
  body('phone')
    .optional()
    .isMobilePhone('en-IN')
      .withMessage('Invalid Indian phone number'),
]

const loginRules = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Invalid email address'),
  body('password')
    .notEmpty().withMessage('Password is required'),
]

const sendOtpRules = [
  body('phone')
    .notEmpty().withMessage('Phone number is required')
    .isMobilePhone('en-IN')
      .withMessage('Invalid Indian phone number'),
]

const verifyOtpRules = [
  body('phone')
    .notEmpty().withMessage('Phone number is required')
    .isMobilePhone('en-IN'),
  body('otp')
    .notEmpty().withMessage('OTP is required')
    .isLength({ min: 4, max: 6 })
      .withMessage('OTP must be 4–6 digits')
    .isNumeric().withMessage('OTP must contain only digits'),
]

module.exports = { registerRules, loginRules, sendOtpRules, verifyOtpRules }
