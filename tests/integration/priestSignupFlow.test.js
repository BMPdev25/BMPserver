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

describe('Priest Profile Update Flow', () => {
  it('priest can update their profile', async () => {
    const { user } = await createTestPriest()

    const res = await request(app)
      .put('/api/priest/profile')
      .set(authAs(user))
      .send({
        experience: 10,
        description: 'Experienced Vedic Priest with a decade of practice',
        religiousTradition: 'Hindu',
      })

    expect(res.status).toBe(200)
    expect(res.body.experience).toBe(10)
    expect(res.body.description).toBe('Experienced Vedic Priest with a decade of practice')
  })

  it('priest can read back their updated profile', async () => {
    const { user } = await createTestPriest()

    await request(app)
      .put('/api/priest/profile')
      .set(authAs(user))
      .send({ description: 'Profile read-back test priest' })

    const res = await request(app)
      .get('/api/priest/profile')
      .set(authAs(user))

    expect(res.status).toBe(200)
    expect(res.body.userId).toBeDefined()
  })

  it('returns 401 updating profile without auth', async () => {
    const res = await request(app)
      .put('/api/priest/profile')
      .send({ experience: 5 })

    expect(res.status).toBe(401)
  })
})
