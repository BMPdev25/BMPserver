// routes/devoteeRoutes.js
const express = require('express');
const devoteeController = require('../controllers/devoteeController');
const { protect, devoteeOnly } = require('../middleware/authMiddleware');

const router = express.Router();

// Public routes (no authentication required)
router.get('/priests/all', devoteeController.getAllPriests);
router.get('/priests', devoteeController.searchPriests);
router.get('/priests/:priestId', devoteeController.getPriestDetails);

// Protected routes (need authentication and devotee role)
router.get('/bookings', protect, devoteeOnly, devoteeController.getBookings);
router.post('/bookings', protect, devoteeOnly, devoteeController.createBooking);
router.get('/pending-actions', protect, devoteeOnly, devoteeController.getPendingActions);

// Add devotee profile update route
router.put('/profile', protect, devoteeOnly, devoteeController.updateProfile);

// Notification routes
router.get('/notifications', protect, devoteeOnly, devoteeController.getNotifications);
router.put('/notifications/:notificationId/read', protect, devoteeOnly, devoteeController.markNotificationAsRead);
router.put('/notifications/mark-all-read', protect, devoteeOnly, devoteeController.markAllNotificationsAsRead);

// Address Management
router.get('/addresses', protect, devoteeController.getAddresses);
router.post('/addresses', protect, devoteeController.addAddress);
router.put('/addresses/:addressId', protect, devoteeController.updateAddress);
router.delete('/addresses/:addressId', protect, devoteeController.deleteAddress);

module.exports = router;