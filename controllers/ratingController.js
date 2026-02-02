// controllers/ratingController.js
const Rating = require('../models/rating');

// Submit a new rating
exports.submitRating = async (req, res) => {
  try {
    const {
      bookingId,
      priestId,
      rating,
      categories,
      review,
      ceremonyType,
      ceremonyDate,
      timestamp
    } = req.body;

    // Get userId from authenticated user
    const userId = req.user._id.toString();

    // Validate required fields
    if (!bookingId || !priestId || !rating || !categories || !ceremonyType || !ceremonyDate) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // Validate rating values
    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5'
      });
    }

    // Validate category ratings
    const { punctuality, knowledge, behavior, overall } = categories;
    if (!punctuality || !knowledge || !behavior || !overall) {
      return res.status(400).json({
        success: false,
        message: 'All category ratings are required'
      });
    }

    if (punctuality < 1 || punctuality > 5 || 
        knowledge < 1 || knowledge > 5 || 
        behavior < 1 || behavior > 5 || 
        overall < 1 || overall > 5) {
      return res.status(400).json({
        success: false,
        message: 'All category ratings must be between 1 and 5'
      });
    }

    // Check if rating already exists for this booking
    const existingRating = await Rating.findOne({ bookingId, userId });
    if (existingRating) {
      return res.status(400).json({
        success: false,
        message: 'You have already rated this booking'
      });
    }

    // Create new rating
    const newRating = new Rating({
      bookingId,
      priestId,
      userId,
      rating,
      categories,
      review: review || '',
      ceremonyType,
      ceremonyDate,
      timestamp: timestamp || new Date().toISOString()
    });

    await newRating.save();

    res.status(201).json({
      success: true,
      message: 'Rating submitted successfully',
      data: newRating
    });

  } catch (error) {
    console.error('Submit rating error:', error);
    
    // Handle duplicate key error
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'You have already rated this booking'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error while submitting rating'
    });
  }
};

// Get ratings for a priest
exports.getPriestRatings = async (req, res) => {
  try {
    const { priestId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const ratings = await Rating.find({ priestId })
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const totalRatings = await Rating.countDocuments({ priestId });
    
    // Calculate average rating
    const avgRatingResult = await Rating.aggregate([
      { $match: { priestId } },
      {
        $group: {
          _id: null,
          avgRating: { $avg: '$rating' },
          avgPunctuality: { $avg: '$categories.punctuality' },
          avgKnowledge: { $avg: '$categories.knowledge' },
          avgBehavior: { $avg: '$categories.behavior' },
          avgOverall: { $avg: '$categories.overall' }
        }
      }
    ]);

    const averages = avgRatingResult.length > 0 ? avgRatingResult[0] : {
      avgRating: 0,
      avgPunctuality: 0,
      avgKnowledge: 0,
      avgBehavior: 0,
      avgOverall: 0
    };

    res.json({
      success: true,
      data: {
        ratings,
        totalRatings,
        averages,
        currentPage: page,
        totalPages: Math.ceil(totalRatings / limit)
      }
    });

  } catch (error) {
    console.error('Get priest ratings error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching ratings'
    });
  }
};

// Get user's submitted ratings
exports.getUserRatings = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const ratings = await Rating.find({ userId })
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const totalRatings = await Rating.countDocuments({ userId });

    res.json({
      success: true,
      data: {
        ratings,
        totalRatings,
        currentPage: page,
        totalPages: Math.ceil(totalRatings / limit)
      }
    });

  } catch (error) {
    console.error('Get user ratings error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching user ratings'
    });
  }
};
