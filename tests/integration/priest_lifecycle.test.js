process.env.NODE_ENV = 'test'

jest.mock('expo-server-sdk', () => ({
  Expo: class {
    static isExpoPushToken() { return false }
    chunkPushNotifications() { return [] }
    async sendPushNotificationsAsync() { return [] }
  },
}))

jest.mock('../../config/firebase', () => ({
  auth: () => ({ verifyIdToken: jest.fn(), createCustomToken: jest.fn() }),
}))

const request = require('supertest')
const { app } = require('../../server')
const {
  createTestDevotee,
  createTestPriest,
  createTestCeremony,
  createTestBooking,
  futureDateStr,
} = require('../helpers/testFactory')

const authAs = (user, type) => ({
  'x-test-user-id': user._id.toString(),
  'x-test-user-type': type,
})

describe('Complete Priest Lifecycle', () => {
  let devotee, priestUser, ceremony

  beforeEach(async () => {
    devotee = await createTestDevotee()
    const priest = await createTestPriest()
    priestUser = priest.user
    ceremony = await createTestCeremony()
  })

  it('1. Devotee can book a verified priest', async () => {
    const res = await request(app)
      .post('/api/bookings')
      .set(authAs(devotee, 'devotee'))
      .send({
        priestId: priestUser._id.toString(),
        ceremonyType: ceremony.name,
        date: futureDateStr(5),
        startTime: '09:00',
        endTime: '11:00',
        location: { address: '123 Test Ave', city: 'Mumbai' },
      })

    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data.status).toBe('pending')
  })

  it('2. Priest can accept a pending booking', async () => {
    const booking = await createTestBooking(devotee._id, priestUser._id, { status: 'pending' })

    const res = await request(app)
      .put(`/api/priest/bookings/${booking._id}/status`)
      .set(authAs(priestUser, 'priest'))
      .send({ status: 'confirmed' })

    expect(res.status).toBe(200)
    expect(res.body.booking.status).toBe('confirmed')
  })

  it('3. Priest can cancel a pending booking', async () => {
    const booking = await createTestBooking(devotee._id, priestUser._id, { status: 'pending' })

    const res = await request(app)
      .put(`/api/priest/bookings/${booking._id}/status`)
      .set(authAs(priestUser, 'priest'))
      .send({ status: 'cancelled', reason: 'Not available that day' })

    expect(res.status).toBe(200)
    expect(res.body.booking.status).toBe('cancelled')
  })

  it('4. Devotee can cancel their own confirmed booking', async () => {
    const booking = await createTestBooking(devotee._id, priestUser._id, { status: 'confirmed' })

    const res = await request(app)
      .put(`/api/bookings/${booking._id}/cancel-devotee`)
      .set(authAs(devotee, 'devotee'))
      .send({ reason: 'Plans changed' })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })

  it('5. Priest availability is visible in public listing', async () => {
    const res = await request(app).get('/api/priest/available')

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.data.pujaris)).toBe(true)
    const ids = res.body.data.pujaris.map((p) => p.userId?.toString())
    expect(ids).toContain(priestUser._id.toString())
  })

  it('6. Priest can view their own bookings list', async () => {
    await createTestBooking(devotee._id, priestUser._id, { status: 'confirmed' })

    const res = await request(app)
      .get('/api/priest/bookings')
      .set(authAs(priestUser, 'priest'))

    expect(res.status).toBe(200)
  })

  it('7. Unverified priest is rejected when devotee tries to book', async () => {
    const unverified = await createTestPriest({
      profile: { isVerified: false, verificationStatus: 'incomplete' },
    })

    const res = await request(app)
      .post('/api/bookings')
      .set(authAs(devotee, 'devotee'))
      .send({
        priestId: unverified.user._id.toString(),
        ceremonyType: ceremony.name,
        date: futureDateStr(5),
        startTime: '09:00',
        endTime: '11:00',
        location: { address: '123 Test Ave', city: 'Mumbai' },
      })

    expect(res.status).toBe(403)
  })

  it('8. status=rejected is rejected by booking status endpoint', async () => {
    const booking = await createTestBooking(devotee._id, priestUser._id, { status: 'pending' })

    const res = await request(app)
      .put(`/api/priest/bookings/${booking._id}/status`)
      .set(authAs(priestUser, 'priest'))
      .send({ status: 'rejected' })

    expect(res.status).toBe(400)
  })
})
