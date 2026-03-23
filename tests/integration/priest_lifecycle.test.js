const request = require('supertest');
const mongoose = require('mongoose');

// Mock out the expo-server-sdk which uses ES Modules that Jest node env trips on
jest.mock('expo-server-sdk', () => ({
  Expo: jest.fn().mockImplementation(() => ({
    sendPushNotificationsAsync: jest.fn(),
    chunkPushNotifications: jest.fn().mockReturnValue([]),
  })),
}));

const { app, server } = require('../../server'); // Assuming BMPServer/server.js exports app and server
const User = require('../../models/user');
const Booking = require('../../models/booking');
const jwt = require('jsonwebtoken');

describe('Complete Priest Lifecycle', () => {
  let priestToken, devoteeToken;
  let priestId, devoteeId;
  let bookingId1, bookingId2;

  beforeAll(async () => {
    // We assume the DB connection is handled in server.js or setup.js
    // If it's not connected, we should wait.
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bmp_test', {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });
    }

    // Clean up specific test data
    await User.deleteMany({
      email: { $in: ['test_priest_lifecycle@example.com', 'test_devotee_lifecycle@example.com'] },
    });
    await Booking.deleteMany({ notes: 'Lifecycle test booking' });
  });

  afterAll(async () => {
    await User.deleteMany({
      email: { $in: ['test_priest_lifecycle@example.com', 'test_devotee_lifecycle@example.com'] },
    });
    await Booking.deleteMany({ notes: 'Lifecycle test booking' });

    // Disconnect if server isn't handling it, or just let jest teardown
    if (server) {
      server.close();
    }
    await mongoose.connection.close();
  });

  it('1. Create a Priest Account', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Lifecycle Priest',
      email: 'test_priest_lifecycle@example.com',
      phone: '9998887771', // unique
      password: 'password123',
      userType: 'priest',
    });

    if (res.statusCode !== 201) console.error('Register Priest Error:', res.body);
    expect(res.statusCode).toEqual(201);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();

    priestToken = res.body.token;

    // Decode token to get ID
    const decoded = jwt.decode(priestToken);
    priestId = decoded.id;
  });

  it('2. Set Priest Profile Live', async () => {
    const res = await request(app)
      .put('/api/priest/profile')
      .set('Authorization', `Bearer ${priestToken}`)
      .send({
        experienceList: [{ title: 'Main Priest', organization: 'Temple', duration: 5 }],
        biography: 'Experienced lifecycle testing priest.',
      });

    expect(res.statusCode).toEqual(200);
  });

  it('3. Create a Devotee Account', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Lifecycle Devotee',
      email: 'test_devotee_lifecycle@example.com',
      phone: '1112223334',
      password: 'password123',
      userType: 'devotee',
    });

    expect(res.statusCode).toEqual(201);
    expect(res.body.success).toBe(true);
    devoteeToken = res.body.token;

    const decoded = jwt.decode(devoteeToken);
    devoteeId = decoded.id;
  });

  it('4. Devotee requests a Booking for the Priest', async () => {
    const res = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${devoteeToken}`)
      .send({
        priestId: priestId,
        ceremonyType: 'Ganesh Puja',
        date: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
        startTime: '09:00',
        endTime: '11:00',
        location: {
          address: '123 Test Ave',
          city: 'Testville',
          coordinates: [72.0, 19.0],
        },
        basePrice: 1000,
        platformFee: 100,
        totalAmount: 1100,
        notes: 'Lifecycle test booking',
      });

    expect(res.statusCode).toEqual(201);
    expect(res.body.success).toBe(true);
    bookingId1 = res.body.data._id;
  });

  it('5. Priest Views Incoming Bookings and Accepts', async () => {
    // First, verify it's in the priest's list
    const getRes = await request(app)
      .get(`/api/priest/bookings`)
      .set('Authorization', `Bearer ${priestToken}`);

    expect(getRes.statusCode).toEqual(200);
    // Should be there, maybe in pending

    const acceptRes = await request(app)
      .put(`/api/priest/bookings/${bookingId1}/status`)
      .set('Authorization', `Bearer ${priestToken}`)
      .send({ status: 'confirmed' });

    expect(acceptRes.statusCode).toEqual(200);
    expect(acceptRes.body.success).toBe(true);
    expect(acceptRes.body.data.status).toBe('confirmed');
  });

  it('6. Priest Marks Booking as Completed', async () => {
    // Assume payment is handled by devotees, priest just completes it
    const completeRes = await request(app)
      .put(`/api/priest/bookings/${bookingId1}/status`)
      .set('Authorization', `Bearer ${priestToken}`)
      .send({ status: 'completed' });

    expect(completeRes.statusCode).toEqual(200);
    expect(completeRes.body.success).toBe(true);
    expect(completeRes.body.data.status).toBe('completed');
  });

  it('7. Devotee requests a SECOND Booking for the Priest', async () => {
    const res = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${devoteeToken}`)
      .send({
        priestId: priestId,
        ceremonyType: 'Vastu Shanti',
        date: new Date(Date.now() + 172800000).toISOString(),
        startTime: '10:00',
        endTime: '12:00',
        location: {
          address: '123 Test Ave',
          city: 'Testville',
          coordinates: [72.0, 19.0],
        },
        basePrice: 5000,
        platformFee: 500,
        totalAmount: 5500,
        notes: 'Lifecycle test booking',
      });

    expect(res.statusCode).toEqual(201);
    bookingId2 = res.body.data._id;
  });

  it('8. Priest Rejects the Second Booking', async () => {
    const rejectRes = await request(app)
      .put(`/api/priest/bookings/${bookingId2}/status`)
      .set('Authorization', `Bearer ${priestToken}`)
      .send({ status: 'cancelled', cancellationReason: 'Busy on that day' });

    expect(rejectRes.statusCode).toEqual(200);
    expect(rejectRes.body.success).toBe(true);
    expect(rejectRes.body.data.status).toBe('cancelled');
    expect(rejectRes.body.data.cancellationReason).toBe('Busy on that day');
  });
});
