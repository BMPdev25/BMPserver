// models/transaction.js
const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  priestId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
  },
  amount: {
    type: Number,
    required: true,
  },
  type: {
    type: String,
    enum: ['earnings', 'withdrawal'],
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'pending',
  },
  date: {
    type: Date,
    default: Date.now,
  },
  description: {
    type: String,
  },
  paymentDetails: {
    method: String,
    transactionId: String,
  },
});

module.exports = mongoose.model('Transaction', transactionSchema);