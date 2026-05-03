// services/reviewService.js
const Review = require('../models/review');
const User = require('../models/user');
const Booking = require('../models/booking');
const mongoose = require('mongoose');

const recalculateUserRating = async (userId) => {
  const stats = await Review.aggregate([
    { $match: { revieweeId: new mongoose.Types.ObjectId(userId), isVisible: true } },
    { $group: { _id: null, average: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);

  const breakdownStats = await Review.aggregate([
    { $match: { revieweeId: new mongoose.Types.ObjectId(userId), isVisible: true } },
    { $group: { _id: '$rating', count: { $sum: 1 } } },
  ]);

  const breakdownMap = {};
  breakdownStats.forEach((item) => {
    breakdownMap[item._id] = item.count;
  });

  const updateData = {
    'rating.average': stats.length > 0 ? parseFloat(stats[0].average.toFixed(1)) : 0,
    'rating.count': stats.length > 0 ? stats[0].count : 0,
    'rating.breakdown': breakdownMap,
  };

  await User.findByIdAndUpdate(userId, { $set: updateData });
};

const submitReview = async (reviewerId, { bookingId, rating, comment, tags }) => {
  const booking = await Booking.findById(bookingId);
  if (!booking) {
    const error = new Error('Booking not found');
    error.statusCode = 404;
    throw error;
  }

  let role, revieweeId;
  if (booking.priestId.toString() === reviewerId) {
    role = 'priest_to_devotee';
    revieweeId = booking.devoteeId;
  } else if (booking.devoteeId.toString() === reviewerId) {
    role = 'devotee_to_priest';
    revieweeId = booking.priestId;
  } else {
    const error = new Error('Not authorized for this booking');
    error.statusCode = 403;
    throw error;
  }

  const review = new Review({
    bookingId,
    reviewerId,
    revieweeId,
    rating,
    comment,
    tags,
    role,
    isVisible: false,
  });
  await review.save();

  const counter = await Review.findOne({ bookingId, reviewerId: revieweeId });
  if (counter) {
    review.isVisible = true;
    counter.isVisible = true;
    await Promise.all([
      review.save(),
      counter.save(),
      recalculateUserRating(reviewerId),
      recalculateUserRating(revieweeId),
    ]);
    return { review, isVisible: true };
  }

  return { review, isVisible: false };
};

const getUserReviews = async (userId, { page = 1, limit = 10 }) => {
  const skip = (page - 1) * limit;
  const reviews = await Review.find({ revieweeId: userId, isVisible: true })
    .populate('reviewerId', 'name profilePicture')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
  const total = await Review.countDocuments({ revieweeId: userId, isVisible: true });
  return { reviews, total };
};

module.exports = {
  submitReview,
  getUserReviews,
  recalculateUserRating,
};
