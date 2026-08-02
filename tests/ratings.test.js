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

const authAs = (user, type = 'devotee') => ({
  'x-test-user-id': user._id.toString(),
  'x-test-user-type': type,
})

const validRatingBody = (bookingId, priestId) => ({
  bookingId: bookingId.toString(),
  priestId: priestId.toString(),
  rating: 5,
  categories: { punctuality: 5, knowledge: 5, behavior: 5, overall: 5 },
  review: 'Excellent puja!',
  ceremonyType: 'Ganesh Puja',
  ceremonyDate: '2026-05-01',
})

describe('POST /api/ratings', () => {
  let devotee, priest, booking

  beforeEach(async () => {
    devotee = await createTestDevotee()
    const { user: priestUser } = await createTestPriest()
    priest = priestUser
    booking = await createTestBooking(devotee._id, priest._id, { status: 'completed' })
  })

  it('creates a rating for a completed booking', async () => {
    const res = await request(app)
      .post('/api/ratings')
      .set(authAs(devotee))
      .send(validRatingBody(booking._id, priest._id))

    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data._id).toBeDefined()
    expect(res.body.data.rating).toBe(5)
  })

  it('returns 409 on duplicate rating for the same booking', async () => {
    const body = validRatingBody(booking._id, priest._id)

    await request(app)
      .post('/api/ratings')
      .set(authAs(devotee))
      .send(body)

    const res = await request(app)
      .post('/api/ratings')
      .set(authAs(devotee))
      .send(body)

    expect(res.status).toBe(409)
    expect(res.body.success).toBe(false)
  })

  it('returns 400 if rating is out of range (0 is below minimum)', async () => {
    const res = await request(app)
      .post('/api/ratings')
      .set(authAs(devotee))
      .send({ ...validRatingBody(booking._id, priest._id), rating: 0 })

    expect(res.status).toBe(400)
    expect(res.body.errors.some((e) => e.field === 'rating')).toBe(true)
  })

  it('returns 400 if categories are missing', async () => {
    const { categories: _c, ...bodyWithoutCategories } = validRatingBody(booking._id, priest._id)

    const res = await request(app)
      .post('/api/ratings')
      .set(authAs(devotee))
      .send(bodyWithoutCategories)

    expect(res.status).toBe(400)
  })
})

describe('GET /api/ratings/booking/:bookingId', () => {
  let devotee, priest, booking

  beforeEach(async () => {
    devotee = await createTestDevotee()
    const { user: priestUser } = await createTestPriest()
    priest = priestUser
    booking = await createTestBooking(devotee._id, priest._id, { status: 'completed' })
  })

  it('returns null when booking has not been rated', async () => {
    const res = await request(app)
      .get(`/api/ratings/booking/${booking._id}`)
      .set(authAs(devotee))

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data).toBeNull()
  })

  it('returns existing rating after submission', async () => {
    await request(app)
      .post('/api/ratings')
      .set(authAs(devotee))
      .send(validRatingBody(booking._id, priest._id))

    const res = await request(app)
      .get(`/api/ratings/booking/${booking._id}`)
      .set(authAs(devotee))

    expect(res.status).toBe(200)
    expect(typeof res.body.data.rating).toBe('number')
    expect(res.body.data.rating).toBe(5)
  })
})
