// routes/priestRoutes.js
const express = require('express');
const priestController = require('../controllers/priestController');
const bookingController = require('../controllers/bookingController');
const { protect, priestOnly, verifiedPriestOnly } = require('../middleware/authMiddleware');
const validate = require('../middleware/validate');
const { updatePriestProfileRules } = require('../validators/profileValidators');

const router = express.Router();

// Public / Devotee accessible routes
router.get('/available', priestController.getAvailablePujaris);
router.get('/public/:priestProfileId', priestController.getPublicProfile);
router.get('/public/:priestProfileId/reviews', priestController.getPublicReviews);

// All priest routes require authentication
router.use(protect);
router.use(priestOnly);

// Onboarding routes — accessible to all priests regardless of verification status
router.put('/profile', updatePriestProfileRules, validate, priestController.updateProfile);
router.get('/profile', priestController.getProfile);
router.get('/profile-completion', priestController.getProfileCompletion);
router.put('/status', priestController.toggleStatus);
router.post('/submit-verification', priestController.submitVerification);

const multer = require('multer');
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'application/pdf'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only JPG, PNG, and PDF files allowed'), false);
  },
});
router.post('/documents', upload.single('document'), priestController.uploadDocument);
router.get('/documents/:documentType', priestController.getDocument);

// Operational routes — require admin verification
router.get('/bookings', verifiedPriestOnly, priestController.getBookings);
router.get('/bookings/pending-actions', verifiedPriestOnly, priestController.getPendingActions);
router.get('/bookings/instant-available', verifiedPriestOnly, priestController.getInstantAvailable);
router.post('/bookings/instant/accept', verifiedPriestOnly, priestController.acceptInstantBooking);
router.get('/bookings/:bookingId', verifiedPriestOnly, bookingController.getBookingDetails);
router.put('/bookings/:bookingId/status', verifiedPriestOnly, priestController.updateBookingStatus);

router.get('/earnings', verifiedPriestOnly, priestController.getEarnings);
router.post('/earnings/withdraw', verifiedPriestOnly, priestController.requestWithdrawal);
router.get('/transactions', verifiedPriestOnly, priestController.getTransactions);

// Notifications available to all priests
router.get('/notifications', priestController.getNotifications);
router.put('/notifications/:notificationId/read', priestController.markNotificationAsRead);
router.put('/notifications/mark-all-read', priestController.markAllNotificationsAsRead);

module.exports = router;
