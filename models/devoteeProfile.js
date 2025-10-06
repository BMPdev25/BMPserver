// models/devoteeProfile.js
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
  history: [{
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
    ceremony: String,
    date: Date,
    status: String
  }],
  isVerified: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('DevoteeProfile', devoteeProfileSchema);
