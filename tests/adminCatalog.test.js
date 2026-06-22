process.env.NODE_ENV = 'test';

// Mock Firebase before any module loads it
jest.mock('../config/firebase', () => ({
  auth: () => ({
    verifyIdToken: jest.fn().mockImplementation(async (token) => {
      throw new Error('Firebase mock should not be hit for standard JWT');
    }),
    createCustomToken: jest.fn().mockResolvedValue('mock-custom-token'),
  }),
}));

jest.mock('expo-server-sdk', () => ({
  Expo: class {
    static isExpoPushToken() { return false }
    chunkPushNotifications() { return [] }
    async sendPushNotificationsAsync() { return [] }
  },
}));

const request = require('supertest');
const { app } = require('../server');
const User = require('../models/user');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

describe('Admin Authentication & JWT Validation', () => {
  let adminUser;

  beforeEach(async () => {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('adminpassword', salt);
    adminUser = await User.create({
      name: 'System Admin',
      email: 'admin@test.com',
      password: hashedPassword,
      userType: 'admin',
      isActive: true,
      isVerified: true,
    });
  });

  it('fails admin login with incorrect password', async () => {
    const res = await request(app)
      .post('/api/admin/auth/login')
      .send({ email: 'admin@test.com', password: 'wrongpassword' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('succeeds admin login with correct password and returns standard JWT', async () => {
    const res = await request(app)
      .post('/api/admin/auth/login')
      .send({ email: 'admin@test.com', password: 'adminpassword' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.admin.email).toBe('admin@test.com');
  });

  it('allows access to admin dashboard using local JWT token', async () => {
    // Generate valid local JWT
    const token = jwt.sign(
      { id: adminUser._id, userType: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    const res = await request(app)
      .get('/api/admin/dashboard/stats')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.stats.devotees).toBe(0);
  });

  it('denies access to admin dashboard with invalid JWT', async () => {
    const res = await request(app)
      .get('/api/admin/dashboard/stats')
      .set('Authorization', 'Bearer invalid-jwt-token');

    expect(res.status).toBe(401);
  });
});

describe('Admin Banners CRUD Operations', () => {
  let adminToken;
  let bannerId;

  beforeEach(async () => {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('adminpassword', salt);
    const adminUser = await User.create({
      name: 'System Admin',
      email: 'admin@test.com',
      password: hashedPassword,
      userType: 'admin',
      isActive: true,
      isVerified: true,
    });
    adminToken = jwt.sign(
      { id: adminUser._id, userType: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
  });

  it('creates and reads banner campaigns', async () => {
    const createRes = await request(app)
      .post('/api/admin/banners')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Diwali Special Offer',
        subtitle: 'Get 20% off all pujas',
        color: '#FF0000',
        order: 1,
        isActive: true,
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.success).toBe(true);
    expect(createRes.body.data.title).toBe('Diwali Special Offer');
    bannerId = createRes.body.data._id;

    const listRes = await request(app)
      .get('/api/admin/banners')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.success).toBe(true);
    expect(listRes.body.data.length).toBe(1);
  });

  it('updates and deletes banner campaigns', async () => {
    const Banner = require('../models/banner');
    const b = await Banner.create({
      title: 'Legacy Banner',
      subtitle: 'Old promo',
      color: '#FFFFFF',
      isActive: true,
    });

    const updateRes = await request(app)
      .put(`/api/admin/banners/${b._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Updated Promo Banner',
        isActive: false,
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.success).toBe(true);
    expect(updateRes.body.data.title).toBe('Updated Promo Banner');
    expect(updateRes.body.data.isActive).toBe(false);

    const deleteRes = await request(app)
      .delete(`/api/admin/banners/${b._id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(deleteRes.status).toBe(200);

    const check = await Banner.findById(b._id);
    expect(check).toBeNull();
  });
});

describe('Admin Bookings & Pujaris Management', () => {
  let adminToken;
  let devoteeUser;
  let priestUser;
  let bookingRecord;

  beforeEach(async () => {
    // Admin setup
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('adminpassword', salt);
    const adminUser = await User.create({
      name: 'System Admin',
      email: 'admin@test.com',
      password: hashedPassword,
      userType: 'admin',
      isActive: true,
      isVerified: true,
    });
    adminToken = jwt.sign(
      { id: adminUser._id, userType: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Devotee setup
    devoteeUser = await User.create({
      name: 'Test Devotee',
      email: 'devotee@test.com',
      phone: '+919999999999',
      userType: 'devotee',
      isActive: true,
      firebaseUid: 'fb_devotee_test',
    });

    // Priest setup
    priestUser = await User.create({
      name: 'Test Priest',
      email: 'priest@test.com',
      phone: '+918888888888',
      userType: 'priest',
      isActive: true,
      isVerified: true,
      firebaseUid: 'fb_priest_test',
    });

    const PriestProfile = require('../models/priestProfile');
    await PriestProfile.create({
      userId: priestUser._id,
      experience: 5,
      languagesSpoken: ['Hindi', 'English'],
      description: 'Experienced pujari',
      isVerified: true,
      verificationStatus: 'approved',
    });

    // Booking setup
    const Booking = require('../models/booking');
    bookingRecord = await Booking.create({
      devoteeId: devoteeUser._id,
      priestId: priestUser._id,
      ceremonyType: 'Ganesha Puja',
      date: new Date(),
      startTime: '09:00 AM',
      endTime: '11:00 AM',
      location: {
        address: '123 Temple St',
        city: 'Varanasi',
      },
      basePrice: 2000,
      platformFee: 200,
      totalAmount: 2200,
      status: 'pending',
    });
  });

  it('lists bookings and gets booking by ID', async () => {
    const listRes = await request(app)
      .get('/api/admin/bookings')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.success).toBe(true);
    expect(listRes.body.data.length).toBeGreaterThan(0);

    const getRes = await request(app)
      .get(`/api/admin/bookings/${bookingRecord._id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body.success).toBe(true);
    expect(getRes.body.data.ceremonyType).toBe('Ganesha Puja');
  });

  it('updates booking status, items status, and assigns a pujari', async () => {
    // 1. Update status
    const statusRes = await request(app)
      .put(`/api/admin/bookings/${bookingRecord._id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'confirmed' });

    expect(statusRes.status).toBe(200);
    expect(statusRes.body.success).toBe(true);
    expect(statusRes.body.data.status).toBe('confirmed');

    // 2. Update items delivery status
    const itemsRes = await request(app)
      .put(`/api/admin/bookings/${bookingRecord._id}/items-status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ itemsDeliveryStatus: 'delivered' });

    expect(itemsRes.status).toBe(200);
    expect(itemsRes.body.success).toBe(true);
    expect(itemsRes.body.data.itemsDeliveryStatus).toBe('delivered');

    // 3. Assign Pujari (create another pujari and assign him)
    const newPriest = await User.create({
      name: 'Other Priest',
      email: 'other_priest@test.com',
      phone: '+917777777777',
      userType: 'priest',
      isActive: true,
      isVerified: true,
      firebaseUid: 'fb_other_priest_test',
    });
    const assignRes = await request(app)
      .put(`/api/admin/bookings/${bookingRecord._id}/assign`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ pujariId: newPriest._id });

    expect(assignRes.status).toBe(200);
    expect(assignRes.body.success).toBe(true);
    expect(assignRes.body.data.priestId.toString()).toBe(newPriest._id.toString());
  });

  it('manages Pujaris - lists, gets, creates, updates, and deletes', async () => {
    // 1. List Pujaris
    const listRes = await request(app)
      .get('/api/admin/pujaris')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.success).toBe(true);
    expect(listRes.body.data.length).toBeGreaterThan(0);

    // 2. Get Pujari by ID
    const getRes = await request(app)
      .get(`/api/admin/pujaris/${priestUser._id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body.success).toBe(true);
    expect(getRes.body.data.name).toBe('Test Priest');

    // 3. Create Pujari
    const createRes = await request(app)
      .post('/api/admin/pujaris')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'New Created Priest',
        mobile: '+916666666666',
        email: 'new_created@test.com',
        experience: 4,
        languages: ['Hindi'],
        serviceAreas: ['Varanasi'],
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.success).toBe(true);
    expect(createRes.body.data.name).toBe('New Created Priest');
    const createdId = createRes.body.data._id;

    // 4. Update Pujari
    const updateRes = await request(app)
      .put(`/api/admin/pujaris/${createdId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Updated Priest Name',
        mobile: '+916666666666',
        email: 'new_created@test.com',
        experience: 5,
        languages: ['Hindi', 'Sanskrit'],
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.success).toBe(true);
    expect(updateRes.body.data.name).toBe('Updated Priest Name');

    // 5. Delete (Deactivate) Pujari
    const deleteRes = await request(app)
      .delete(`/api/admin/pujaris/${createdId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.success).toBe(true);
    expect(deleteRes.body.data.isActive).toBe(false);
  });
});
