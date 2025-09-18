// routes/userRoutes.js
const express = require('express');
const router = express.Router();
const {
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
} = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');
const rateLimit = require('express-rate-limit');

// Rate limiting for sensitive operations
const passwordChangeLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3, // limit each IP to 3 password change requests per windowMs
  message: {
    success: false,
    message: 'Too many password change attempts. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const profileUpdateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 profile updates per windowMs
  message: {
    success: false,
    message: 'Too many profile update attempts. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const uploadLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // limit each IP to 5 uploads per hour
  message: {
    success: false,
    message: 'Too many upload attempts. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply authentication middleware to all routes
router.use(protect);

// Profile management routes
router.get('/profile', getProfile);
router.put('/profile', profileUpdateLimit, updateProfile);

// Profile picture management
router.post('/profile/picture', uploadLimit, upload.single('profilePicture'), uploadProfilePicture);
router.delete('/profile/picture', deleteProfilePicture);

// Security routes
router.post('/security/change-password', passwordChangeLimit, changePassword);
router.put('/security/settings', updateSecuritySettings);

// Privacy routes
router.put('/privacy/settings', updatePrivacySettings);

// Notification preferences
router.put('/notifications', updateNotificationPreferences);

// Account deletion (high-risk operation)
router.delete('/account', rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 1, // only 1 attempt per day
  message: {
    success: false,
    message: 'Account deletion can only be attempted once per day.'
  }
}), deleteAccount);

// Error handling middleware for multer errors
router.use((error, req, res, next) => {
  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      message: 'File size too large. Maximum size allowed is 5MB.'
    });
  }

  if (error.message === 'Only image files are allowed') {
    return res.status(400).json({
      success: false,
      message: 'Only image files are allowed for profile pictures.'
    });
  }

  next(error);
});

module.exports = router;
