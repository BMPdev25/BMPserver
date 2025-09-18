// models/ceremony.js
const mongoose = require('mongoose');

const ceremonySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    index: true,
  },
  description: {
    type: String,
    required: true,
  },
  category: {
    type: String,
    required: true,
    enum: [
      'wedding',
      'puja',
      'housewarming',
      'baby-naming',
      'thread-ceremony',
      'funeral',
      'festival',
      'special-occasion',
      'daily-worship',
      'corporate'
    ],
    index: true,
  },
  subcategory: {
    type: String,
    required: true,
    index: true,
  },
  // Duration and Timing
  duration: {
    typical: {
      type: Number, // in minutes
      required: true,
    },
    minimum: {
      type: Number,
      required: true,
    },
    maximum: {
      type: Number,
      required: true,
    },
  },
  // Pricing Information
  pricing: {
    basePrice: {
      type: Number,
      required: true,
      min: 0,
    },
    priceRange: {
      min: {
        type: Number,
        required: true,
      },
      max: {
        type: Number,
        required: true,
      },
    },
    factors: [{
      name: {
        type: String,
        required: true,
      },
      multiplier: {
        type: Number,
        required: true,
      },
      description: String,
    }],
  },
  // Requirements and Materials
  requirements: {
    materials: [{
      name: {
        type: String,
        required: true,
      },
      isOptional: {
        type: Boolean,
        default: false,
      },
      quantity: String,
      providedBy: {
        type: String,
        enum: ['devotee', 'priest', 'either'],
        default: 'devotee',
      },
    }],
    participants: {
      required: {
        type: Number,
        default: 1,
      },
      maximum: {
        type: Number,
        default: null,
      },
    },
    spaceRequirements: {
      type: String,
    },
    specialInstructions: [{
      type: String,
    }],
  },
  // SEO and Searchability
  tags: [{
    type: String,
    index: true,
  }],
  keywords: [{
    type: String,
    index: true,
  }],
  searchTerms: [{
    type: String,
    index: true,
  }],
  // Multimedia Content
  images: [{
    url: {
      type: String,
      required: true,
    },
    alt: {
      type: String,
      required: true,
    },
    isPrimary: {
      type: Boolean,
      default: false,
    },
  }],
  videos: [{
    url: String,
    title: String,
    description: String,
  }],
  // Cultural and Religious Context
  religiousTraditions: [{
    type: String,
    required: true,
    index: true,
  }],
  regions: [{
    type: String,
    index: true,
  }],
  languages: [{
    type: String,
    index: true,
  }],
  // Seasonal and Timing Information
  seasonality: {
    preferredMonths: [{
      type: Number, // 1-12
    }],
    avoidMonths: [{
      type: Number,
    }],
    preferredDays: [{
      type: String,
      enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    }],
    preferredTimes: [{
      start: String,
      end: String,
      significance: String,
    }],
  },
  // Popularity and Statistics
  statistics: {
    bookingCount: {
      type: Number,
      default: 0,
    },
    averageRating: {
      type: Number,
      default: 0,
    },
    reviewCount: {
      type: Number,
      default: 0,
    },
    popularityScore: {
      type: Number,
      default: 0,
    },
    monthlyTrend: [{
      month: Number,
      year: Number,
      bookings: Number,
    }],
  },
  // Administrative
  isActive: {
    type: Boolean,
    default: true,
  },
  isFeatured: {
    type: Boolean,
    default: false,
  },
  isPopular: {
    type: Boolean,
    default: false,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  lastUpdatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Indexes for search and filtering
ceremonySchema.index({ name: 'text', description: 'text', tags: 'text' });
ceremonySchema.index({ category: 1, subcategory: 1 });
ceremonySchema.index({ 'pricing.basePrice': 1 });
ceremonySchema.index({ 'statistics.popularityScore': -1 });
ceremonySchema.index({ 'statistics.bookingCount': -1 });
ceremonySchema.index({ 'statistics.averageRating': -1 });
ceremonySchema.index({ isActive: 1, isFeatured: 1 });
ceremonySchema.index({ religiousTraditions: 1 });
ceremonySchema.index({ regions: 1 });
ceremonySchema.index({ createdAt: -1 });

// Update timestamp before saving
ceremonySchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Calculate popularity score based on various factors
ceremonySchema.methods.calculatePopularityScore = function() {
  const weights = {
    bookingCount: 0.4,
    rating: 0.3,
    recency: 0.2,
    reviews: 0.1,
  };

  const maxBookings = 1000; // Normalize booking count
  const daysSinceCreated = (Date.now() - this.createdAt) / (1000 * 60 * 60 * 24);
  const recencyScore = Math.max(0, 100 - (daysSinceCreated / 30)); // Decay over months

  this.statistics.popularityScore = 
    (this.statistics.bookingCount / maxBookings * 100 * weights.bookingCount) +
    (this.statistics.averageRating * 20 * weights.rating) +
    (recencyScore * weights.recency) +
    (Math.min(this.statistics.reviewCount, 100) * weights.reviews);

  return this.statistics.popularityScore;
};

// Virtual for getting primary image
ceremonySchema.virtual('primaryImage').get(function() {
  const primary = this.images.find(img => img.isPrimary);
  return primary || this.images[0] || null;
});

// Virtual for price display
ceremonySchema.virtual('priceDisplay').get(function() {
  if (this.pricing.priceRange.min === this.pricing.priceRange.max) {
    return `₹${this.pricing.priceRange.min}`;
  }
  return `₹${this.pricing.priceRange.min} - ₹${this.pricing.priceRange.max}`;
});

// Virtual for duration display
ceremonySchema.virtual('durationDisplay').get(function() {
  const hours = Math.floor(this.duration.typical / 60);
  const minutes = this.duration.typical % 60;
  
  if (hours === 0) return `${minutes} minutes`;
  if (minutes === 0) return `${hours} hour${hours > 1 ? 's' : ''}`;
  return `${hours}h ${minutes}m`;
});

module.exports = mongoose.model('Ceremony', ceremonySchema);
