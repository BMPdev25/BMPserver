// routes/priestRoutes.js
const express = require('express');
const priestController = require('../controllers/priestController');
const { protect, priestOnly } = require('../middleware/authMiddleware');

const router = express.Router();

// All priest routes need authentication and priest role
// router.use(protect);
// router.use(priestOnly);

// Profile routes
router.put('/profile', priestController.updateProfile);
router.get('/profile', priestController.getProfile);

// Booking routes
router.get('/bookings', priestController.getBookings);
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

module.exports = router;
