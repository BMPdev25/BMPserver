process.env.NODE_ENV = 'test'

jest.mock('expo-server-sdk', () => ({
  Expo: class {
    static isExpoPushToken() { return false }
    chunkPushNotifications() { return [] }
    async sendPushNotificationsAsync() { return [] }
  },
}))

jest.mock('../../config/firebase', () => ({
  auth: () => ({
    verifyIdToken: jest.fn().mockImplementation(async (token) => {
      if (token === 'valid-firebase-token') {
        return { uid: 'test-uid-integ', email: 'integ@test.com' }
      }
      const err = new Error('Firebase: token invalid')
      err.code = 'auth/argument-error'
      throw err
    }),
    createCustomToken: jest.fn().mockResolvedValue('mock-custom-token'),
  }),
}))

const request = require('supertest')
const { app } = require('../../server')
const { createTestDevotee } = require('../helpers/testFactory')

describe('Auth Integration', () => {
  it('creates a new user on first Firebase sync', async () => {
    const res = await request(app)
      .post('/api/auth/sync')
      .set('Authorization', 'Bearer valid-firebase-token')
      .send({ userType: 'devotee' })

    expect(res.status).toBe(200)
    expect(res.body._id).toBeDefined()
    expect(res.body.userType).toBe('devotee')
  })

  it('returns 401 when Firebase token is invalid', async () => {
    const res = await request(app)
      .post('/api/auth/sync')
      .set('Authorization', 'Bearer bad-token')
      .send({ userType: 'devotee' })

    expect(res.status).toBe(401)
  })

  it('returns 401 when no auth header provided', async () => {
    const res = await request(app).post('/api/auth/sync').send({ userType: 'devotee' })
    expect(res.status).toBe(401)
  })

  it('returns user profile for authenticated user', async () => {
    const user = await createTestDevotee()

    const res = await request(app)
      .get('/api/users/profile')
      .set('x-test-user-id', user._id.toString())
      .set('x-test-user-type', 'devotee')

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data._id).toBe(user._id.toString())
  })
})
