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

const request = require('supertest')
const { app } = require('../../server')
const { createTestPriest } = require('../helpers/testFactory')

const authAs = (user, type = 'priest') => ({
  'x-test-user-id': user._id.toString(),
  'x-test-user-type': type,
})

describe('GET /api/priest/profile-completion', () => {
  it('returns completion shape for a priest', async () => {
    const { user } = await createTestPriest()

    const res = await request(app)
      .get('/api/priest/profile-completion')
      .set(authAs(user))

    expect(res.status).toBe(200)
    expect(typeof res.body.completionPercentage).toBe('number')
    expect(Array.isArray(res.body.missingFields)).toBe(true)
    expect(Array.isArray(res.body.completedFields)).toBe(true)
    expect(typeof res.body.isVerified).toBe('boolean')
    expect(typeof res.body.canAcceptRequests).toBe('boolean')
  })

  it('returns 401 without authentication', async () => {
    const res = await request(app).get('/api/priest/profile-completion')
    expect(res.status).toBe(401)
  })
})

describe('GET /api/priest/profile', () => {
  it('returns priest profile for authenticated priest', async () => {
    const { user, profile } = await createTestPriest()

    const res = await request(app)
      .get('/api/priest/profile')
      .set(authAs(user))

    expect(res.status).toBe(200)
    expect(res.body.userId).toBeDefined()
  })

  it('returns 401 without authentication', async () => {
    const res = await request(app).get('/api/priest/profile')
    expect(res.status).toBe(401)
  })
})
