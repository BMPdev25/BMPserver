// models/user.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  phone: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  userType: {
    type: String,
    enum: ['priest', 'devotee'],
    required: true,
  },
  profileCompleted: {
    type: Boolean,
    default: false,
  },
  // Profile Picture with cloud storage support
  profilePicture: {
    url: {
      type: String,
      default: null,
    },
    publicId: {
      type: String,
      default: null,
    },
    uploadedAt: {
      type: Date,
      default: null,
    },
  },
  // Security & Privacy Settings
  security: {
    twoFactorEnabled: {
      type: Boolean,
      default: false,
    },
    lastPasswordChange: {
      type: Date,
      default: Date.now,
    },
    loginAttempts: {
      type: Number,
      default: 0,
    },
    accountLocked: {
      type: Boolean,
      default: false,
    },
    lockedUntil: {
      type: Date,
      default: null,
    },
    refreshTokens: [{
      token: String,
      createdAt: {
        type: Date,
        default: Date.now,
        expires: '7d'
      }
    }]
  },
  // Privacy Settings
  privacy: {
    profileVisibility: {
      type: String,
      enum: ['public', 'private', 'limited'],
      default: 'public',
    },
    showPhoneNumber: {
      type: Boolean,
      default: true,
    },
    showEmail: {
      type: Boolean,
      default: false,
    },
    dataProcessingConsent: {
      type: Boolean,
      default: true,
    },
    marketingConsent: {
      type: Boolean,
      default: false,
    },
  },
  // Notification Preferences
  notifications: {
    email: {
      bookingUpdates: {
        type: Boolean,
        default: true,
      },
      promotions: {
        type: Boolean,
        default: false,
      },
      reminders: {
        type: Boolean,
        default: true,
      },
    },
    push: {
      bookingUpdates: {
        type: Boolean,
        default: true,
      },
      promotions: {
        type: Boolean,
        default: false,
      },
      reminders: {
        type: Boolean,
        default: true,
      },
    },
    deviceTokens: [{
      token: String,
      platform: {
        type: String,
        enum: ['ios', 'android'],
      },
      createdAt: {
        type: Date,
        default: Date.now,
      },
    }],
  },
  // Account Status
  isActive: {
    type: Boolean,
    default: true,
  },
  isVerified: {
    type: Boolean,
    default: false,
  },
  lastLoginAt: {
    type: Date,
    default: null,
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

// Indexes for performance
userSchema.index({ email: 1 });
userSchema.index({ phone: 1 });
userSchema.index({ userType: 1 });
userSchema.index({ 'security.refreshTokens.token': 1 });
userSchema.index({ createdAt: -1 });

// Update timestamp before saving
userSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Password comparison method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Method to check if account is locked
userSchema.methods.isAccountLocked = function() {
  return !!(this.security.accountLocked && this.security.lockedUntil && this.security.lockedUntil > Date.now());
};

// Method to increment login attempts
userSchema.methods.incrementLoginAttempts = async function() {
  // Reset attempts if lock has expired
  if (this.security.lockedUntil && this.security.lockedUntil < Date.now()) {
    return this.updateOne({
      $unset: {
        'security.lockedUntil': 1,
      },
      $set: {
        'security.accountLocked': false,
        'security.loginAttempts': 1,
      }
    });
  }

  const updates = { $inc: { 'security.loginAttempts': 1 } };
  const maxAttempts = 5;
  const lockTime = 2 * 60 * 60 * 1000; // 2 hours

  // Lock account if max attempts reached
  if (this.security.loginAttempts + 1 >= maxAttempts && !this.security.accountLocked) {
    updates.$set = {
      'security.accountLocked': true,
      'security.lockedUntil': Date.now() + lockTime,
    };
  }

  return this.updateOne(updates);
};

// Method to reset login attempts
userSchema.methods.resetLoginAttempts = async function() {
  return this.updateOne({
    $unset: {
      'security.loginAttempts': 1,
      'security.lockedUntil': 1,
    },
    $set: {
      'security.accountLocked': false,
    }
  });
};

// Method to safely return user data (without sensitive info)
userSchema.methods.toSafeObject = function() {
  const userObject = this.toObject();
  delete userObject.password;
  delete userObject.security.refreshTokens;
  return userObject;
};

module.exports = mongoose.model('User', userSchema);
