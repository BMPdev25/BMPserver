// models/booking.js
const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  devoteeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  priestId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  ceremonyType: {
    type: String,
    required: true,
  },
  date: {
    type: Date,
    required: true,
  },
  startTime: {
    type: String,
    required: true,
  },
  endTime: {
    type: String,
    required: true,
  },
  location: {
    address: {
      type: String,
      required: true,
    },
    city: {
      type: String,
      required: true,
    },
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'completed', 'cancelled'],
    default: 'pending',
  },
  basePrice: {
    type: Number,
    required: true,
  },
  platformFee: {
    type: Number,
    required: true,
  },
  totalAmount: {
    type: Number,
    required: true,
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'completed', 'refunded'],
    default: 'pending',
  },
  paymentId: {
    type: String,
  },
  paymentMethod: {
    type: String,
    enum: ['upi', 'card', 'other'],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  notes: {
    type: String,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  razorpayOrderId: {
    type: String,
  },
  razorpayPaymentId: {
    type: String,
  },
  cancellationReason: {
    type: String,
  },
  cancellationDate: {
    type: Date,
  },
  completionDate: {
    type: Date,
  },
  // Payment Details Enhancement
  paymentDetails: {
    transactionId: {
      type: String,
    },
    paymentGateway: {
      type: String,
      enum: ['razorpay', 'paytm', 'phonepe', 'googlepay'],
      default: 'razorpay',
    },
    refundAmount: {
      type: Number,
      default: 0,
    },
    refundReason: {
      type: String,
    },
    refundDate: {
      type: Date,
    },
    receiptNumber: {
      type: String,
    },
  },
  // Rating and Review
  rating: {
    score: {
      type: Number,
      min: 1,
      max: 5,
    },
    review: {
      type: String,
    },
    ratedAt: {
      type: Date,
    },
    isRated: {
      type: Boolean,
      default: false,
    },
  },
  // Real-time Status Tracking
  statusHistory: [{
    status: {
      type: String,
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    reason: {
      type: String,
    },
  }],
  // Auto-categorization fields
  category: {
    type: String,
    enum: ['today', 'upcoming', 'completed'],
    default: function() {
      const now = new Date();
      const bookingDate = new Date(this.date);
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const bookingDay = new Date(bookingDate.getFullYear(), bookingDate.getMonth(), bookingDate.getDate());
      
      if (this.status === 'completed') return 'completed';
      if (bookingDay.getTime() === today.getTime()) return 'today';
      if (bookingDate > now) return 'upcoming';
      return 'completed';
    },
  },
});

// Create indexes for better query performance
bookingSchema.index({ devoteeId: 1, createdAt: -1 });
bookingSchema.index({ priestId: 1, createdAt: -1 });
bookingSchema.index({ status: 1 });
bookingSchema.index({ date: 1 });
bookingSchema.index({ paymentStatus: 1 });
bookingSchema.index({ createdAt: -1 });

// Update the updatedAt field before saving
bookingSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Virtual for checking if booking is upcoming
bookingSchema.virtual('isUpcoming').get(function() {
  return this.date > new Date() && this.status === 'confirmed';
});

// Virtual for checking if booking can be cancelled
bookingSchema.virtual('canCancel').get(function() {
  const hoursUntilBooking = (this.date - new Date()) / (1000 * 60 * 60);
  return hoursUntilBooking > 24 && this.status === 'confirmed';
});

module.exports = mongoose.model('Booking', bookingSchema);
