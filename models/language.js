const mongoose = require('mongoose');

const languageSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  nativeName: {
    type: String,
    required: true,
    trim: true
  },
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true
  },
  speakersInMillions: {
    type: Number,
    required: true
  },
  rank: {
    type: Number,
    required: true,
    unique: true
  }
}, {
  timestamps: true
});

// Index for efficient querying
languageSchema.index({ rank: 1 });
languageSchema.index({ name: 1 });

module.exports = mongoose.model('Language', languageSchema);
