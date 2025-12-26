const mongoose = require('mongoose');

const devoteeProfileSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },
  address: {
    street: { type: String },
    city: { type: String },
    state: { type: String },
    zip: { type: String },
    country: { type: String }
  },
  preferences: {
    preferredCeremonies: [{ type: String }],
    preferredPriests: [{ type: mongoose.Schema.Types.ObjectId, ref: 'PriestProfile' }],
    language: { type: String },
    notifications: {
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: false }
    }
  },
  // History is removed to avoid duplication with Booking collection
  // Query bookings by devoteeId instead
  isVerified: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('DevoteeProfile', devoteeProfileSchema);
