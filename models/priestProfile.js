// models/priestProfile.js
const mongoose = require('mongoose');

const priestProfileSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },
  experience: {
    type: Number,
    required: true,
  },
  religiousTradition: {
    type: String,
    required: true,
  },
  templesAffiliated: [{
    name: {
      type: String,
      required: true,
    },
    address: {
      type: String,
      required: true,
    }
  }],
  ceremonies: [{
    type: String,
    required: true,
  }],
  description: {
    type: String,
  },
  governmentIdVerified: {
    type: Boolean,
    default: false,
  },
  religiousCertificationVerified: {
    type: Boolean,
    default: false,
  },
  profilePicture: {
    type: String,
  },
  ratings: {
    average: {
      type: Number,
      default: 0,
    },
    count: {
      type: Number,
      default: 0,
    },
  },
  availability: {
    type: Map,
    of: [{
      available: Boolean,
      startTime: String,
      endTime: String,
    }],
  },
  priceList: {
    type: Map,
    of: Number,
  },
  ceremonyCount: {
    type: Number,
    default: 0,
  },
  isVerified: {
    type: Boolean,
    default: true,
  },
  // Real-time Availability System
  currentAvailability: {
    status: {
      type: String,
      enum: ['available', 'busy', 'offline'],
      default: 'offline',
    },
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
    autoToggle: {
      type: Boolean,
      default: true,
    },
  },
  // Schedule Management
  schedule: {
    workingHours: {
      type: Map,
      of: {
        isWorking: {
          type: Boolean,
          default: true,
        },
        startTime: {
          type: String,
          default: '09:00',
        },
        endTime: {
          type: String,
          default: '18:00',
        },
        breakTime: {
          start: {
            type: String,
            default: '13:00',
          },
          end: {
            type: String,
            default: '14:00',
          },
        },
      },
    },
    blockedDates: [{
      date: {
        type: Date,
        required: true,
      },
      reason: {
        type: String,
      },
    }],
    recurringUnavailability: [{
      dayOfWeek: {
        type: Number, // 0-6 (Sunday-Saturday)
        required: true,
      },
      startTime: String,
      endTime: String,
      reason: String,
    }],
  },
  // Earnings Dashboard
  earnings: {
    totalEarnings: {
      type: Number,
      default: 0,
    },
    thisMonth: {
      type: Number,
      default: 0,
    },
    lastMonth: {
      type: Number,
      default: 0,
    },
    pendingPayments: {
      type: Number,
      default: 0,
    },
    monthlyEarnings: [{
      month: {
        type: Number,
        required: true,
      },
      year: {
        type: Number,
        required: true,
      },
      amount: {
        type: Number,
        default: 0,
      },
      completedCeremonies: {
        type: Number,
        default: 0,
      },
    }],
    lastPayoutDate: {
      type: Date,
    },
    nextPayoutDate: {
      type: Date,
    },
  },
  // Performance Analytics
  analytics: {
    completionRate: {
      type: Number,
      default: 100,
    },
    responseTime: {
      type: Number, // in hours
      default: 2,
    },
    repeatCustomers: {
      type: Number,
      default: 0,
    },
    monthlyTrends: [{
      month: Number,
      year: Number,
      bookings: Number,
      earnings: Number,
      averageRating: Number,
    }],
  },
  // Enhanced Location Support
  serviceAreas: [{
    city: {
      type: String,
      required: true,
    },
    state: {
      type: String,
      required: true,
    },
    radius: {
      type: Number, // in kilometers
      default: 25,
    },
    travelCharges: {
      type: Number,
      default: 0,
    },
  }],
  // Specializations and Certifications
  specializations: [{
    name: {
      type: String,
      required: true,
    },
    experience: {
      type: Number, // in years
      required: true,
    },
    certification: {
      type: String,
    },
    verificationStatus: {
      type: String,
      enum: ['pending', 'verified', 'rejected'],
      default: 'pending',
    },
  }],
});

module.exports = mongoose.model('PriestProfile', priestProfileSchema);
