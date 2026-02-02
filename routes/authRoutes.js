// routes/authRoutes.js
const express = require('express');
const authController = require('../controllers/authController');
const router = express.Router();

// Register user
router.post('/register', authController.register);

// Login user
router.post('/login', authController.login);

// Firebase login
router.post('/firebase-login', authController.firebaseLogin);

module.exports = router;
