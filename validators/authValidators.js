const { body } = require('express-validator');

const sendOtpRules = [
  body('phone')
    .notEmpty()
    .withMessage('Phone number is required')
    .isMobilePhone('en-IN')
    .withMessage('Invalid Indian phone number'),
];

const verifyOtpRules = [
  body('phone').notEmpty().withMessage('Phone number is required').isMobilePhone('en-IN'),
  body('otp')
    .notEmpty()
    .withMessage('OTP is required')
    .isLength({ min: 4, max: 6 })
    .withMessage('OTP must be 4–6 digits')
    .isNumeric()
    .withMessage('OTP must contain only digits'),
];

module.exports = { sendOtpRules, verifyOtpRules };
