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
