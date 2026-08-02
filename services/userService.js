// services/userService.js
const User = require('../models/user');
const bcrypt = require('bcryptjs');
const { deletePublicFile } = require('./storageService');
const { keyFromPublicUrl } = require('../utils/s3Keys');
const PriestProfile = require('../models/priestProfile');
const DevoteeProfile = require('../models/devoteeProfile');
const Wallet = require('../models/wallet');
const Notification = require('../models/notification');
const Booking = require('../models/booking');

const getProfile = async (userId) => {
  const user = await User.findById(userId).select('-password -__v -security.refreshTokens');

  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  return user.toSafeObject();
};

const updateProfile = async (userId, updateData) => {
  const allowed = ['name', 'phone', 'familyDetails', 'dateOfBirth', 'languagesSpoken'];
  const safeUpdate = {};
  for (const key of allowed) {
    if (updateData[key] !== undefined) safeUpdate[key] = updateData[key];
  }

  const user = await User.findByIdAndUpdate(userId, safeUpdate, {
    new: true,
    runValidators: true,
  }).select('-password -__v -security.refreshTokens');

  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  return user.toSafeObject();
};

const changePassword = async (userId, { currentPassword, newPassword }) => {
  const user = await User.findById(userId);
  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  const isValidPassword = await user.comparePassword(currentPassword);
  if (!isValidPassword) {
    const error = new Error('Current password is incorrect');
    error.statusCode = 400;
    throw error;
  }

  const salt = await bcrypt.genSalt(12);
  user.password = await bcrypt.hash(newPassword, salt);
  user.security.lastPasswordChange = new Date();
  user.security.refreshTokens = [];

  await user.save();
  return true;
};

const deleteAccount = async (userId, password) => {
  const user = await User.findById(userId);
  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  // Firebase-only users have no local password — skip the password check for them.
  const isFirebaseOnly = !!user.firebaseUid && !user.password;
  if (!isFirebaseOnly) {
    const isValidPassword = await user.comparePassword(password);
    if (!isValidPassword) {
      const error = new Error('Incorrect password');
      error.statusCode = 400;
      throw error;
    }
  }

  // For priests: guard against deleting a wallet with an outstanding balance.
  if (user.userType === 'priest') {
    const wallet = await Wallet.findOne({ priestId: userId });
    if (wallet && wallet.currentBalance > 0) {
      const error = new Error(
        'Please withdraw your wallet balance before deleting your account.'
      );
      error.statusCode = 400;
      throw error;
    }
  }

  // Delete profile picture from S3 if it was already migrated (old Cloudinary URLs silently skipped)
  if (user.profilePicture?.url) {
    const oldKey = keyFromPublicUrl(user.profilePicture.url);
    if (oldKey) await deletePublicFile(oldKey).catch(() => {});
  }

  // Cascade: anonymize bookings (preserve the other party's history), then delete
  // profiles, wallet, notifications, and finally the User doc.
  await Booking.updateMany(
    { devoteeId: userId },
    { $set: { devoteeId: null, devoteeDeleted: true } }
  );
  await Booking.updateMany(
    { priestId: userId },
    { $set: { priestDeleted: true } }
  );

  await PriestProfile.deleteOne({ userId });
  await DevoteeProfile.deleteOne({ userId });
  await Wallet.deleteOne({ priestId: userId });
  await Notification.deleteMany({ userId });
  await User.findByIdAndDelete(userId);

  return true;
};

module.exports = {
  getProfile,
  updateProfile,
  changePassword,
  deleteAccount,
};
