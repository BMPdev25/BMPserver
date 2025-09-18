// routes/bookingRoutes.js
const express = require('express');
const router = express.Router();
const {
  getBookings,
  getBookingDetails,
  createBooking,
  updateBookingStatus,
  markAsCompleted,
  createPaymentOrder,
  verifyPayment,
  getPaymentDetails,
} = require('../controllers/bookingController');
const { protect } = require('../middleware/authMiddleware');
const rateLimit = require('express-rate-limit');

// Rate limiting
const bookingCreationLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 booking creations per windowMs
  message: {
    success: false,
    message: 'Too many booking attempts. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const paymentLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 payment attempts per windowMs
  message: {
    success: false,
    message: 'Too many payment attempts. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply authentication middleware to all routes
router.use(protect);

// Booking management routes
router.get('/', getBookings);
router.get('/:bookingId', getBookingDetails);
router.post('/', bookingCreationLimit, createBooking);

// Booking status management
router.put('/:bookingId/status', updateBookingStatus);
router.post('/:bookingId/complete', markAsCompleted);

// Payment routes
router.post('/payment/order', paymentLimit, createPaymentOrder);
router.post('/payment/verify', paymentLimit, verifyPayment);
router.get('/:bookingId/payment', getPaymentDetails);

module.exports = router;
