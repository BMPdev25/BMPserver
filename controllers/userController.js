// controllers/userController.js
const User = require('../models/user');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configure multer for profile picture uploads
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'sacred-connect/profile-pictures',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [
      { width: 400, height: 400, crop: 'fill', quality: 'auto' },
      { format: 'webp' }
    ],
  },
});

const upload = multer({ 
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// Get user profile
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('-password -security.refreshTokens')
      .populate('languagesSpoken');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: user.toSafeObject()
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Update user profile
const updateProfile = async (req, res) => {
  try {
    const { name, email, phone, languagesSpoken, privacy, notifications } = req.body;
    const userId = req.user.id;

    const updateData = {};
    
    if (name) updateData.name = name.trim();
    if (email) updateData.email = email.trim();
    if (phone) updateData.phone = phone.trim();
    if (languagesSpoken) updateData.languagesSpoken = languagesSpoken;
    if (privacy) updateData.privacy = { ...privacy };
    if (notifications) updateData.notifications = { ...notifications };

    const user = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    )
      .select('-password -security.refreshTokens')
      .populate('languagesSpoken');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: user.toSafeObject()
    });
  } catch (error) {
    console.error('Update profile error:', error);
    
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({
        success: false,
        message: `${field} is already in use`
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Upload profile picture
const uploadProfilePicture = async (req, res) => {
  try {
    const userId = req.user.id;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Delete old profile picture if exists
    if (user.profilePicture.publicId) {
      try {
        await cloudinary.uploader.destroy(user.profilePicture.publicId);
      } catch (deleteError) {
        console.warn('Failed to delete old profile picture:', deleteError);
      }
    }

    // Update user with new profile picture
    user.profilePicture = {
      url: req.file.path,
      publicId: req.file.filename,
      uploadedAt: new Date()
    };

    await user.save();

    res.json({
      success: true,
      message: 'Profile picture uploaded successfully',
      data: {
        profilePicture: user.profilePicture
      }
    });
  } catch (error) {
    console.error('Upload profile picture error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload profile picture',
      error: error.message
    });
  }
};

// Delete profile picture
const deleteProfilePicture = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (!user.profilePicture.publicId) {
      return res.status(400).json({
        success: false,
        message: 'No profile picture to delete'
      });
    }

    // Delete from Cloudinary
    try {
      await cloudinary.uploader.destroy(user.profilePicture.publicId);
    } catch (deleteError) {
      console.warn('Failed to delete from Cloudinary:', deleteError);
    }

    // Remove from user document
    user.profilePicture = {
      url: null,
      publicId: null,
      uploadedAt: null
    };

    await user.save();

    res.json({
      success: true,
      message: 'Profile picture deleted successfully'
    });
  } catch (error) {
    console.error('Delete profile picture error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete profile picture',
      error: error.message
    });
  }
};

// Change password
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required'
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 8 characters long'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Verify current password
    const isValidPassword = await user.comparePassword(currentPassword);
    if (!isValidPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update password and security info
    user.password = hashedPassword;
    user.security.lastPasswordChange = new Date();
    user.security.refreshTokens = []; // Invalidate all refresh tokens

    await user.save();

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to change password',
      error: error.message
    });
  }
};

// Update security settings
const updateSecuritySettings = async (req, res) => {
  try {
    const { twoFactorEnabled } = req.body;
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (typeof twoFactorEnabled !== 'undefined') {
      user.security.twoFactorEnabled = twoFactorEnabled;
    }

    await user.save();

    res.json({
      success: true,
      message: 'Security settings updated successfully',
      data: {
        twoFactorEnabled: user.security.twoFactorEnabled
      }
    });
  } catch (error) {
    console.error('Update security settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update security settings',
      error: error.message
    });
  }
};

// Update privacy settings
const updatePrivacySettings = async (req, res) => {
  try {
    const { profileVisibility, showPhoneNumber, showEmail, dataProcessingConsent, marketingConsent } = req.body;
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const updates = {};
    if (typeof profileVisibility !== 'undefined') updates['privacy.profileVisibility'] = profileVisibility;
    if (typeof showPhoneNumber !== 'undefined') updates['privacy.showPhoneNumber'] = showPhoneNumber;
    if (typeof showEmail !== 'undefined') updates['privacy.showEmail'] = showEmail;
    if (typeof dataProcessingConsent !== 'undefined') updates['privacy.dataProcessingConsent'] = dataProcessingConsent;
    if (typeof marketingConsent !== 'undefined') updates['privacy.marketingConsent'] = marketingConsent;

    await User.findByIdAndUpdate(userId, updates);

    const updatedUser = await User.findById(userId).select('-password -security.refreshTokens');

    res.json({
      success: true,
      message: 'Privacy settings updated successfully',
      data: {
        privacy: updatedUser.privacy
      }
    });
  } catch (error) {
    console.error('Update privacy settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update privacy settings',
      error: error.message
    });
  }
};

// Update notification preferences
const updateNotificationPreferences = async (req, res) => {
  try {
    const { email, push } = req.body;
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (email) {
      user.notifications.email = { ...user.notifications.email, ...email };
    }

    if (push) {
      user.notifications.push = { ...user.notifications.push, ...push };
    }

    await user.save();

    res.json({
      success: true,
      message: 'Notification preferences updated successfully',
      data: {
        notifications: user.notifications
      }
    });
  } catch (error) {
    console.error('Update notification preferences error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update notification preferences',
      error: error.message
    });
  }
};

// Delete account
const deleteAccount = async (req, res) => {
  try {
    const { password, confirmationText } = req.body;
    const userId = req.user.id;

    if (!password || confirmationText !== 'DELETE') {
      return res.status(400).json({
        success: false,
        message: 'Password and confirmation text "DELETE" are required'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Verify password
    const isValidPassword = await user.comparePassword(password);
    if (!isValidPassword) {
      return res.status(400).json({
        success: false,
        message: 'Incorrect password'
      });
    }

    // Delete profile picture from Cloudinary if exists
    if (user.profilePicture.publicId) {
      try {
        await cloudinary.uploader.destroy(user.profilePicture.publicId);
      } catch (deleteError) {
        console.warn('Failed to delete profile picture during account deletion:', deleteError);
      }
    }

    // Delete user account
    await User.findByIdAndDelete(userId);

    res.json({
      success: true,
      message: 'Account deleted successfully'
    });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete account',
      error: error.message
    });
  }
};

module.exports = {
  upload,
  getProfile,
  updateProfile,
  uploadProfilePicture,
  deleteProfilePicture,
  changePassword,
  updateSecuritySettings,
  updatePrivacySettings,
  updateNotificationPreferences,
  deleteAccount,
};
