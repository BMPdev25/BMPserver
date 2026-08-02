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
  createTestWallet,
  createTestTransaction,
} = require('./helpers/testFactory')

const authAs = (user, type = 'priest') => ({
  'x-test-user-id': user._id.toString(),
  'x-test-user-type': type,
})

describe('GET /api/priest/earnings', () => {
  it('returns a correctly shaped earnings object', async () => {
    const { user: priestUser } = await createTestPriest()

    const res = await request(app)
      .get('/api/priest/earnings')
      .set(authAs(priestUser))

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(typeof res.body.data.wallet.currentBalance).toBe('number')
    expect(typeof res.body.data.earnings.thisMonth).toBe('number')
    expect(typeof res.body.data.earnings.pendingPayments).toBe('number')
    expect(typeof res.body.data.ceremonyCount).toBe('number')
    expect(typeof res.body.data.ratings.average).toBe('number')
  })
})

describe('GET /api/priest/transactions', () => {
  it('returns transactions with populated devotee name', async () => {
    const devotee = await createTestDevotee()
    const { user: priestUser } = await createTestPriest()
    const booking = await createTestBooking(devotee._id, priestUser._id)
    const wallet = await createTestWallet(priestUser._id)
    await createTestTransaction(priestUser._id, wallet._id, booking._id)

    const res = await request(app)
      .get('/api/priest/transactions')
      .set(authAs(priestUser))

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(Array.isArray(res.body.data)).toBe(true)
    expect(res.body.data.length).toBeGreaterThan(0)
    expect(typeof res.body.data[0].booking.devoteeId.name).toBe('string')
    expect(res.body.data[0].booking.devoteeId.name).not.toBeUndefined()
  })
})
