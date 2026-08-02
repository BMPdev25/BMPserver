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
const User = require('../../models/user')
const PriestProfile = require('../../models/priestProfile')
const Wallet = require('../../models/wallet')
const { createDevotee, createVerifiedPriest, authHeaders } = require('../helpers/factory')

describe('Security invariants', () => {
  it('priest cannot self-verify via profile update', async () => {
    const priest = await createVerifiedPriest({
      profile: { isVerified: false, verificationStatus: 'incomplete', onboardingCompleted: false },
    })

    await request(app)
      .put('/api/priest/profile')
      .set(authHeaders(priest.user))
      .send({ isVerified: true, verificationStatus: 'approved' })

    const profile = await PriestProfile.findOne({ userId: priest.user._id })
    expect(profile.isVerified).toBe(false)
  })

  it('user cannot escalate to admin via profile update', async () => {
    const devotee = await createDevotee()

    await request(app)
      .put('/api/users/profile')
      .set(authHeaders(devotee))
      .send({ userType: 'admin' })

    const user = await User.findById(devotee._id)
    expect(user.userType).toBe('devotee')
  })

  it('two concurrent withdrawal requests cannot double-drain a wallet', async () => {
    const priest = await createVerifiedPriest()
    await Wallet.create({
      priestId: priest.user._id,
      currentBalance: 1000,
      totalCredited: 1000,
      totalDebited: 0,
    })

    const withdraw = () =>
      request(app)
        .post('/api/wallet/withdraw')
        .set(authHeaders(priest.user))
        .send({
          amount: 700,
          bankDetails: { accountNumber: '000123456789', ifsc: 'TEST0000001', name: 'Test Priest' },
        })

    const [resA, resB] = await Promise.all([withdraw(), withdraw()])

    const statuses = [resA.status, resB.status].sort()
    expect(statuses).toEqual([200, 400])

    const wallet = await Wallet.findOne({ priestId: priest.user._id })
    expect(wallet.currentBalance).toBe(300)
  })

  it('a crafted regex search input does not hang', async () => {
    const start = Date.now()

    const res = await request(app)
      .get('/api/devotee/priests')
      .query({ search: '(a+)+b' })

    const elapsed = Date.now() - start
    expect(elapsed).toBeLessThan(2000)
    expect(res.status).toBe(200)
  })
})
