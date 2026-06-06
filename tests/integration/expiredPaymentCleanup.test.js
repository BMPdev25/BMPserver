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

const Booking = require('../../models/booking')
const { runExpiredPaymentCleanup } = require('../../jobs/cronJobs')
const {
  createTestDevotee,
  createTestPriest,
  createTestBooking,
} = require('../helpers/testFactory')

const past = () => new Date(Date.now() - 60 * 1000) // 1 min ago
const future = () => new Date(Date.now() + 60 * 60 * 1000) // 1 hr ahead

describe('Expired payment cleanup', () => {
  let devotee, priestUser

  beforeEach(async () => {
    devotee = await createTestDevotee()
    priestUser = (await createTestPriest()).user
  })

  test('cancels a confirmed-but-unpaid booking past its payment window', async () => {
    const booking = await createTestBooking(devotee._id, priestUser._id, {
      status: 'confirmed',
      paymentStatus: 'pending',
      paymentExpiresAt: past(),
    })

    const count = await runExpiredPaymentCleanup()
    expect(count).toBeGreaterThanOrEqual(1)

    const updated = await Booking.findById(booking._id)
    expect(updated.status).toBe('cancelled')
  })

  test('cancels an expired pending booking too', async () => {
    const booking = await createTestBooking(devotee._id, priestUser._id, {
      status: 'pending',
      paymentStatus: 'pending',
      paymentExpiresAt: past(),
    })

    await runExpiredPaymentCleanup()
    const updated = await Booking.findById(booking._id)
    expect(updated.status).toBe('cancelled')
  })

  test('does NOT cancel a paid confirmed booking', async () => {
    const booking = await createTestBooking(devotee._id, priestUser._id, {
      status: 'confirmed',
      paymentStatus: 'completed',
      paymentExpiresAt: past(),
    })

    await runExpiredPaymentCleanup()
    const updated = await Booking.findById(booking._id)
    expect(updated.status).toBe('confirmed')
  })

  test('does NOT cancel a confirmed booking still within its payment window', async () => {
    const booking = await createTestBooking(devotee._id, priestUser._id, {
      status: 'confirmed',
      paymentStatus: 'pending',
      paymentExpiresAt: future(),
    })

    await runExpiredPaymentCleanup()
    const updated = await Booking.findById(booking._id)
    expect(updated.status).toBe('confirmed')
  })
})
