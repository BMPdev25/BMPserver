const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/user');
const Booking = require('../models/booking');
const Review = require('../models/review');

// Security middleware to ensure these routes NEVER run in production
router.use((req, res, next) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Forbidden: Test fixtures are disabled in production' });
  }
  next();
});

// Teardown API: Deletes all test records
router.post('/teardown', async (req, res) => {
  try {
    const userResult = await User.deleteMany({ isTestRecord: true });
    const bookingResult = await Booking.deleteMany({ isTestRecord: true });
    const reviewResult = await Review.deleteMany({ isTestRecord: true });

    res.json({
      success: true,
      deletedCount: {
        users: userResult.deletedCount,
        bookings: bookingResult.deletedCount,
        reviews: reviewResult.deletedCount
      }
    });
  } catch (error) {
    console.error('Teardown Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Seed API: Preps a Devotee, Priest, and Booking
router.post('/seed/booking', async (req, res) => {
  try {
    // First, force a teardown of old test data to ensure a clean slate
    await User.deleteMany({ isTestRecord: true });
    await Booking.deleteMany({ isTestRecord: true });
    await Review.deleteMany({ isTestRecord: true });

    const { bookingStatus = 'pending', paymentStatus = 'pending' } = req.body;
    
    // Hash passwords (keep it simple for tests)
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('password123', salt);

    // 1. Create Mock Devotee
    const devotee = await User.create({
      name: 'E2E Devotee',
      email: 'devotee_e2e@test.com',
      phone: '1234567890',
      password: hashedPassword,
      userType: 'devotee',
      isTestRecord: true
    });

    // 2. Create Mock Priest
    const priest = await User.create({
      name: 'E2E Priest Pandit',
      email: 'priest_e2e@test.com',
      phone: '9876543210',
      password: hashedPassword,
      userType: 'priest',
      isTestRecord: true,
      rating: { average: 5, count: 1 }
    });

    // 3. Create Mock Booking
    // Calculate a future date (tomorrow at 10 AM) or a past date depending on status
    const bookingDate = new Date();
    if (bookingStatus === 'completed') {
       bookingDate.setDate(bookingDate.getDate() - 1); // Yesterday
    } else {
       bookingDate.setDate(bookingDate.getDate() + 1); // Tomorrow
    }
    bookingDate.setHours(10, 0, 0, 0);

    const booking = await Booking.create({
      devoteeId: devotee._id,
      priestId: priest._id,
      ceremonyType: 'Ganesh Puja',
      date: bookingDate,
      startTime: '10:00',
      endTime: '12:00',
      location: {
        address: '123 E2E Test Lane',
        city: 'Mumbai',
        coordinates: { type: 'Point', coordinates: [72.8777, 19.0760] }
      },
      status: bookingStatus,
      paymentStatus: paymentStatus,
      basePrice: 1000,
      platformFee: 100,
      totalAmount: 1100,
      isTestRecord: true
    });

    res.json({
      success: true,
      data: {
        devotee: { phone: devotee.phone, password: 'password123', id: devotee._id },
        priest: { phone: priest.phone, password: 'password123', id: priest._id },
        booking: { id: booking._id, status: booking.status }
      }
    });

  } catch (error) {
    console.error('Seeding Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
