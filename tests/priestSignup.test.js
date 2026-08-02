process.env.NODE_ENV = 'test'

// Configurable Firebase mock: the bearer token is base64(JSON(decodedToken)),
// so each test can simulate a distinct Firebase identity (uid/email/phone).
jest.mock('../config/firebase', () => ({
  auth: () => ({
    verifyIdToken: jest.fn(async (token) => {
      try {
        const decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf8'))
        if (!decoded || !decoded.uid) throw new Error('no uid')
        return decoded
      } catch (e) {
        const err = new Error('Firebase: token invalid')
        err.code = 'auth/argument-error'
        throw err
      }
    }),
    createCustomToken: jest.fn().mockResolvedValue('mock-custom-token'),
  }),
}))

// Avoid real SMS / push network calls
jest.mock('../services/smsService', () => ({ sendOtp: jest.fn().mockResolvedValue(true) }))
jest.mock('expo-server-sdk', () => ({
  Expo: class {
    static isExpoPushToken() { return false }
    chunkPushNotifications() { return [] }
    async sendPushNotificationsAsync() { return [] }
  },
}))

const request = require('supertest')
const { app } = require('../server')
const User = require('../models/user')
const PriestProfile = require('../models/priestProfile')
const OtpRecord = require('../models/otp')

// Encode a decoded-token payload as the bearer token our mock understands
const tok = (payload) => Buffer.from(JSON.stringify(payload)).toString('base64')
const sync = (payload, body) =>
  request(app).post('/api/auth/sync').set('Authorization', `Bearer ${tok(payload)}`).send(body)

describe('Priest signup — Firebase (/api/auth/sync)', () => {
  it('registers a priest with string languagesSpoken (no ObjectId cast crash)', async () => {
    const res = await sync(
      { uid: 'fbp-1', email: 'p1@test.com', phone_number: '+919100000001' },
      { userType: 'priest', name: 'Pandit One', languagesSpoken: ['Telugu', 'Hindi'], experience: 7, description: 'Vedic priest' }
    )

    expect(res.status).toBe(200)
    expect(res.body.userType).toBe('priest')
    expect(res.body.verificationStatus).toBe('incomplete')
    expect(res.body.isVerified).toBe(false)

    const user = await User.findOne({ firebaseUid: 'fbp-1' })
    expect(user.languagesSpoken).toEqual(['Telugu', 'Hindi'])

    const profile = await PriestProfile.findOne({ userId: user._id })
    expect(profile).toBeTruthy()
    expect(profile.experience).toBe(7)
    expect(profile.description).toBe('Vedic priest')
    // languages denormalized onto the profile for search
    expect(profile.languagesSpoken).toEqual(['Telugu', 'Hindi'])
  })

  it('allows priest registration without languagesSpoken (collected later in onboarding)', async () => {
    const res = await sync(
      { uid: 'fbp-2', email: 'p2@test.com', phone_number: '+919100000002' },
      { userType: 'priest', name: 'Pandit Two' }
    )
    expect(res.status).toBe(200)

    const user = await User.findOne({ firebaseUid: 'fbp-2' })
    expect(user).toBeTruthy()
    expect(user.languagesSpoken).toEqual([])
  })

  it('allows two email-only (phoneless) priest signups (sparse-index null fix)', async () => {
    const a = await sync(
      { uid: 'fbp-3a', email: 'a-emailonly@test.com' },
      { userType: 'priest', name: 'Email Only A', languagesSpoken: ['Tamil'] }
    )
    const b = await sync(
      { uid: 'fbp-3b', email: 'b-emailonly@test.com' },
      { userType: 'priest', name: 'Email Only B', languagesSpoken: ['Tamil'] }
    )
    expect(a.status).toBe(200)
    expect(b.status).toBe(200) // before fix: 500 on duplicate phone:null
    expect(await User.countDocuments({ email: /emailonly@test\.com/ })).toBe(2)
  })

  it('does not false-match an unrelated phoneless account (no spurious 409)', async () => {
    // Existing phoneless priest
    const first = await sync(
      { uid: 'fbp-4a', email: 'existing@test.com' },
      { userType: 'priest', name: 'Existing', languagesSpoken: ['Hindi'] }
    )
    expect(first.status).toBe(200)

    // Brand-new phoneless priest with a different email/uid must register, not 409
    const second = await sync(
      { uid: 'fbp-4b', email: 'brandnew@test.com' },
      { userType: 'priest', name: 'Brand New', languagesSpoken: ['Hindi'] }
    )
    expect(second.status).toBe(200) // before fix: 409 ACCOUNT_EXISTS (matched phone:null)
    expect(second.body.code).not.toBe('ACCOUNT_EXISTS')
  })

  it('links a Firebase login to a pre-existing account with the same email', async () => {
    // Pre-existing account created out-of-band with no firebaseUid
    await new User({ name: 'Legacy', email: 'legacy@test.com', userType: 'priest', languagesSpoken: ['Hindi'], firebaseUid: undefined, password: 'x' }).save()

    const res = await sync(
      { uid: 'fbp-5', email: 'legacy@test.com' },
      {}
    )
    expect(res.status).toBe(200)
    const linked = await User.findOne({ email: 'legacy@test.com' })
    expect(linked.firebaseUid).toBe('fbp-5')
  })
})

describe('Priest signup — OTP (/api/auth/verify-otp)', () => {
  const verify = (body) => request(app).post('/api/auth/verify-otp').send(body)

  it('registers an OTP priest without the password-required crash and stores fields', async () => {
    const phone = '+919200000001'
    await OtpRecord.create({ phone, otp: '123456', attempts: 0 })

    const res = await verify({
      phone,
      otp: '123456',
      userType: 'priest',
      name: 'OTP Priest',
      languagesSpoken: ['Telugu'],
      experience: 3,
      description: 'OTP onboarded',
    })

    expect(res.status).toBe(200)
    expect(res.body.customToken).toBe('mock-custom-token')
    expect(res.body.user.userType).toBe('priest')

    const user = await User.findOne({ phone })
    expect(user).toBeTruthy()
    expect(user.firebaseUid).toBe(user._id.toString()) // set before save (no password crash)
    expect(user.languagesSpoken).toEqual(['Telugu'])

    const profile = await PriestProfile.findOne({ userId: user._id })
    expect(profile.experience).toBe(3)
    expect(profile.description).toBe('OTP onboarded')
    expect(profile.languagesSpoken).toEqual(['Telugu'])
    expect(profile.isVerified).toBe(false)
  })

  it('allows OTP priest registration without languagesSpoken (collected later in onboarding)', async () => {
    const phone = '+919200000002'
    await OtpRecord.create({ phone, otp: '654321', attempts: 0 })

    const res = await verify({ phone, otp: '654321', userType: 'priest', name: 'No Lang' })
    expect(res.status).toBe(200)

    const user = await User.findOne({ phone })
    expect(user).toBeTruthy()
    expect(user.languagesSpoken).toEqual([])
  })
})

describe('Priest onboarding — profile completion', () => {
  it('counts basicInfo complete for a phone-only priest (no email required)', async () => {
    // Phone-only priest (OTP-style), no email
    const phone = '+919300000001'
    await OtpRecord.create({ phone, otp: '111111', attempts: 0 })
    await request(app).post('/api/auth/verify-otp').send({
      phone, otp: '111111', userType: 'priest', name: 'Phone Priest', languagesSpoken: ['Telugu'],
    })
    const user = await User.findOne({ phone })

    const res = await request(app)
      .get('/api/priest/profile-completion')
      .set('x-test-user-id', user._id.toString())

    expect(res.status).toBe(200)
    expect(res.body.completedFields).toContain('basicInfo') // email-or-phone fix
    expect(res.body.completedFields).toContain('languages')
  })
})
