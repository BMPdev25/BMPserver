// models/transaction.js
const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  priestId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  walletId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Wallet',
    required: true,
  },
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: function() {
      return this.type === 'credit_for_booking';
    },
  },
  type: {
    type: String,
    enum: ['credit_for_booking', 'debit_commission', 'payout_withdrawal', 'penalty', 'bonus'],
    required: true,
  },
  direction: {
    type: String,
    enum: ['inflow', 'outflow'],
    required: true,
  },
  amount: {
    type: Number,
    required: true,
    min: 0,
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'pending',
  },
  referenceId: {
    type: String, // Razorpay Transfer/Payout ID
  },
  description: {
    type: String,
  },
}, {
  timestamps: true, // adds createdAt and updatedAt
});

// Indexes for fast queries
transactionSchema.index({ priestId: 1, createdAt: -1 });
transactionSchema.index({ walletId: 1 });
transactionSchema.index({ bookingId: 1 });
transactionSchema.index({ type: 1, status: 1 });

module.exports = mongoose.model('Transaction', transactionSchema);