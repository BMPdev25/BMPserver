// tests/cancellation_test.js
const mongoose = require('mongoose');
const Booking = require('../models/booking');
const User = require('../models/user');
const { updateDevoteeReliability } = require('../utils/reliabilityEngine');
require('dotenv').config();

async function testCancellationPolicy() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // 1. Find or create a test devotee
    let devotee = await User.findOne({ userType: 'devotee' });
    if (!devotee) {
      console.log('No devotee found. Creating a temporary test devotee...');
      devotee = new User({
        name: 'Test Devotee',
        email: 'test_devotee_' + Date.now() + '@example.com',
        phone: '99999' + Math.floor(Math.random() * 100000),
        password: 'password123',
        userType: 'devotee'
      });
      await devotee.save();
    }

    // 2. Find or create a test priest
    let priest = await User.findOne({ userType: 'priest' });
    if (!priest) {
      console.log('No priest found. Creating a temporary test priest...');
      priest = new User({
        name: 'Test Priest',
        email: 'test_priest_' + Date.now() + '@example.com',
        phone: '88888' + Math.floor(Math.random() * 100000),
        password: 'password123',
        userType: 'priest'
      });
      await priest.save();
    }

    // 2. Test Case A: > 72 hours (Full Refund)
    console.log('\n--- Test Case A: > 72 hours (Full Refund) ---');
    const dateA = new Date();
    dateA.setDate(dateA.getDate() + 4); // 4 days away
    
    const bookingA = new Booking({
      devoteeId: devotee._id,
      priestId: priest._id,
      ceremonyType: 'Ganesh Puja',
      date: dateA,
      startTime: '10:00',
      endTime: '12:00',
      location: { address: 'Test Address', city: 'Test City' },
      basePrice: 1000,
      platformFee: 50,
      totalAmount: 1050,
      status: 'confirmed',
      paymentStatus: 'completed'
    });
    await bookingA.save();

    // Simulate devotee cancellation logic (copied from controller for pure logic check)
    const diffHoursA = (dateA.getTime() - new Date().getTime()) / (1000 * 60 * 60);
    console.log(`Diff Hours: ${diffHoursA.toFixed(2)}`);
    let refundA = diffHoursA > 72 ? bookingA.totalAmount : (diffHoursA >= 24 ? bookingA.basePrice : 0);
    console.log(`Expected Refund: 1050, Actual: ${refundA}`);

    // 3. Test Case B: 24-72 hours (Partial Refund)
    console.log('\n--- Test Case B: 48 hours (Partial Refund) ---');
    const dateB = new Date();
    dateB.setDate(dateB.getDate() + 2); // 48 hours away
    
    const bookingB = new Booking({
      devoteeId: devotee._id,
      priestId: priest._id,
      ceremonyType: 'Ganesh Puja',
      date: dateB,
      startTime: '10:00',
      endTime: '12:00',
      location: { address: 'Test Address', city: 'Test City' },
      basePrice: 1000,
      platformFee: 50,
      totalAmount: 1050,
      status: 'confirmed',
      paymentStatus: 'completed'
    });
    await bookingB.save();

    const diffHoursB = (dateB.getTime() - new Date().getTime()) / (1000 * 60 * 60);
    console.log(`Diff Hours: ${diffHoursB.toFixed(2)}`);
    let refundB = diffHoursB > 72 ? bookingB.totalAmount : (diffHoursB >= 24 ? bookingB.basePrice : 0);
    console.log(`Expected Refund: 1000, Actual: ${refundB}`);

    // 4. Test Case C: < 24 hours (No Refund)
    console.log('\n--- Test Case C: 5 hours (No Refund) ---');
    const dateC = new Date();
    dateC.setHours(dateC.getHours() + 5); // 5 hours away
    
    const bookingC = new Booking({
      devoteeId: devotee._id,
      priestId: priest._id,
      ceremonyType: 'Ganesh Puja',
      date: dateC,
      startTime: '10:00',
      endTime: '12:00',
      location: { address: 'Test Address', city: 'Test City' },
      basePrice: 1000,
      platformFee: 50,
      totalAmount: 1050,
      status: 'confirmed',
      paymentStatus: 'completed'
    });
    await bookingC.save();

    const diffHoursC = (dateC.getTime() - new Date().getTime()) / (1000 * 60 * 60);
    console.log(`Diff Hours: ${diffHoursC.toFixed(2)}`);
    let refundC = diffHoursC > 72 ? bookingC.totalAmount : (diffHoursC >= 24 ? bookingC.basePrice : 0);
    console.log(`Expected Refund: 0, Actual: ${refundC}`);

    // 5. Test Reliability Update
    console.log('\n--- Test Reliability Score Update ---');
    const initialScore = devotee.devoteeReliability?.score || 100;
    console.log(`Initial Score: ${initialScore}`);
    
    await updateDevoteeReliability(devotee._id, 'late_cancellation');
    const updatedUser = await User.findById(devotee._id);
    console.log(`Score after Late Cancellation: ${updatedUser.devoteeReliability.score}`);
    console.log(`Expected roughly: ${initialScore - 20}`);

    // Cleanup
    await Booking.deleteMany({ _id: { $in: [bookingA._id, bookingB._id, bookingC._id] } });
    console.log('\nTest bookings cleaned up.');
    
    await mongoose.disconnect();
  } catch (err) {
    console.error('Test failed:', err);
    process.exit(1);
  }
}

testCancellationPolicy();
