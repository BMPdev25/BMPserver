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

const Wallet = require('../../models/wallet')
const { getOrCreateWallet } = require('../../services/commissionEngine')
const { createTestPriest } = require('../helpers/testFactory')

// NOTE: processBookingCompletion was removed — the booking-completion credit is
// now the inline transactional path in bookingService.updateBookingStatus and is
// covered by the booking-service integration tests. Only getOrCreateWallet
// remains in commissionEngine.

describe('commissionEngine.getOrCreateWallet', () => {
  let priestUser

  beforeEach(async () => {
    priestUser = (await createTestPriest()).user
  })

  test('creates a zeroed wallet on first call', async () => {
    const wallet = await getOrCreateWallet(priestUser._id)
    expect(wallet.currentBalance).toBe(0)
    expect(wallet.totalCredited).toBe(0)
    expect(wallet.totalDebited).toBe(0)
  })

  test('returns the existing wallet on subsequent calls without creating a duplicate', async () => {
    const first = await getOrCreateWallet(priestUser._id)
    const second = await getOrCreateWallet(priestUser._id)

    expect(second._id.toString()).toBe(first._id.toString())
    const count = await Wallet.countDocuments({ priestId: priestUser._id })
    expect(count).toBe(1)
  })
})
