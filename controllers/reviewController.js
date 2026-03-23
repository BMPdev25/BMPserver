// controllers/reviewController.js
const reviewService = require('../services/reviewService');
const Review = require('../models/review');

exports.submitReview = async (req, res, next) => {
  try {
    const reviewerId = req.user.id;
    const { bookingId, rating, comment, tags } = req.body;
    const { review, isVisible } = await reviewService.submitReview(reviewerId, {
      bookingId,
      rating,
      comment,
      tags,
    });

    const message = isVisible
      ? 'Review submitted. Both reviews are now visible!'
      : 'Review submitted. It will be visible once the other party reviews you.';

    res.status(201).json({ success: true, message, review, isVisible });
  } catch (error) {
    if (error.code === 11000)
      return res.status(400).json({ success: false, message: 'Already reviewed' });
    next(error);
  }
};

exports.getUserReviews = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const { reviews, total } = await reviewService.getUserReviews(userId, { page, limit });

    res.json({
      reviews,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalReviews: total,
    });
  } catch (error) {
    next(error);
  }
};

exports.getRecentReviews = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const reviews = await Review.find({ revieweeId: userId, isVisible: true })
      .populate('reviewerId', 'name profilePicture')
      .sort({ createdAt: -1 })
      .limit(5);

    res.json(reviews);
  } catch (error) {
    next(error);
  }
};
