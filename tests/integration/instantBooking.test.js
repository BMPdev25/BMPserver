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

jest.mock('razorpay', () => {
  return jest.fn().mockImplementation(() => require('../mocks/paymentGateway'))
})

const request = require('supertest')
const { app } = require('../../server')
const Booking = require('../../models/booking')
const {
  createTestDevotee,
  createTestPriest,
  createTestBooking,
} = require('../helpers/testFactory')

const authAs = (user, type) => ({
  'x-test-user-id': user._id.toString(),
  'x-test-user-type': type,
})

describe('Instant Booking Accept Flow', () => {
  let devotee, priestUser

  beforeEach(async () => {
    devotee = await createTestDevotee()
    const priest = await createTestPriest()
    priestUser = priest.user
  })

  // Build a 'searching' instant booking with NO priest assigned.
  const createSearchingBooking = () =>
    createTestBooking(devotee._id, undefined, {
      status: 'searching',
      priestId: undefined,
      bookingType: 'instant',
    })

  test('priest can claim a searching instant booking → confirmed + assigned', async () => {
    const booking = await createSearchingBooking()

    const res = await request(app)
      .post('/api/priest/bookings/instant/accept')
      .set(authAs(priestUser, 'priest'))
      .send({ bookingId: booking._id.toString() })

    expect(res.status).toBe(200)

    const updated = await Booking.findById(booking._id)
    expect(updated.status).toBe('confirmed')
    expect(updated.priestId.toString()).toBe(priestUser._id.toString())
  })

  test('second priest cannot claim an already-accepted booking (409)', async () => {
    const booking = await createSearchingBooking()
    const otherPriest = (await createTestPriest()).user

    const first = await request(app)
      .post('/api/priest/bookings/instant/accept')
      .set(authAs(priestUser, 'priest'))
      .send({ bookingId: booking._id.toString() })
    expect(first.status).toBe(200)

    const second = await request(app)
      .post('/api/priest/bookings/instant/accept')
      .set(authAs(otherPriest, 'priest'))
      .send({ bookingId: booking._id.toString() })
    expect(second.status).toBe(409)
  })

  test('accepting a non-searching booking is rejected (409)', async () => {
    // A normal already-confirmed scheduled booking is not an instant request
    const booking = await createTestBooking(devotee._id, priestUser._id, {
      status: 'confirmed',
    })

    const res = await request(app)
      .post('/api/priest/bookings/instant/accept')
      .set(authAs(priestUser, 'priest'))
      .send({ bookingId: booking._id.toString() })

    expect(res.status).toBe(409)
  })

  test('missing bookingId returns 400', async () => {
    const res = await request(app)
      .post('/api/priest/bookings/instant/accept')
      .set(authAs(priestUser, 'priest'))
      .send({})

    expect(res.status).toBe(400)
  })
})
