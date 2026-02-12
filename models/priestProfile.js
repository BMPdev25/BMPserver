const mongoose = require("mongoose");

const PriestServiceSchema = new mongoose.Schema({
  ceremonyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Ceremony",
    required: true,
  },
  price: {
    type: Number,
    required: true,
  },
  durationMinutes: {
    type: Number,
    required: true,
  },
  requirements: {
    type: [String],
    default: [],
  },
  // Optional seasonal overrides (optional but future-ready)
  seasonalPrice: {
    type: Number,
  },
}, { _id: false });

const priestProfileSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true,
  },

  experience: Number,
  religiousTradition: String,
  description: String,
  // ceremonies: [String], // Removed legacy field. Use services instead.

  // NEW: Link ceremonies with price + duration
  services: [PriestServiceSchema],

  // NEW: GeoJSON location for radius-based search
  location: {
    type: {
      type: String,
      enum: ["Point"],
      default: "Point",
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      default: [0, 0],
    },
  },

  serviceRadiusKm: {
    type: Number,
    default: 10
  },

  templesAffiliated: [{
    name: String,
    address: String
  }],

  profilePicture: String,

  ratings: {
    average: { type: Number, default: 0 },
    count: { type: Number, default: 0 },
  },

  availability: {
    weeklySchedule: {
      type: Map,
      of: [String],
      default: {
        monday: [], tuesday: [], wednesday: [], thursday: [], friday: [], saturday: [], sunday: []
      }
    },
    dateOverrides: [{
      date: Date,
      isUnavailable: { type: Boolean, default: false },
      customSlots: [{
        start: String,
        end: String
      }],
      reason: String
    }],
    timeZone: { type: String, default: "Asia/Kolkata" }
  },

  // Travel & service area management
  serviceAreas: [{
    city: String,
    state: String,
    radius: Number,
    travelCharges: Number,
  }],

  priceList: {
    type: Map,
    of: Number,
  },

  ceremonyCount: { type: Number, default: 0 },
  isVerified: { type: Boolean, default: true },

  // Real-time status
  currentAvailability: {
    status: { type: String, enum: ["available", "busy", "offline"], default: "offline" },
    lastUpdated: { type: Date, default: Date.now },
    autoToggle: { type: Boolean, default: true },
  },

  // Earnings
  earnings: {
    totalEarnings: { type: Number, default: 0 },
    thisMonth: { type: Number, default: 0 },
    lastMonth: { type: Number, default: 0 },
    pendingPayments: { type: Number, default: 0 },
    monthlyEarnings: [{
      month: Number,
      year: Number,
      amount: Number,
      completedCeremonies: Number,
    }],
    lastPayoutDate: Date,
    nextPayoutDate: Date,
  },

  // Analytics
  analytics: {
    completionRate: { type: Number, default: 100 },
    responseTime: { type: Number, default: 2 },
    repeatCustomers: { type: Number, default: 0 },
    monthlyTrends: [{
      month: Number,
      year: Number,
      bookings: Number,
      earnings: Number,
      averageRating: Number,
    }],
  },

  verificationDocuments: [{
    type: {
      type: String,
      enum: ["government_id", "religious_certificate", "other"],
      required: true
    },
    data: Buffer,
    contentType: String,
    fileName: String,
    uploadDate: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: ["pending", "verified", "rejected"],
      default: "pending"
    }
  }],

  specializations: [{
    name: String,
    experience: Number,
    certification: String,
    verificationStatus: {
      type: String,
      enum: ["pending", "verified", "rejected"],
      default: "pending",
    },
  }],
});

// Very important: For radius search
priestProfileSchema.index({ location: "2dsphere" });

// Performance indexes for devotee queries
priestProfileSchema.index({ isVerified: 1, "ratings.average": -1 });
priestProfileSchema.index({ "ratings.average": -1 });

module.exports = mongoose.model("PriestProfile", priestProfileSchema);
