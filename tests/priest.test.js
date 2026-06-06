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
} = require('./helpers/testFactory')

const authAs = (user, type) => ({
  'x-test-user-id': user._id.toString(),
  'x-test-user-type': type,
})

describe('GET /api/priest/available', () => {
  it('returns list of verified priests with pagination', async () => {
    await createTestPriest()
    await createTestPriest()

    const res = await request(app).get('/api/priest/available')

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(Array.isArray(res.body.data.pujaris)).toBe(true)
    expect(res.body.data.pagination).toBeDefined()
    res.body.data.pujaris.forEach((p) => {
      expect(p.rating).toBeDefined()
    })
  })

  it('excludes offline priests when filtering by availability=available', async () => {
    await createTestPriest({
      profile: { currentAvailability: { status: 'available' }, isVerified: true, verificationStatus: 'approved' },
    })
    await createTestPriest({
      profile: { currentAvailability: { status: 'offline' }, isVerified: true, verificationStatus: 'approved' },
    })

    const res = await request(app).get('/api/priest/available?availability=available')

    expect(res.status).toBe(200)
    expect(res.body.data.pujaris.length).toBeGreaterThanOrEqual(1)
    res.body.data.pujaris.forEach((p) => {
      // All returned priests should be the available ones
      expect(p.verificationStatus).not.toBe('offline')
    })
    // Total should equal only available priests count
    expect(res.body.data.pagination.total).toBe(1)
  })
})

describe('GET /api/priest/public/:id', () => {
  it('returns public profile with languages and userId as string', async () => {
    const { user, profile } = await createTestPriest()

    const res = await request(app).get(`/api/priest/public/${profile._id}`)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(typeof res.body.data.userId).toBe('string')
    expect(Array.isArray(res.body.data.languages)).toBe(true)
  })
})

describe('PUT /api/priest/status', () => {
  it('priest can toggle to available', async () => {
    const { user } = await createTestPriest()

    const res = await request(app)
      .put('/api/priest/status')
      .set(authAs(user, 'priest'))
      .send({ status: 'available' })

    expect(res.status).toBe(200)
    expect(res.body.data.currentAvailability.status).toBe('available')
  })

  it('priest can toggle to offline', async () => {
    const { user } = await createTestPriest()

    const res = await request(app)
      .put('/api/priest/status')
      .set(authAs(user, 'priest'))
      .send({ status: 'offline' })

    expect(res.status).toBe(200)
    expect(res.body.data.currentAvailability.status).toBe('offline')
  })
})

describe('GET /api/priest/bookings/pending-actions', () => {
  it('returns bookings needing priest action (confirmed, past-due)', async () => {
    const devotee = await createTestDevotee()
    const { user: priestUser } = await createTestPriest()

    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    await createTestBooking(devotee._id, priestUser._id, {
      status: 'confirmed',
      date: yesterday,
    })

    const res = await request(app)
      .get('/api/priest/bookings/pending-actions')
      .set(authAs(priestUser, 'priest'))

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body.length).toBeGreaterThan(0)
    res.body.forEach((action) => {
      expect(action.actionType).toBe('mark_complete')
    })
  })
})

describe('PUT /api/priest/bookings/:bookingId/status', () => {
  it('priest can accept a pending booking (status → confirmed)', async () => {
    const devotee = await createTestDevotee()
    const { user: priestUser } = await createTestPriest()
    const booking = await createTestBooking(devotee._id, priestUser._id, { status: 'pending' })

    const res = await request(app)
      .put(`/api/priest/bookings/${booking._id}/status`)
      .set(authAs(priestUser, 'priest'))
      .send({ status: 'confirmed' })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.booking.status).toBe('confirmed')
  })

  it('returns 400 for invalid status transition (pending → in_progress)', async () => {
    const devotee = await createTestDevotee()
    const { user: priestUser } = await createTestPriest()
    const booking = await createTestBooking(devotee._id, priestUser._id, { status: 'pending' })

    const res = await request(app)
      .put(`/api/priest/bookings/${booking._id}/status`)
      .set(authAs(priestUser, 'priest'))
      .send({ status: 'in_progress' })

    expect(res.status).toBe(400)
  })

  it('priest can decline a booking with status cancelled', async () => {
    const devotee = await createTestDevotee()
    const { user: priestUser } = await createTestPriest()
    const booking = await createTestBooking(devotee._id, priestUser._id, { status: 'pending' })

    const res = await request(app)
      .put(`/api/priest/bookings/${booking._id}/status`)
      .set(authAs(priestUser, 'priest'))
      .send({ status: 'cancelled', reason: 'Not available' })

    expect(res.status).toBe(200)
    expect(res.body.booking.status).toBe('cancelled')
  })

  it('returns 403 if a different priest tries to update the booking', async () => {
    const devotee = await createTestDevotee()
    const { user: ownerPriest } = await createTestPriest()
    const { user: otherPriest } = await createTestPriest()
    const booking = await createTestBooking(devotee._id, ownerPriest._id, { status: 'pending' })

    const res = await request(app)
      .put(`/api/priest/bookings/${booking._id}/status`)
      .set(authAs(otherPriest, 'priest'))
      .send({ status: 'confirmed' })

    expect(res.status).toBe(403)
  })
})
