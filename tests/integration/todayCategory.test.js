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

const bookingService = require('../../services/bookingService')
const {
  createTestDevotee,
  createTestPriest,
  createTestBooking,
} = require('../helpers/testFactory')

describe("getBookings 'today' category", () => {
  test("includes a priest's pending booking scheduled for today", async () => {
    const devotee = await createTestDevotee()
    const priestUser = (await createTestPriest()).user

    const today = new Date()
    today.setHours(12, 0, 0, 0)

    const booking = await createTestBooking(devotee._id, priestUser._id, {
      status: 'pending',
      date: today,
      startTime: '12:00',
      endTime: '13:00',
    })

    const result = await bookingService.getBookings(
      priestUser._id.toString(),
      'priest',
      { category: 'today' }
    )

    const ids = result.data.map((b) => b._id.toString())
    expect(ids).toContain(booking._id.toString())
  })
})
