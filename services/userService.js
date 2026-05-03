// services/userService.js
const User = require('../models/user');
const bcrypt = require('bcryptjs');
const cloudinary = require('cloudinary').v2;

const getProfile = async (userId) => {
  const user = await User.findById(userId)
    .select('-password -security.refreshTokens')
    .populate('languagesSpoken');

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
  })
    .select('-password -security.refreshTokens')
    .populate('languagesSpoken');

  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  return user.toSafeObject();
};

const uploadProfilePicture = async (userId, file) => {
  const user = await User.findById(userId);
  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  // Delete old profile picture if exists
  if (user.profilePicture.publicId) {
    await cloudinary.uploader.destroy(user.profilePicture.publicId).catch(() => {});
  }

  user.profilePicture = {
    url: file.path,
    publicId: file.filename,
    uploadedAt: new Date(),
  };

  await user.save();
  return user.profilePicture;
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

  if (user.profilePicture.publicId) {
    await cloudinary.uploader.destroy(user.profilePicture.publicId).catch(() => {});
  }

  await User.findByIdAndDelete(userId);
  return true;
};

module.exports = {
  getProfile,
  updateProfile,
  uploadProfilePicture,
  changePassword,
  deleteAccount,
};
