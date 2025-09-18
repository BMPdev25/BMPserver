// routes/ratingRoutes.js
const express = require('express');
const router = express.Router();
const { submitRating, getPriestRatings, getUserRatings } = require('../controllers/ratingController');
const { protect } = require('../middleware/authMiddleware');

// Submit a new rating (protected route)
router.post('/', protect, submitRating);

// Get ratings for a specific priest (public route)
router.get('/priest/:priestId', getPriestRatings);

// Get ratings submitted by a specific user (protected route)
router.get('/user/:userId', protect, getUserRatings);

module.exports = router;
