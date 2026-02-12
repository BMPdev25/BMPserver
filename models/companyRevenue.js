// models/companyRevenue.js
const mongoose = require('mongoose');

const companyRevenueSchema = new mongoose.Schema({
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
  totalAmount: {
    type: Number,
    required: true,
  },
  commissionAmount: {
    type: Number,
    required: true,
  },
  commissionRate: {
    type: Number,
    required: true,
    default: 0.05, // 5% platform fee
  },
  priestShare: {
    type: Number,
    required: true,
  },
}, {
  timestamps: true,
});

// Indexes
companyRevenueSchema.index({ bookingId: 1 });
companyRevenueSchema.index({ priestId: 1 });
companyRevenueSchema.index({ createdAt: -1 });

module.exports = mongoose.model('CompanyRevenue', companyRevenueSchema);
