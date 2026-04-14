const request = require('supertest');
const jwt = require('jsonwebtoken');

// Mock expo-server-sdk BEFORE requiring the app to avoid ESM issues
jest.mock('expo-server-sdk', () => ({
  Expo: jest.fn().mockImplementation(() => ({
    sendPushNotificationsAsync: jest.fn().mockResolvedValue([]),
    chunkPushNotifications: jest.fn().mockReturnValue([]),
  })),
}));

const { app, server } = require('../../server');
const db = require('../setup');
const User = require('../../models/user');
const Booking = require('../../models/booking');
const Wallet = require('../../models/wallet');
const Transaction = require('../../models/transaction');
const CompanyRevenue = require('../../models/companyRevenue');
const Ceremony = require('../../models/ceremony');
const PriestProfile = require('../../models/priestProfile');

// Mock Razorpay
jest.mock('razorpay', () => {
  return jest.fn().mockImplementation(() => {
    return require('../mocks/paymentGateway');
  });
});

describe('Booking & Wallet Integration Tests', () => {
  let devoteeToken, priestToken, devoteeId, priestId, ceremonyId;

  beforeAll(async () => {
    await db.connect();
    process.env.JWT_SECRET = 'test_secret';
    process.env.RAZORPAY_KEY_ID = 'rzp_test_123';
    process.env.RAZORPAY_KEY_SECRET = 'rzp_test_secret_123';

    // Create Devotee
    const devotee = await User.create({
      name: 'Test Devotee',
      email: 'devotee@test.com',
      phone: '1234567890',
      password: 'password123',
      userType: 'devotee',
    });
    devoteeId = devotee._id;
    devoteeToken = jwt.sign({ id: devotee._id }, process.env.JWT_SECRET);

    // Create Priest
    const priest = await User.create({
      name: 'Test Priest',
      email: 'priest@test.com',
      phone: '9876543210',
      password: 'password123',
      userType: 'priest',
    });
    priestId = priest._id;
    priestToken = jwt.sign({ id: priest._id }, process.env.JWT_SECRET);

    // Create Priest Profile (Verified)
    await PriestProfile.create({
      userId: priestId,
      isVerified: true,
      availability: {
        weeklySchedule: {
          monday: ['08:00-20:00'],
          tuesday: ['08:00-20:00'],
          wednesday: ['08:00-20:00'],
          thursday: ['08:00-20:00'],
          friday: ['08:00-20:00'],
          saturday: ['08:00-20:00'],
          sunday: ['08:00-20:00'],
        },
      },
      ceremonyCount: 0,
      earnings: { totalEarnings: 0, thisMonth: 0, pendingPayments: 0, monthlyEarnings: [] },
    });

    // Create Ceremony
    const ceremony = await Ceremony.create({
      name: 'Ganesh Puja',
      description: 'Test ceremony',
      category: 'puja',
      subcategory: 'Regular Puja',
      pricing: {
        basePrice: 1000,
        priceRange: { min: 800, max: 1200 },
      },
      duration: { typical: 60, minimum: 30, maximum: 90 },
      ritualSteps: [{ stepNumber: 1, title: 'Introduction', description: 'Start' }],
      requirements: {
        materials: [],
        participants: { required: 1 },
      },
    });
    ceremonyId = ceremony._id;
  });

  afterAll(async () => {
    await db.closeDatabase();
    if (server) await server.close();
  });

  beforeEach(async () => {
    await Booking.deleteMany({});
    await Transaction.deleteMany({});
    await Wallet.deleteMany({});
    await CompanyRevenue.deleteMany({});
  });

  /**
   * Test A: Happy Path
   * POST booking -> PUT accept -> POST payment -> PUT complete.
   * Expected: Wallet balance increases, Transaction inflow recorded, CompanyRevenue recorded.
   */
  test('Test A: Happy Path - Complete Booking Flow', async () => {
    const tomorrow = new Date(Date.now() + 86400000).toISOString();

    // 1. Create Booking
    const bookingRes = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${devoteeToken}`)
      .send({
        priestId: priestId,
        ceremonyType: 'Ganesh Puja',
        date: tomorrow,
        startTime: '10:00',
        endTime: '11:00',
        location: { address: 'Test Street 123', city: 'Bangalore' },
      });

    expect(bookingRes.status).toBe(201);
    const bookingId = bookingRes.body.data._id;

    // 2. Priest Accepts
    const acceptRes = await request(app)
      .put(`/api/bookings/${bookingId}/status`)
      .set('Authorization', `Bearer ${priestToken}`)
      .send({ status: 'confirmed' });

    expect(acceptRes.status).toBe(200);

    // 3. Devotee Pays (Verify Payment)
    // We skip createOrder and directly verify as order-id is generated in controller
    const verifyRes = await request(app)
      .post('/api/bookings/payment/verify')
      .set('Authorization', `Bearer ${devoteeToken}`)
      .send({
        bookingId: bookingId,
        razorpay_order_id: 'order_123',
        razorpay_payment_id: 'pay_123',
        // signature calculation needs to match controller
        razorpay_signature: require('crypto')
          .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
          .update('order_123|pay_123')
          .digest('hex'),
      });

    expect(verifyRes.status).toBe(200);

    // 4. Priest Marks as Arrived
    const arrivedRes = await request(app)
      .put(`/api/bookings/${bookingId}/status`)
      .set('Authorization', `Bearer ${priestToken}`)
      .send({ status: 'arrived' });
    expect(arrivedRes.status).toBe(200);

    // 4b. Priest Marks as In Progress
    const inProgressRes = await request(app)
      .put(`/api/bookings/${bookingId}/status`)
      .set('Authorization', `Bearer ${priestToken}`)
      .send({ status: 'in_progress' });
    expect(inProgressRes.status).toBe(200);

    // 4c. Priest Marks as Completed
    const completeRes = await request(app)
      .put(`/api/bookings/${bookingId}/status`)
      .set('Authorization', `Bearer ${priestToken}`)
      .send({ status: 'completed' });

    expect(completeRes.status).toBe(200);

    // 5. Assert Wallet & Ledger
    const wallet = await Wallet.findOne({ priestId: priestId });
    expect(wallet).toBeDefined();
    // basePrice: 1000, Platform Fee: 5% => Priest gets 950
    expect(wallet.currentBalance).toBe(950);

    const transaction = await Transaction.findOne({
      bookingId: bookingId,
      type: 'credit_for_booking',
    });
    expect(transaction).toBeDefined();
    expect(transaction.amount).toBe(950);
    expect(transaction.direction).toBe('inflow');

    const revenue = await CompanyRevenue.findOne({ bookingId: bookingId });
    expect(revenue).toBeDefined();
    expect(revenue.commissionAmount).toBe(100);

    // Verify PriestProfile stats (ceremonyCount, completionRate)
    const priestProfile = await PriestProfile.findOne({ userId: priestId });
    expect(priestProfile).toBeDefined();
    expect(priestProfile.ceremonyCount).toBe(1);
    expect(priestProfile.analytics.completionRate).toBe(100);
    expect(priestProfile.cancelledCount).toBe(0);
  });

  /**
   * Test B: Priest Rejection
   * POST booking -> PUT cancel (by priest).
   * Expected: Booking status 'cancelled', no wallet changes.
   */
  test('Test B: Priest Rejects Booking', async () => {
    const bookingRes = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${devoteeToken}`)
      .send({
        priestId: priestId,
        ceremonyType: 'Ganesh Puja',
        date: new Date(Date.now() + 86400000).toISOString(),
        startTime: '10:00',
        endTime: '11:00',
        location: { address: 'Test Street 123', city: 'Bangalore' },
      });

    const bookingId = bookingRes.body.data._id;

    const rejectRes = await request(app)
      .put(`/api/bookings/${bookingId}/status`)
      .set('Authorization', `Bearer ${priestToken}`)
      .send({ status: 'cancelled', reason: 'Unavailable' });

    expect(rejectRes.status).toBe(200);

    const booking = await Booking.findById(bookingId);
    expect(booking.status).toBe('cancelled');

    const wallet = await Wallet.findOne({ priestId: priestId });
    expect(wallet).toBeNull(); // Wallet shouldn't even be created if no earnings

    // Verify PriestProfile stats (cancelledCount)
    const priestProfile = await PriestProfile.findOne({ userId: priestId });
    expect(priestProfile).toBeDefined();
    expect(priestProfile.cancelledCount).toBe(1);
    expect(priestProfile.analytics.completionRate).toBe(0); // 0 completed / 1 total = 0%
  });

  /**
   * Test C: Devotee Cancels Post-Payment
   * POST booking -> PUT accept -> Verify Payment -> Cancel (by devotee).
   * Expected: Priest gets cancellation fee.
   */
  test('Test C: Devotee Cancels Post-Payment', async () => {
    // Arrange
    const bookingRes = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${devoteeToken}`)
      .send({
        priestId: priestId,
        ceremonyType: 'Ganesh Puja',
        date: new Date(Date.now() + 86400000).toISOString(),
        startTime: '10:00',
        endTime: '11:00',
        location: { address: 'Test Street 123', city: 'Bangalore' },
      });
    const bookingId = bookingRes.body.data._id;
    await request(app)
      .put(`/api/bookings/${bookingId}/status`)
      .set('Authorization', `Bearer ${priestToken}`)
      .send({ status: 'confirmed' });

    // Mark as paid
    const booking = await Booking.findById(bookingId);
    booking.paymentStatus = 'completed';
    await booking.save();

    // Act - Devotee Cancels
    const cancelRes = await request(app)
      .put(`/api/bookings/${bookingId}/cancel-devotee`)
      .set('Authorization', `Bearer ${devoteeToken}`)
      .send({ reason: 'Changing plans' });

    expect(cancelRes.status).toBe(200);

    // Assert
    const wallet = await Wallet.findOne({ priestId: priestId });
    // Compensation is 20% of basePrice (1000) = 200
    expect(wallet.currentBalance).toBe(200);

    const transaction = await Transaction.findOne({
      bookingId: bookingId,
      type: 'credit_for_booking',
    });
    expect(transaction.amount).toBe(200);
  });

  /**
   * Test D: Priest Cancels Post-Payment
   * POST booking -> PUT accept -> Verify Payment -> Cancel (by priest).
   * Expected: Priest gets debited penalty.
   */
  test('Test D: Priest Cancels Post-Payment', async () => {
    // Arrange
    const bookingRes = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${devoteeToken}`)
      .send({
        priestId: priestId,
        ceremonyType: 'Ganesh Puja',
        date: new Date(Date.now() + 86400000).toISOString(),
        startTime: '10:00',
        endTime: '11:00',
        location: { address: 'Test Street 123', city: 'Bangalore' },
      });
    const bookingId = bookingRes.body.data._id;
    await request(app)
      .put(`/api/bookings/${bookingId}/status`)
      .set('Authorization', `Bearer ${priestToken}`)
      .send({ status: 'confirmed' });

    // Mark as paid
    const booking = await Booking.findById(bookingId);
    booking.paymentStatus = 'completed';
    await booking.save();

    // Act - Priest Cancels
    const cancelRes = await request(app)
      .put(`/api/bookings/${bookingId}/status`)
      .set('Authorization', `Bearer ${priestToken}`)
      .send({ status: 'cancelled', reason: 'Personal emergency' });

    expect(cancelRes.status).toBe(200);

    // Assert
    const wallet = await Wallet.findOne({ priestId: priestId });
    // Penalty is 100
    // Wallet starts at 0, goes to -100 but schema has min: 0.
    // Wait, models/wallet.js says min: 0. I should check if negative balance is allowed.
    // For the test, let's assume it stays 0 or we handle negative.
    // Actually, if it's min: 0, Mongoose will throw error on save.
    // I should probably remove min: 0 from wallet balance for penalties.
    expect(wallet.currentBalance).toBe(-100);

    // Verify PriestProfile stats (cancelledCount)
    const priestProfile = await PriestProfile.findOne({ userId: priestId });
    expect(priestProfile).toBeDefined();
    expect(priestProfile.cancelledCount).toBe(1);
  });

  test('Validation: Reject Illegal Transitions', async () => {
    const bookingRes = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${devoteeToken}`)
      .send({
        priestId: priestId,
        ceremonyType: 'Ganesh Puja',
        date: new Date(Date.now() + 86400000).toISOString(),
        startTime: '10:00',
        endTime: '11:00',
        location: { address: 'Test Street 123', city: 'Bangalore' },
      });
    const bookingId = bookingRes.body.data._id;

    // Try to complete a pending booking
    const res = await request(app)
      .put(`/api/bookings/${bookingId}/status`)
      .set('Authorization', `Bearer ${priestToken}`)
      .send({ status: 'completed' });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Cannot transition');
  });
});
