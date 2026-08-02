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
    // Required except for instant booking in 'searching' phase
    required: function () {
      return this.status !== 'searching';
    },
  },
  ceremonyType: {
    type: String,
    required: true,
    maxlength: [100, 'Ceremony type cannot exceed 100 characters'],
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
    coordinates: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: [Number], // [lng, lat]
    },
  },
  status: {
    type: String,
    enum: [
      'pending',
      'searching',
      'requested',
      'confirmed',
      'arrived',
      'in_progress',
      'completed',
      'cancelled',
      'rejected',
      'expired',
    ],
    default: 'pending',
  },
  bookingType: {
    type: String,
    enum: ['scheduled', 'instant'],
    required: true,
    default: 'scheduled',
  },
  // For instant bookings: which ceremony is requested (no priest chosen yet)
  ceremonyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ceremony',
    default: null,
  },
  // For instant bookings: a preferred priest who gets a head-start before the
  // request is broadcast to everyone (set when instant is started from a
  // specific priest's page).
  preferredPriestId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  // For instant bookings: when the broadcast (searching) expires.
  instantExpiresAt: {
    type: Date,
    default: null,
  },
  // For instant bookings: until when only the preferred priest is notified.
  headStartExpiresAt: {
    type: Date,
    default: null,
  },
  expiryTime: {
    type: Date,
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
    enum: ['pending', 'completed', 'refunding', 'refunded'],
    default: 'pending',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  notes: {
    type: String,
    maxlength: [1000, 'Notes cannot exceed 1000 characters'],
  },
  updatedAt: {
    type: Date,
    default: Date.now,
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
    rzpOrderId: { type: String, default: null },
    rzpPaymentId: { type: String, default: null },
    rzpSignature: { type: String, default: null },
  },
  // Real-time Status Tracking
  statusHistory: [
    {
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
    },
  ],
  // Auto-categorization fields
  category: {
    type: String,
    enum: ['today', 'upcoming', 'completed'],
    default: function () {
      const now = new Date();
      const bookingDate = new Date(this.date);
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const bookingDay = new Date(
        bookingDate.getFullYear(),
        bookingDate.getMonth(),
        bookingDate.getDate()
      );

      if (this.status === 'completed') return 'completed';
      if (bookingDay.getTime() === today.getTime()) return 'today';
      if (bookingDate > now) return 'upcoming';
      return 'completed';
    },
  },
  isTestRecord: {
    type: Boolean,
    default: false,
  },
  paymentExpiresAt: {
    type: Date,
    default: null,
  },
  devoteeDeleted: {
    type: Boolean,
    default: false,
  },
  priestDeleted: {
    type: Boolean,
    default: false,
  },
});

// Create indexes for better query performance
bookingSchema.index({ devoteeId: 1, createdAt: -1 });
bookingSchema.index({ priestId: 1, createdAt: -1 });
bookingSchema.index({ date: 1 });
bookingSchema.index({ paymentStatus: 1 });
bookingSchema.index({ createdAt: -1 });
bookingSchema.index({ devoteeId: 1, status: 1, date: -1 });
bookingSchema.index({ priestId: 1, status: 1, date: -1 });
bookingSchema.index({ priestId: 1, date: 1 });
bookingSchema.index({ status: 1, createdAt: -1 });

// Update the updatedAt field before saving
bookingSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Booking', bookingSchema);
