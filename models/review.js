const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: true,
  },
  reviewerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  revieweeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5,
  },
  comment: {
    type: String,
    trim: true,
  },
  tags: [{
    type: String,
    trim: true,
  }],
  role: {
    type: String,
    enum: ['priest_to_devotee', 'devotee_to_priest'],
    required: true,
  },
  isVisible: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Ensure a user can only review a booking once per role
reviewSchema.index({ bookingId: 1, reviewerId: 1 }, { unique: true });

// Index for fetching visible reviews for a user
reviewSchema.index({ revieweeId: 1, isVisible: 1, createdAt: -1 });

module.exports = mongoose.model('Review', reviewSchema);
