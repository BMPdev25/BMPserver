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
    required: function() { return !this.firebaseUid; } // Password not required if firebaseUid exists
  },
  firebaseUid: {
    type: String,
    sparse: true,
    unique: true
  },
  userType: {
    type: String,
    enum: ['priest', 'devotee'],
    required: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  isVerified: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  // Security-related fields with sensible defaults
  security: {
    loginAttempts: { type: Number, default: 0 },
    accountLocked: { type: Boolean, default: false },
    lockedUntil: { type: Date, default: null },
    lastPasswordChange: { type: Date, default: null },
    twoFactorEnabled: { type: Boolean, default: false },
    refreshTokens: { type: Array, default: [] },
  },
  // Notification preference defaults
  notifications: {
    email: {
      bookingUpdates: { type: Boolean, default: true },
      promotions: { type: Boolean, default: false },
      reminders: { type: Boolean, default: true }
    },
    push: {
      bookingUpdates: { type: Boolean, default: true },
      promotions: { type: Boolean, default: false },
      reminders: { type: Boolean, default: true }
    }
  },
  // Address Management
  addresses: [{
    type: {
      type: String,
      enum: ['Home', 'Work', 'Other'],
      default: 'Home'
    },
    street: String,
    area: String,
    city: String,
    state: String,
    zip: String,
    landmark: String,
    isDefault: {
      type: Boolean,
      default: false
    }
  }],
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
  // Ensure security object exists with defaults on save for older documents
  if (!this.security) {
    this.security = {
      loginAttempts: 0,
      accountLocked: false,
      lockedUntil: null,
      lastPasswordChange: null,
      twoFactorEnabled: false,
      refreshTokens: [],
    };
  }
  next();
});

// Password comparison method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Method to check if account is locked
userSchema.methods.isAccountLocked = function() {
  // Guard against missing security object
  if (!this.security) return false;
  return !!(this.security.accountLocked && this.security.lockedUntil && this.security.lockedUntil > Date.now());
};

// Method to increment login attempts
userSchema.methods.incrementLoginAttempts = async function() {
  // Reset attempts if lock has expired
  // Guard against missing security object
  if (!this.security) {
    this.security = { loginAttempts: 0, accountLocked: false, lockedUntil: null };
  }

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
  if ((this.security.loginAttempts || 0) + 1 >= maxAttempts && !this.security.accountLocked) {
    updates.$set = {
      'security.accountLocked': true,
      'security.lockedUntil': Date.now() + lockTime,
    };
  }

  return this.updateOne(updates);
};

// Method to reset login attempts
userSchema.methods.resetLoginAttempts = async function() {
  // Ensure security object exists
  if (!this.security) {
    this.security = { loginAttempts: 0, accountLocked: false, lockedUntil: null };
  }

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
  // Guard against cases where security or refreshTokens might be undefined
  if (userObject.security && Object.prototype.hasOwnProperty.call(userObject.security, 'refreshTokens')) {
    delete userObject.security.refreshTokens;
  }
  return userObject;
};

module.exports = mongoose.model('User', userSchema);
