// models/rating.js
const mongoose = require('mongoose');

const ratingSchema = new mongoose.Schema({
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: true,
  },
  priestId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  userId: {
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
  categories: {
    punctuality: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    knowledge: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    behavior: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    overall: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
  },
  review: {
    type: String,
    maxlength: 500,
  },
  ceremonyType: {
    type: String,
    required: true,
  },
  ceremonyDate: {
    type: String,
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

// Prevent duplicate ratings for the same booking
ratingSchema.index({ bookingId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('Rating', ratingSchema);
