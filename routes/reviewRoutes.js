const express = require('express');
const router = express.Router();
const { submitReview, getUserReviews, getRecentReviews } = require('../controllers/reviewController');
const { protect } = require('../middleware/authMiddleware'); // Assuming this exists

router.post('/submit', protect, submitReview);
router.get('/user/:userId', getUserReviews);
router.get('/recent', protect, getRecentReviews);

module.exports = router;
