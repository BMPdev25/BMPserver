// models/wallet.js
const mongoose = require('mongoose');

const walletSchema = new mongoose.Schema({
  priestId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },
  currentBalance: {
    type: Number,
    default: 0,
    min: 0,
  },
  totalCredited: {
    type: Number,
    default: 0,
  },
  totalDebited: {
    type: Number,
    default: 0,
  },
  currency: {
    type: String,
    default: 'INR',
  },
  status: {
    type: String,
    enum: ['active', 'frozen'],
    default: 'active',
  },
  lastPayoutDate: {
    type: Date,
  },
}, {
  timestamps: true,
});

// Index for quick priest wallet lookups
walletSchema.index({ priestId: 1 });

module.exports = mongoose.model('Wallet', walletSchema);
