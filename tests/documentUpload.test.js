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
const { createTestPriest } = require('./helpers/testFactory')

const authAs = (user, type) => ({
  'x-test-user-id': user._id.toString(),
  'x-test-user-type': type,
})

describe('POST /api/priest/documents', () => {
  it('returns a clean 413 JSON error when the file exceeds the 5MB multer limit', async () => {
    const { user } = await createTestPriest()
    const oversizedBuffer = Buffer.alloc(6 * 1024 * 1024, 'a') // 6MB > 5MB limit

    const res = await request(app)
      .post('/api/priest/documents')
      .set(authAs(user, 'priest'))
      .field('documentType', 'government_id')
      .attach('document', oversizedBuffer, { filename: 'id.jpg', contentType: 'image/jpeg' })

    expect(res.status).toBe(413)
    expect(res.body.success).toBe(false)
    expect(res.body.message).toBe('File too large. Maximum size is 5 MB.')
    expect(res.body.code).toBe('LIMIT_FILE_SIZE')
  })
})
