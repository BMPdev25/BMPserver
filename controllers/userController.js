// controllers/userController.js
const userService = require('../services/userService');
const User = require('../models/user');
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'sacred-connect/profile-pictures',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [
      { width: 400, height: 400, crop: 'fill', quality: 'auto' },
      { format: 'webp' },
    ],
  },
});

exports.upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'), false);
  },
});

exports.getProfile = async (req, res, next) => {
  try {
    const user = await userService.getProfile(req.user.id);
    res.json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};

exports.updateProfile = async (req, res, next) => {
  try {
    const user = await userService.updateProfile(req.user.id, req.body);
    res.json({ success: true, message: 'Profile updated successfully', data: user });
  } catch (error) {
    if (error.code === 11000) {
      const field = Object.keys(error.keyValue)[0];
      return res.status(400).json({
        success: false,
        message: `${field.charAt(0).toUpperCase() + field.slice(1)} already exists.`,
      });
    }
    next(error);
  }
};

exports.uploadProfilePicture = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
    const profilePicture = await userService.uploadProfilePicture(req.user.id, req.file);
    res.json({
      success: true,
      message: 'Profile picture uploaded successfully',
      data: { profilePicture },
    });
  } catch (error) {
    next(error);
  }
};

exports.deleteProfilePicture = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (user.profilePicture.publicId)
      await cloudinary.uploader.destroy(user.profilePicture.publicId).catch(() => {});
    user.profilePicture = { url: null, publicId: null, uploadedAt: null };
    await user.save();
    res.json({ success: true, message: 'Profile picture deleted successfully' });
  } catch (error) {
    next(error);
  }
};

exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword)
      return res.status(400).json({ success: false, message: 'Required fields missing' });
    if (newPassword.length < 8)
      return res.status(400).json({ success: false, message: 'Password too short' });
    await userService.changePassword(req.user.id, { currentPassword, newPassword });
    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    next(error);
  }
};

exports.updateSecuritySettings = async (req, res, next) => {
  try {
    const { twoFactorEnabled } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (typeof twoFactorEnabled !== 'undefined') user.security.twoFactorEnabled = twoFactorEnabled;
    await user.save();
    res.json({
      success: true,
      message: 'Security settings updated successfully',
      data: { twoFactorEnabled: user.security.twoFactorEnabled },
    });
  } catch (error) {
    next(error);
  }
};

exports.updatePrivacySettings = async (req, res, next) => {
  try {
    const user = await User.findByIdAndUpdate(req.user.id, { privacy: req.body }, { new: true });
    res.json({
      success: true,
      message: 'Privacy settings updated successfully',
      data: { privacy: user.privacy },
    });
  } catch (error) {
    next(error);
  }
};

exports.deleteAccount = async (req, res, next) => {
  try {
    const { password, confirmationText } = req.body;
    if (!password || confirmationText !== 'DELETE')
      return res.status(400).json({ success: false, message: 'Confirmation required' });
    await userService.deleteAccount(req.user.id, password);
    res.json({ success: true, message: 'Account deleted successfully' });
  } catch (error) {
    next(error);
  }
};
