// routes/authRoutes.js
const express = require('express');
const rateLimit = require('express-rate-limit');
const authController = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const validate = require('../middleware/validate');
const { sendOtpRules, verifyOtpRules } = require('../validators/authValidators')

const router = express.Router();

const authLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  skip: () => process.env.NODE_ENV === 'test',
  message: { message: 'Too many auth requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Synchronize Firebase Session / Create new User
router.post('/sync', authLimit, authController.firebaseSync);

// Keep older aliases for backwards compatibility
router.post('/firebase-login', authLimit, authController.firebaseSync);
router.post('/register', authLimit, authController.firebaseSync);
router.post('/login', authLimit, authController.firebaseSync);

// Phone OTP Authentication — only active when OTP_ENABLED=true in .env
if (process.env.OTP_ENABLED === 'true') {
  router.post('/send-otp', authLimit, sendOtpRules, validate, authController.sendOtp);
  router.post('/verify-otp', authLimit, verifyOtpRules, validate, authController.verifyOtp);
}

// Save Expo push token (Requires Valid Session)
router.post('/push-token', protect, authController.savePushToken);

module.exports = router;

