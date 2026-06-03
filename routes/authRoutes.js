// routes/authRoutes.js
const express = require('express');
const authController = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const validate = require('../middleware/validate');
const { sendOtpRules, verifyOtpRules } = require('../validators/authValidators')

const router = express.Router();

// Synchronize Firebase Session / Create new User
router.post('/sync', authController.firebaseSync);

// Keep older aliases for backwards compatibility
router.post('/firebase-login', authController.firebaseSync);
router.post('/register', authController.firebaseSync);
router.post('/login', authController.firebaseSync);

// Phone OTP Authentication
router.post('/send-otp', sendOtpRules, validate, authController.sendOtp);
router.post('/verify-otp', verifyOtpRules, validate, authController.verifyOtp);

// Save Expo push token (Requires Valid Session)
router.post('/push-token', protect, authController.savePushToken);

module.exports = router;

