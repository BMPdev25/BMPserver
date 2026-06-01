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
const Wallet = require('../../models/wallet')
const Transaction = require('../../models/transaction')
const PriestProfile = require('../../models/priestProfile')
const {
  createTestDevotee,
  createTestPriest,
  createTestBooking,
  createTestCeremony,
  futureDateStr,
} = require('../helpers/testFactory')

const authAs = (user, type) => ({
  'x-test-user-id': user._id.toString(),
  'x-test-user-type': type,
})

describe('Booking & Wallet Integration Tests', () => {
  let devotee, priestUser, ceremony

  beforeEach(async () => {
    devotee = await createTestDevotee()
    const priest = await createTestPriest()
    priestUser = priest.user
    ceremony = await createTestCeremony()
  })

  test('Test A: Happy Path - Create and accept booking flow', async () => {
    // 1. Create Booking
    const bookingRes = await request(app)
      .post('/api/bookings')
      .set(authAs(devotee, 'devotee'))
      .send({
        priestId: priestUser._id.toString(),
        ceremonyType: ceremony.name,
        date: futureDateStr(5),
        startTime: '10:00',
        endTime: '11:00',
        location: { address: 'Test Street 123', city: 'Bangalore' },
      })

    expect(bookingRes.status).toBe(201)
    const bookingId = bookingRes.body.data._id

    // 2. Priest Accepts via priest route
    const acceptRes = await request(app)
      .put(`/api/priest/bookings/${bookingId}/status`)
      .set(authAs(priestUser, 'priest'))
      .send({ status: 'confirmed' })

    expect(acceptRes.status).toBe(200)
    expect(acceptRes.body.booking.status).toBe('confirmed')
  })

  test('Test B: Priest Rejects Booking', async () => {
    const booking = await createTestBooking(devotee._id, priestUser._id, { status: 'pending' })

    const rejectRes = await request(app)
      .put(`/api/priest/bookings/${booking._id}/status`)
      .set(authAs(priestUser, 'priest'))
      .send({ status: 'cancelled', reason: 'Unavailable' })

    expect(rejectRes.status).toBe(200)

    const updated = await Booking.findById(booking._id)
    expect(updated.status).toBe('cancelled')

    const wallet = await Wallet.findOne({ priestId: priestUser._id })
    expect(wallet).toBeNull()
  })

  test('Test C: Devotee Cancels a Confirmed Booking', async () => {
    const booking = await createTestBooking(devotee._id, priestUser._id, {
      status: 'confirmed',
    })

    const cancelRes = await request(app)
      .put(`/api/bookings/${booking._id}/cancel-devotee`)
      .set(authAs(devotee, 'devotee'))
      .send({ reason: 'Changing plans' })

    expect(cancelRes.status).toBe(200)
    expect(cancelRes.body.success).toBe(true)

    const updated = await Booking.findById(booking._id)
    expect(updated.status).toBe('cancelled')
  })

  test('Test D: Different devotee cannot cancel another devotee booking', async () => {
    const otherDevotee = await createTestDevotee()
    const booking = await createTestBooking(devotee._id, priestUser._id, {
      status: 'confirmed',
    })

    const cancelRes = await request(app)
      .put(`/api/bookings/${booking._id}/cancel-devotee`)
      .set(authAs(otherDevotee, 'devotee'))
      .send({ reason: 'Not my booking' })

    expect(cancelRes.status).toBe(403)
  })

  test('Validation: Reject status=rejected (invalid transition)', async () => {
    const booking = await createTestBooking(devotee._id, priestUser._id, { status: 'pending' })

    const res = await request(app)
      .put(`/api/priest/bookings/${booking._id}/status`)
      .set(authAs(priestUser, 'priest'))
      .send({ status: 'rejected' })

    expect(res.status).toBe(400)
  })
})
