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

jest.mock('razorpay', () => jest.fn().mockImplementation(() => require('../mocks/paymentGateway')))

const request = require('supertest')
const { app } = require('../../server')
const Booking = require('../../models/booking')
const PriestProfile = require('../../models/priestProfile')
const { createDevotee, createVerifiedPriest, createBooking, authHeaders } = require('../helpers/factory')

const ratingBody = (bookingId, priestId) => ({
  bookingId: bookingId.toString(),
  priestId: priestId.toString(),
  rating: 5,
  categories: { punctuality: 5, knowledge: 5, behavior: 5, overall: 5 },
  review: 'Wonderful ceremony',
  ceremonyType: 'Test Ceremony',
  ceremonyDate: '2026-01-01',
})

describe('Rating bookkeeping', () => {
  let devotee, priest, booking

  beforeEach(async () => {
    devotee = await createDevotee()
    priest = await createVerifiedPriest()

    booking = await createBooking(devotee._id, priest.user._id, 'confirmed', {
      basePrice: priest.service.price,
      paymentStatus: 'pending',
    })
    await Booking.findByIdAndUpdate(booking._id, { $set: { paymentStatus: 'completed' } })

    const completeRes = await request(app)
      .post(`/api/bookings/${booking._id}/complete`)
      .set(authHeaders(priest.user))
      .send({})
    expect(completeRes.status).toBe(200)
  })

  it('a completed booking appears in pending actions until rated', async () => {
    const res = await request(app)
      .get('/api/devotee/pending-actions')
      .set(authHeaders(devotee))

    expect(res.status).toBe(200)
    const ids = res.body.map((a) => a._id.toString())
    expect(ids).toContain(booking._id.toString())
  })

  it('rating a booking removes it from pending actions', async () => {
    const submitRes = await request(app)
      .post('/api/ratings')
      .set(authHeaders(devotee))
      .send(ratingBody(booking._id, priest.user._id))
    expect(submitRes.status).toBe(201)

    const res = await request(app)
      .get('/api/devotee/pending-actions')
      .set(authHeaders(devotee))

    const ids = res.body.map((a) => a._id.toString())
    expect(ids).not.toContain(booking._id.toString())
  })

  it('duplicate rating on the same booking is rejected', async () => {
    await request(app)
      .post('/api/ratings')
      .set(authHeaders(devotee))
      .send(ratingBody(booking._id, priest.user._id))

    const res = await request(app)
      .post('/api/ratings')
      .set(authHeaders(devotee))
      .send(ratingBody(booking._id, priest.user._id))

    expect(res.status).toBe(409)
  })

  it('priest ratings.average and count update correctly', async () => {
    await request(app)
      .post('/api/ratings')
      .set(authHeaders(devotee))
      .send(ratingBody(booking._id, priest.user._id))

    const profile = await PriestProfile.findOne({ userId: priest.user._id })
    expect(profile.ratings.average).toBe(5)
    expect(profile.ratings.count).toBe(1)
  })
})
