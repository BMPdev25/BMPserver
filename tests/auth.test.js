process.env.NODE_ENV = 'test'

// Mock Firebase before any module loads it
jest.mock('../config/firebase', () => ({
  auth: () => ({
    verifyIdToken: jest.fn().mockImplementation(async (token) => {
      if (token === 'valid-firebase-token') {
        return { uid: 'test-uid-auth', email: 'authtest@test.com', phone_number: '+919001234567' }
      }
      const err = new Error('Firebase: token invalid')
      err.code = 'auth/argument-error'
      throw err
    }),
    createCustomToken: jest.fn().mockResolvedValue('mock-custom-token'),
  }),
}))

jest.mock('expo-server-sdk', () => ({
  Expo: class {
    static isExpoPushToken() { return false }
    chunkPushNotifications() { return [] }
    async sendPushNotificationsAsync() { return [] }
  },
}))

const request = require('supertest')
const { app } = require('../server')
const { createTestDevotee } = require('./helpers/testFactory')

describe('POST /api/auth/sync (Firebase login / registration)', () => {
  it('creates a new user on first sync and returns user data', async () => {
    const res = await request(app)
      .post('/api/auth/sync')
      .set('Authorization', 'Bearer valid-firebase-token')
      .send({ userType: 'devotee' })

    expect(res.status).toBe(200)
    expect(res.body._id).toBeDefined()
    expect(res.body.userType).toBe('devotee')
  })

  it('returns 401 when no Authorization header is provided', async () => {
    const res = await request(app).post('/api/auth/sync').send({ userType: 'devotee' })

    expect(res.status).toBe(401)
  })

  it('returns 401 when Firebase token is invalid', async () => {
    const res = await request(app)
      .post('/api/auth/sync')
      .set('Authorization', 'Bearer bad-token')
      .send({ userType: 'devotee' })

    expect(res.status).toBe(401)
  })
})

describe('POST /api/auth/send-otp — validation', () => {
  it('returns 400 when phone is missing', async () => {
    const res = await request(app).post('/api/auth/send-otp').send({})

    expect(res.status).toBe(400)
    expect(res.body.errors[0].field).toBe('phone')
  })

  it('returns 400 when phone format is invalid', async () => {
    const res = await request(app).post('/api/auth/send-otp').send({ phone: '12345' })

    expect(res.status).toBe(400)
  })
})

describe('POST /api/auth/verify-otp — validation', () => {
  it('returns 400 when otp is missing', async () => {
    const res = await request(app)
      .post('/api/auth/verify-otp')
      .send({ phone: '+919001234567' })

    expect(res.status).toBe(400)
    expect(res.body.errors.some((e) => e.field === 'otp')).toBe(true)
  })

  it('returns 400 when otp length is wrong', async () => {
    const res = await request(app)
      .post('/api/auth/verify-otp')
      .send({ phone: '+919001234567', otp: '12' })

    expect(res.status).toBe(400)
  })
})

describe('GET /api/users/profile', () => {
  it('returns user profile for authenticated user', async () => {
    const user = await createTestDevotee()

    const res = await request(app)
      .get('/api/users/profile')
      .set('x-test-user-id', user._id.toString())
      .set('x-test-user-type', 'devotee')

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data._id).toBe(user._id.toString())
    expect(res.body.data.email).toBe(user.email)
    expect(res.body.data.password).toBeUndefined()
  })

  it('returns 401 when no auth is provided', async () => {
    const res = await request(app).get('/api/users/profile')

    expect(res.status).toBe(401)
  })
})
