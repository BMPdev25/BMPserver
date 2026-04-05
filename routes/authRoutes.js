// routes/authRoutes.js
const express = require('express');
const authController = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const router = express.Router();

// Synchronize Firebase Session / Create new User
router.post('/sync', authController.firebaseSync);

// Keep older aliases for backwards compatibility in dev but point them to sync
router.post('/firebase-login', authController.firebaseSync);
router.post('/register', authController.firebaseSync);
router.post('/login', authController.firebaseSync);

// Save Expo push token (Requires Valid Session)
router.post('/push-token', protect, authController.savePushToken);

module.exports = router;
