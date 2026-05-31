// routes/ratingRoutes.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const validate = require('../middleware/validate');
const { submitRatingRules } = require('../validators/ratingValidators');
const Rating = require('../models/rating');
const PriestProfile = require('../models/priestProfile');

router.use(protect);

// Submit a new rating
router.post('/', submitRatingRules, validate, async (req, res, next) => {
  try {
    const { bookingId, priestId, rating, categories, 
            review, ceremonyType, ceremonyDate } = req.body;
    
    // Check not already rated
    const existing = await Rating.findOne({ 
      bookingId, userId: req.user.id 
    });
    if (existing) {
      return res.status(409).json({ 
        success: false, 
        message: 'Already rated this booking' 
      });
    }

    const newRating = await Rating.create({
      bookingId, priestId,
      userId: req.user.id,
      rating, categories, review,
      ceremonyType, ceremonyDate
    });

    // Update PriestProfile ratings aggregate
    const allRatings = await Rating.find({ priestId });
    const avg = allRatings.reduce((sum, r) => sum + r.rating, 0) 
                / allRatings.length;
    await PriestProfile.findOneAndUpdate(
      { userId: priestId },
      { 
        'ratings.average': Math.round(avg * 10) / 10,
        'ratings.count': allRatings.length 
      }
    );

    res.status(201).json({ success: true, data: newRating });
  } catch (error) {
    next(error);
  }
});

// Check if a booking has been rated
router.get('/booking/:bookingId', async (req, res, next) => {
  try {
    const rating = await Rating.findOne({ 
      bookingId: req.params.bookingId, 
      userId: req.user.id 
    });
    res.status(200).json({ 
      success: true, 
      data: rating || null 
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;