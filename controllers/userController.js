// controllers/userController.js
const userService = require('../services/userService');
const User = require('../models/user');
const multer = require('multer');
const { uploadPublicFile, deletePublicFile } = require('../services/storageService');
const { priestProfilePicKey, devoteeProfilePicKey, keyFromPublicUrl } = require('../utils/s3Keys');

exports.upload = multer({
  storage: multer.memoryStorage(),
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
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Delete old picture from S3 if it was already migrated (old Cloudinary URLs silently skipped)
    if (user.profilePicture?.url) {
      const oldKey = keyFromPublicUrl(user.profilePicture.url);
      if (oldKey) await deletePublicFile(oldKey).catch(() => {});
    }

    // Key is deterministic from userId — no need to store it separately
    const keyFn = user.userType === 'priest' ? priestProfilePicKey : devoteeProfilePicKey;
    const key = keyFn(user._id.toString());

    const url = await uploadPublicFile(req.file.buffer, key, req.file.mimetype);

    user.profilePicture = { url, uploadedAt: new Date() };
    await user.save();

    res.status(200).json({
      success: true,
      data: { profilePicture: user.profilePicture },
      message: 'Profile picture updated',
    });
  } catch (error) {
    next(error);
  }
};

exports.deleteProfilePicture = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    // Delete from S3 if migrated (old Cloudinary URLs silently skipped)
    if (user.profilePicture?.url) {
      const oldKey = keyFromPublicUrl(user.profilePicture.url);
      if (oldKey) await deletePublicFile(oldKey).catch(() => {});
    }

    user.profilePicture = { url: null, uploadedAt: null };
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

// Update notification preferences
exports.updateNotificationPreferences = async (req, res) => {
  try {
    const { email, push } = req.body;
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    if (email) {
      for (const key in email) {
        user.notifications.email[key] = email[key];
      }
    }

    if (push) {
      for (const key in push) {
        user.notifications.push[key] = push[key];
      }
    }

    user.markModified('notifications');
    await user.save();

    res.json({
      success: true,
      message: 'Notification preferences updated successfully',
      data: {
        notifications: user.notifications,
      },
    });
  } catch (error) {
    console.error('Update notification preferences error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update notification preferences',
      error: error.message,
    });
  }
};

exports.savePushToken = async (req, res, next) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Push token is required',
      });
    }
    await User.findByIdAndUpdate(req.user.id, {
      expoPushToken: token,
    });
    res.status(200).json({
      success: true,
      message: 'Push token saved',
    });
  } catch (error) {
    next(error);
  }
};

// Delete account
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
