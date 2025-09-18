// routes/authRoutes.js
const express = require('express');
const authController = require('../controllers/authController');
const router = express.Router();

// Register user
router.post('/register', authController.register);

// Login user
router.post('/login', authController.login);

module.exports = router;

// Placeholder route for testing
router.get('/test', (req, res) => {
  res.json({ message: 'Auth route is working' });
});

module.exports = router;
