const Review = require('../models/review');
const User = require('../models/user');
const Booking = require('../models/booking');

// Recalculate User Rating Helper
const recalculateUserRating = async (userId) => {
  try {
    const stats = await Review.aggregate([
      { $match: { revieweeId: new mongoose.Types.ObjectId(userId), isVisible: true } },
      {
        $group: {
          _id: null,
          average: { $avg: '$rating' },
          count: { $sum: 1 },
          // Group for breakdown? Might be complex in one go, start simple
        }
      }
    ]);

    const breakdownStats = await Review.aggregate([
      { $match: { revieweeId: new mongoose.Types.ObjectId(userId), isVisible: true } },
      {
        $group: {
          _id: '$rating',
          count: { $sum: 1 }
        }
      }
    ]);

    const breakdownMap = {};
    breakdownStats.forEach(item => {
      breakdownMap[item._id] = item.count;
    });

    const updateData = {
      'rating.average': stats.length > 0 ? parseFloat(stats[0].average.toFixed(1)) : 0,
      'rating.count': stats.length > 0 ? stats[0].count : 0,
      'rating.breakdown': breakdownMap
    };

    await User.findByIdAndUpdate(userId, { $set: updateData });
    console.log(`Updated rating for user ${userId}: ${updateData['rating.average']} (${updateData['rating.count']})`);

  } catch (error) {
    console.error(`Error recalculating rating for user ${userId}:`, error);
  }
};

exports.submitReview = async (req, res) => {
  try {
    const { bookingId, rating, comment, tags } = req.body;
    const reviewerId = req.user.id; // User ID from auth middleware

    // 1. Validate Booking
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // Determine Roles
    let role, revieweeId;
    if (booking.priestId.toString() === reviewerId) {
      role = 'priest_to_devotee';
      revieweeId = booking.devoteeId;
    } else if (booking.devoteeId.toString() === reviewerId) {
      role = 'devotee_to_priest';
      revieweeId = booking.priestId;
    } else {
        return res.status(403).json({ message: 'You are not a party to this booking' });
    }

    // 2. Create Review
    const newReview = new Review({
      bookingId,
      reviewerId,
      revieweeId,
      rating,
      comment,
      tags,
      role,
      isVisible: false // Default to hidden
    });

    await newReview.save();

    // 3. Check for Counter-Review
    const counterReview = await Review.findOne({
      bookingId,
      reviewerId: revieweeId // The other party is the reviewer
    });

    if (counterReview) {
      // Counter-review exists! Reveal BOTH.
      newReview.isVisible = true;
      counterReview.isVisible = true;

      await Promise.all([
        newReview.save(),
        counterReview.save()
      ]);

      // Recalculate Ratings for BOTH users
      await Promise.all([
        recalculateUserRating(reviewerId),
        recalculateUserRating(revieweeId)
      ]);

      // TODO: Send "Review Live" notification to both
      console.log('Double-blind complete. Reviews are live.');

      return res.status(201).json({
        message: 'Review submitted. Both reviews are now visible!',
        review: newReview,
        isVisible: true
      });

    } else {
      // No counter-review yet. Keep hidden.
      // TODO: Send "You got a review" notification to reviewee
      console.log('Review submitted. Waiting for counter-review.');

      return res.status(201).json({
        message: 'Review submitted. It will be visible once the other party reviews you.',
        review: newReview,
        isVisible: false
      });
    }

  } catch (error) {
    console.error('Error submitting review:', error);
    if (error.code === 11000) {
      return res.status(400).json({ message: 'You have already reviewed this booking.' });
    }
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getUserReviews = async (req, res) => {
    try {
        const { userId } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const reviews = await Review.find({ 
            revieweeId: userId, 
            isVisible: true 
        })
        .populate('reviewerId', 'name profilePicture')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

        const total = await Review.countDocuments({ revieweeId: userId, isVisible: true });

        res.json({
            reviews,
            currentPage: page,
            totalPages: Math.ceil(total / limit),
            totalReviews: total
        });
    } catch (error) {
        console.error('Error fetching user reviews:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Get top reviews for Home Screen "Recent Love"
exports.getRecentReviews = async (req, res) => {
    try {
        const userId = req.user.id;
        
        const reviews = await Review.find({
            revieweeId: userId,
            isVisible: true
        })
        .populate('reviewerId', 'name profilePicture')
        .sort({ createdAt: -1 }) // Most recent first
        .limit(5);

        res.json(reviews);
    } catch (error) {
        console.error('Error fetching recent reviews:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
