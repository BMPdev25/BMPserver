process.env.NODE_ENV = 'test'

jest.mock('expo-server-sdk', () => ({
  Expo: class {
    static isExpoPushToken() { return false }
    chunkPushNotifications() { return [] }
    async sendPushNotificationsAsync() { return [] }
  },
}))

jest.mock('../config/firebase', () => ({
  auth: () => ({ verifyIdToken: jest.fn(), createCustomToken: jest.fn() }),
}))

const request = require('supertest')
const { app } = require('../server')
const {
  createTestDevotee,
  createTestPriest,
  createTestBooking,
  createTestCeremony,
  futureDateStr,
} = require('./helpers/testFactory')

let devotee, priest, ceremony

beforeEach(async () => {
  devotee = await createTestDevotee()
  priest = await createTestPriest()
  ceremony = await createTestCeremony()
})

const authHeaders = (user, type = 'devotee') => ({
  'x-test-user-id': user._id.toString(),
  'x-test-user-type': type,
})

describe('POST /api/bookings', () => {
  it('creates a booking with valid data', async () => {
    const date = futureDateStr(30)
    const basePrice = 2000
    const expectedFee = Math.round(basePrice * 0.05)

    const res = await request(app)
      .post('/api/bookings')
      .set(authHeaders(devotee))
      .send({
        priestId: priest.user._id.toString(),
        ceremonyType: ceremony.name,
        date,
        startTime: '10:00',
        endTime: '12:00',
        location: { address: '123 Test St, Mumbai', city: 'Mumbai' },
      })

    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data._id).toBeDefined()
    expect(res.body.data.status).toBe('pending')
    expect(res.body.data.platformFee).toBe(expectedFee)
    expect(res.body.data.totalAmount).toBe(basePrice + expectedFee)
  })

  it('returns 400 if priestId is not a valid MongoDB ObjectId', async () => {
    const res = await request(app)
      .post('/api/bookings')
      .set(authHeaders(devotee))
      .send({
        priestId: 'not-an-objectid',
        ceremonyType: ceremony.name,
        date: futureDateStr(30),
        startTime: '10:00',
        endTime: '12:00',
        location: { address: '123 Test St', city: 'Mumbai' },
      })

    expect(res.status).toBe(400)
  })

  it('returns 400 if date is in the past', async () => {
    const res = await request(app)
      .post('/api/bookings')
      .set(authHeaders(devotee))
      .send({
        priestId: priest.user._id.toString(),
        ceremonyType: ceremony.name,
        date: '2020-01-01',
        startTime: '10:00',
        endTime: '12:00',
        location: { address: '123 Test St', city: 'Mumbai' },
      })

    expect(res.status).toBe(400)
  })

  it('returns 400 if startTime format is wrong', async () => {
    const res = await request(app)
      .post('/api/bookings')
      .set(authHeaders(devotee))
      .send({
        priestId: priest.user._id.toString(),
        ceremonyType: ceremony.name,
        date: futureDateStr(30),
        startTime: '10am',
        endTime: '12:00',
        location: { address: '123 Test St', city: 'Mumbai' },
      })

    expect(res.status).toBe(400)
  })

  it('returns 400 if endTime is before startTime', async () => {
    const res = await request(app)
      .post('/api/bookings')
      .set(authHeaders(devotee))
      .send({
        priestId: priest.user._id.toString(),
        ceremonyType: ceremony.name,
        date: futureDateStr(30),
        startTime: '12:00',
        endTime: '10:00',
        location: { address: '123 Test St', city: 'Mumbai' },
      })

    expect(res.status).toBe(400)
  })

  it('returns 403 if priest is not verified', async () => {
    const unverifiedPriest = await createTestPriest({
      profile: { isVerified: false, verificationStatus: 'incomplete' },
    })

    const res = await request(app)
      .post('/api/bookings')
      .set(authHeaders(devotee))
      .send({
        priestId: unverifiedPriest.user._id.toString(),
        ceremonyType: ceremony.name,
        date: futureDateStr(30),
        startTime: '10:00',
        endTime: '12:00',
        location: { address: '123 Test St', city: 'Mumbai' },
      })

    expect(res.status).toBe(403)
  })
})

describe('GET /api/bookings', () => {
  it('returns categorised bookings with pagination', async () => {
    await createTestBooking(devotee._id, priest.user._id)

    const res = await request(app)
      .get('/api/bookings')
      .set(authHeaders(devotee))

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(Array.isArray(res.body.data.all)).toBe(true)
    expect(typeof res.body.pagination.hasMore).toBe('boolean')
  })

  it('filters bookings by status=confirmed', async () => {
    await createTestBooking(devotee._id, priest.user._id, { status: 'confirmed' })
    await createTestBooking(devotee._id, priest.user._id, { status: 'cancelled' })

    const res = await request(app)
      .get('/api/bookings?status=confirmed')
      .set(authHeaders(devotee))

    expect(res.status).toBe(200)
    const allBookings = res.body.data.all
    expect(allBookings.every((b) => b.status === 'confirmed')).toBe(true)
  })

  it('returns 401 if unauthenticated', async () => {
    const res = await request(app).get('/api/bookings')

    expect(res.status).toBe(401)
  })
})

describe('PUT /api/bookings/:bookingId/cancel-devotee', () => {
  it('cancels a pending booking', async () => {
    const booking = await createTestBooking(devotee._id, priest.user._id, {
      status: 'pending',
    })

    const res = await request(app)
      .put(`/api/bookings/${booking._id}/cancel-devotee`)
      .set(authHeaders(devotee))
      .send({ reason: 'Changed plans' })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })

  it('returns 403 if a different user tries to cancel', async () => {
    const otherDevotee = await createTestDevotee()
    const booking = await createTestBooking(devotee._id, priest.user._id, {
      status: 'pending',
    })

    const res = await request(app)
      .put(`/api/bookings/${booking._id}/cancel-devotee`)
      .set(authHeaders(otherDevotee))
      .send({})

    expect(res.status).toBe(403)
  })

  it('returns 400 if booking is already completed', async () => {
    const booking = await createTestBooking(devotee._id, priest.user._id, {
      status: 'completed',
    })

    const res = await request(app)
      .put(`/api/bookings/${booking._id}/cancel-devotee`)
      .set(authHeaders(devotee))
      .send({})

    expect(res.status).toBe(400)
  })
})
