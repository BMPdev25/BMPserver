const mongoose = require('mongoose');

const PriestServiceSchema = new mongoose.Schema(
  {
    ceremonyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ceremony',
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
    customSteps: [
      {
        title: String,
        description: String,
        durationEstimate: Number,
        additionalCharge: {
          type: Number,
          default: 0,
        },
      },
    ],
  },
  { _id: false }
);

const priestProfileSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },

  experience: Number,
  religiousTradition: String,
  religiousTraditions: [String],
  description: String,
  // ceremonies: [String], // Removed legacy field. Use services instead.

  // NEW: Link ceremonies with price + duration
  services: [PriestServiceSchema],

  // NEW: GeoJSON location for radius-based search
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      default: [0, 0],
    },
  },

  address: {
    houseNo: String,
    street: String,
    town: String,
    state: String,
    country: String,
    pincode: String,
    fullAddress: String,
  },

  serviceRadiusKm: {
    type: Number,
    default: 10,
  },

  templesAffiliated: [
    {
      name: String,
      address: String,
    },
  ],

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
        monday: [],
        tuesday: [],
        wednesday: [],
        thursday: [],
        friday: [],
        saturday: [],
        sunday: [],
      },
    },
    dateOverrides: [
      {
        date: Date,
        isUnavailable: { type: Boolean, default: false },
        customSlots: [
          {
            start: String,
            end: String,
          },
        ],
        reason: String,
      },
    ],
    timeZone: { type: String, default: 'Asia/Kolkata' },
  },

  // Travel & service area management
  serviceAreas: [
    {
      city: String,
      state: String,
      radius: Number,
      travelCharges: Number,
    },
  ],

  priceList: {
    type: Map,
    of: Number,
  },

  // Denormalized from User.languagesSpoken for search filtering
  languagesSpoken: { type: [String], default: [] },

  ceremonyCount: { type: Number, default: 0 },
  cancelledCount: { type: Number, default: 0 },
  noShowCount: { type: Number, default: 0 },
  isVerified: { type: Boolean, default: false },

  // Phase 11: Onboarding & Verification
  verificationStatus: {
    type: String,
    enum: ['incomplete', 'pending', 'approved', 'rejected'],
    default: 'incomplete',
  },
  rejectionReason: String,
  onboardingCurrentStep: {
    type: Number,
    default: 1,
    min: 1,
    max: 7,
  },
  onboardingCompleted: {
    type: Boolean,
    default: false,
  },
  sampradaya: String,

  // Real-time status
  currentAvailability: {
    status: { type: String, enum: ['available', 'busy', 'offline'], default: 'offline' },
    lastUpdated: { type: Date, default: Date.now },
    autoToggle: { type: Boolean, default: true },
  },

  // Earnings
  earnings: {
    totalEarnings: { type: Number, default: 0 },
    pendingPayments: { type: Number, default: 0 },
    lastPayoutDate: Date,
    nextPayoutDate: Date,
  },

  // Analytics
  analytics: {
    completionRate: { type: Number, default: 100 },
    responseTime: { type: Number, default: 2 },
    repeatCustomers: { type: Number, default: 0 },
  },

  verificationDocuments: [
    {
      type: {
        type: String,
        enum: ['government_id', 'religious_certificate', 'other'],
        required: true,
      },
      url: { type: String, default: null }, // S3 key — presigned URL generated on demand
      fileName: String,
      uploadDate: { type: Date, default: Date.now },
      status: {
        type: String,
        enum: ['pending', 'verified', 'rejected'],
        default: 'pending',
      },
    },
  ],

  specializations: [
    {
      name: String,
      // References the master Ceremony catalog entry this specialization was
      // picked from (onboarding Step 2), so the wizard can resume with the
      // exact puja re-selected rather than just its display name.
      ceremonyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ceremony' },
      experience: Number,
      certification: String,
      verificationStatus: {
        type: String,
        enum: ['pending', 'verified', 'rejected'],
        default: 'pending',
      },
    },
  ],
});

// Keep isVerified and verificationStatus in sync — one source sets the other
priestProfileSchema.pre('save', function (next) {
  if (this.isModified('verificationStatus')) {
    this.isVerified = this.verificationStatus === 'approved';
  } else if (this.isModified('isVerified')) {
    if (this.isVerified) {
      this.verificationStatus = 'approved';
    } else if (this.verificationStatus === 'approved') {
      this.verificationStatus = 'pending';
    }
  }
  next();
});

// The pre-save hook above only runs on document.save() — findOneAndUpdate/
// updateOne/updateMany skip document middleware entirely, so a write that
// sets verificationStatus through one of those (a script, a future admin
// bulk-action, etc.) would silently leave isVerified stale. Mirror the
// verificationStatus -> isVerified half of the sync for query-level updates.
// This does NOT cover raw MongoDB driver writes or manual edits (Atlas/
// Compass) — those bypass Mongoose entirely. That residual gap is why
// callers should filter/gate on verificationStatus (the canonical field)
// rather than isVerified wherever possible.
function syncIsVerifiedOnQueryUpdate(next) {
  const update = this.getUpdate();
  if (!update) return next();
  for (const target of [update, update.$set]) {
    if (target && Object.prototype.hasOwnProperty.call(target, 'verificationStatus')) {
      target.isVerified = target.verificationStatus === 'approved';
    }
  }
  next();
}
priestProfileSchema.pre('findOneAndUpdate', syncIsVerifiedOnQueryUpdate);
priestProfileSchema.pre('updateOne', syncIsVerifiedOnQueryUpdate);
priestProfileSchema.pre('updateMany', syncIsVerifiedOnQueryUpdate);

// Very important: For radius search
priestProfileSchema.index({ location: '2dsphere' });

priestProfileSchema.index({ verificationStatus: 1, isVerified: 1 });
priestProfileSchema.index({ 'currentAvailability.status': 1 });
priestProfileSchema.index({ 'ratings.average': -1 });
// Compound index for the common "available verified priests by rating" query
priestProfileSchema.index({
  isVerified: 1,
  'currentAvailability.status': 1,
  'ratings.average': -1,
});

module.exports = mongoose.model('PriestProfile', priestProfileSchema);
