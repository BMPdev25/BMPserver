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
      if (token === 'devotee-first-token') {
        return { uid: 'role-conflict-uid-1', email: 'roleconflict1@test.com' }
      }
      if (token === 'priest-first-token') {
        return { uid: 'role-conflict-uid-2', email: 'roleconflict2@test.com' }
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
const User = require('../../models/user')

describe('Role conflict on second-role registration with an existing email', () => {
  it('rejects a priest signup when the email is already registered as a devotee (same Firebase account)', async () => {
    // Step 1: register as devotee
    const devoteeRes = await request(app)
      .post('/api/auth/sync')
      .set('Authorization', 'Bearer devotee-first-token')
      .send({ userType: 'devotee', name: 'Existing Devotee' })

    expect(devoteeRes.status).toBe(200)
    expect(devoteeRes.body.userType).toBe('devotee')

    // Step 2: same Firebase account (same email/uid) attempts priest signup
    const priestRes = await request(app)
      .post('/api/auth/sync')
      .set('Authorization', 'Bearer devotee-first-token')
      .send({ userType: 'priest', name: 'Existing Devotee' })

    expect(priestRes.status).toBe(409)
    expect(priestRes.body.code).toBe('ROLE_CONFLICT')
    expect(priestRes.body.message).toBe(
      'This email is already registered as a devotee. Please use a different email to register as a pandit.'
    )

    // The underlying account must remain untouched — still a devotee, not
    // silently converted or duplicated.
    const usersWithEmail = await User.find({ email: 'roleconflict1@test.com' })
    expect(usersWithEmail).toHaveLength(1)
    expect(usersWithEmail[0].userType).toBe('devotee')
  })

  it('rejects a devotee signup when the email is already registered as a priest (mirror case)', async () => {
    const priestRes = await request(app)
      .post('/api/auth/sync')
      .set('Authorization', 'Bearer priest-first-token')
      .send({ userType: 'priest', name: 'Existing Priest' })

    expect(priestRes.status).toBe(200)
    expect(priestRes.body.userType).toBe('priest')

    const devoteeRes = await request(app)
      .post('/api/auth/sync')
      .set('Authorization', 'Bearer priest-first-token')
      .send({ userType: 'devotee', name: 'Existing Priest' })

    expect(devoteeRes.status).toBe(409)
    expect(devoteeRes.body.code).toBe('ROLE_CONFLICT')
    expect(devoteeRes.body.message).toBe(
      'This email is already registered as a pandit. Please use a different email to register as a devotee.'
    )
  })
})
