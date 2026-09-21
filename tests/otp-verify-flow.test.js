process.env.NODE_ENV = 'test'

jest.mock('expo-server-sdk', () => ({
  Expo: class {
    static isExpoPushToken() { return false }
    chunkPushNotifications() { return [] }
    async sendPushNotificationsAsync() { return [] }
  },
}))

const mockVerifyIdToken = jest.fn()
const mockCreateCustomToken = jest.fn().mockResolvedValue('mock-custom-token')
jest.mock('../config/firebase', () => ({
  auth: () => ({
    verifyIdToken: mockVerifyIdToken,
    createCustomToken: mockCreateCustomToken,
  }),
}))

const request = require('supertest')
const { app } = require('../server')
const User = require('../models/user')
const Otp = require('../models/otp')

describe('POST /api/auth/verify-otp — success and lockout paths', () => {
  it('verifies a correct OTP, creates a new devotee user, and consumes the OTP record', async () => {
    const phone = '+919991110001'
    await Otp.create({ phone, otp: '123456', attempts: 0 })

    const res = await request(app)
      .post('/api/auth/verify-otp')
      .send({ phone, otp: '123456', userType: 'devotee', name: 'OTP Devotee' })

    expect(res.status).toBe(200)
    expect(res.body.customToken).toBe('mock-custom-token')
    expect(res.body.user.phone).toBe(phone)
    expect(res.body.user.userType).toBe('devotee')

    const user = await User.findOne({ phone })
    expect(user).not.toBeNull()
    expect(user.firebaseUid).toBeDefined()

    const record = await Otp.findOne({ phone })
    expect(record).toBeNull()
  })

  it('rejects verification with a role conflict when the phone is already registered under a different userType', async () => {
    const phone = '+919991110002'
    await User.create({ name: 'Existing Priest', phone, userType: 'priest', firebaseUid: 'existing-fb-uid' })
    await Otp.create({ phone, otp: '654321', attempts: 0 })

    const res = await request(app)
      .post('/api/auth/verify-otp')
      .send({ phone, otp: '654321', userType: 'devotee' })

    expect(res.status).toBe(409)
    expect(res.body.code).toBe('ROLE_CONFLICT')

    // OTP record must survive a rejected verification so the real owner can still retry
    const record = await Otp.findOne({ phone })
    expect(record).not.toBeNull()
  })

  it('returns a decreasing attempts-remaining count on wrong OTP guesses, then locks out at the 5th', async () => {
    const phone = '+919991110003'
    await Otp.create({ phone, otp: '111111', attempts: 0 })

    for (let i = 1; i <= 4; i++) {
      const res = await request(app)
        .post('/api/auth/verify-otp')
        .send({ phone, otp: '000000', userType: 'devotee' })

      expect(res.status).toBe(400)
      expect(res.body.message).toContain(`${5 - i} attempt`)
    }

    const lockoutRes = await request(app)
      .post('/api/auth/verify-otp')
      .send({ phone, otp: '000000', userType: 'devotee' })

    expect(lockoutRes.status).toBe(429)

    // Lockout deletes the OTP record entirely — even the correct code no longer works
    const afterLockout = await request(app)
      .post('/api/auth/verify-otp')
      .send({ phone, otp: '111111', userType: 'devotee' })
    expect(afterLockout.status).toBe(400)
    expect(afterLockout.body.message).toMatch(/OTP not found/)
  })

  it('returns 400 for an OTP that does not exist for the given phone', async () => {
    const res = await request(app)
      .post('/api/auth/verify-otp')
      .send({ phone: '+919991110099', otp: '123456', userType: 'devotee' })

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/OTP not found/)
  })
})

describe('POST /api/auth/sync — firebaseUid account-linking fallback', () => {
  it('links an existing phone-only account to a new Firebase UID on first Firebase login', async () => {
    mockVerifyIdToken.mockResolvedValueOnce({
      uid: 'brand-new-fb-uid',
      email: 'linkme@test.com',
      phone_number: '+919991110004',
    })

    const existing = await User.create({
      name: 'Pre-existing Devotee',
      phone: '+919991110004',
      email: 'linkme@test.com',
      userType: 'devotee',
      firebaseUid: `unlinked_${Date.now()}`,
    })
    await User.updateOne({ _id: existing._id }, { $unset: { firebaseUid: 1 } })

    const res = await request(app)
      .post('/api/auth/sync')
      .set('Authorization', 'Bearer any-token')
      .send({ userType: 'devotee' })

    expect(res.status).toBe(200)
    expect(res.body._id).toBe(existing._id.toString())

    const linked = await User.findById(existing._id)
    expect(linked.firebaseUid).toBe('brand-new-fb-uid')
  })

  it('rejects re-linking an account that already belongs to a different Firebase UID', async () => {
    mockVerifyIdToken.mockResolvedValueOnce({
      uid: 'attacker-fb-uid',
      email: 'taken@test.com',
      phone_number: '+919991110005',
    })

    await User.create({
      name: 'Owner',
      phone: '+919991110005',
      email: 'taken@test.com',
      userType: 'devotee',
      firebaseUid: 'owner-fb-uid',
    })

    const res = await request(app)
      .post('/api/auth/sync')
      .set('Authorization', 'Bearer any-token')
      .send({ userType: 'devotee' })

    expect(res.status).toBe(409)
    expect(res.body.code).toBe('ACCOUNT_EXISTS')
  })
})
