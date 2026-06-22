// services/userService.js
const User = require('../models/user');
const bcrypt = require('bcryptjs');
const { deletePublicFile } = require('./storageService');
const { keyFromPublicUrl } = require('../utils/s3Keys');

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
  const user = await User.findByIdAndUpdate(userId, updateData, {
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

  const isValidPassword = await user.comparePassword(password);
  if (!isValidPassword) {
    const error = new Error('Incorrect password');
    error.statusCode = 400;
    throw error;
  }

  // Delete profile picture from S3 if it was already migrated (old Cloudinary URLs silently skipped)
  if (user.profilePicture?.url) {
    const oldKey = keyFromPublicUrl(user.profilePicture.url);
    if (oldKey) await deletePublicFile(oldKey).catch(() => {});
  }

  await User.findByIdAndDelete(userId);
  return true;
};

module.exports = {
  getProfile,
  updateProfile,
  changePassword,
  deleteAccount,
};
