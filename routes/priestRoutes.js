// routes/priestRoutes.js
const express = require('express');
const priestController = require('../controllers/priestController');
const bookingController = require('../controllers/bookingController');
const { protect, priestOnly } = require('../middleware/authMiddleware');

const router = express.Router();

// Public / Devotee accessible routes
router.get("/available", priestController.getAvailablePujaris);

// All following routes need authentication and priest role
router.use(protect);
router.use(priestOnly);

// Profile routes
router.put('/profile', priestController.updateProfile);
router.get('/profile', priestController.getProfile);
router.get('/profile-completion', priestController.getProfileCompletion);

// Booking routes
router.get('/bookings', priestController.getBookings);
router.get('/bookings/:bookingId', bookingController.getBookingDetails);
router.put('/bookings/:bookingId/status', priestController.updateBookingStatus);

// Earnings routes
router.get('/earnings', priestController.getEarnings);
router.post('/earnings/withdraw', priestController.requestWithdrawal);

// Transaction routes
router.get('/transactions', priestController.getTransactions);

// Notification routes
router.get('/notifications', priestController.getNotifications);
router.put('/notifications/:notificationId/read', priestController.markNotificationAsRead);
router.put('/notifications/mark-all-read', priestController.markAllNotificationsAsRead);

// Document upload route
const multer = require('multer');
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});
router.post('/documents', upload.single('document'), priestController.uploadDocument);

module.exports = router;
