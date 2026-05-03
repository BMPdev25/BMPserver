const mongoose = require('mongoose');

const panchangSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true,
    unique: true,
    index: true,
  },
  title: {
    type: String,
    required: true,
  },
  subtitle: {
    type: String,
  },
  nakshatra: {
    type: String,
  },
  tithi: {
    type: String,
  },
  auspiciousFor: [
    {
      type: String,
    },
  ],
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Panchang', panchangSchema);
