const mongoose = require('mongoose');

const ceremonyCategorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  slug: {
    type: String,
    unique: true,
    lowercase: true,
  },
  icon: {
    type: String, // Expo Ionicons name, e.g., 'flame-outline'
    required: true,
  },
  color: {
    type: String,
    default: '#FF9933',
  },
  description: {
    type: String,
  },
  order: {
    type: Number,
    default: 0,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('CeremonyCategory', ceremonyCategorySchema);
