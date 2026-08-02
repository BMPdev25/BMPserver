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
const { createDevotee, createVerifiedPriest, createBooking, authHeaders } = require('../helpers/factory')

// These are the endpoints the sacred-connect frontend reads with a strict
// `response.data.data...` path and no `||`/`??` fallback on the envelope
// shape itself (confirmed by grepping the frontend's service layer):
//   - services/user/profileService.ts        -> GET /users/profile
//   - services/devotee/bookingManagementService.ts -> GET /bookings, GET /bookings/:id
//   - services/devotee/priestDetailsService.ts -> GET /priest/public/:id
describe('Response envelope contracts', () => {
  let devotee, priest, booking

  beforeEach(async () => {
    devotee = await createDevotee({
      profilePicture: { url: 'https://example.com/devotee.jpg', uploadedAt: new Date() },
    })
    priest = await createVerifiedPriest({
      user: {
        profilePicture: { url: 'https://example.com/priest.jpg', uploadedAt: new Date() },
        languagesSpoken: ['Telugu', 'Hindi'],
      },
    })
    booking = await createBooking(devotee._id, priest.user._id, 'confirmed')
  })

  it('GET /api/users/profile returns the exact { success, data } envelope', async () => {
    const res = await request(app).get('/api/users/profile').set(authHeaders(devotee))

    expect(res.status).toBe(200)
    expect(Object.keys(res.body).sort()).toEqual(['data', 'success'])
    expect(res.body.success).toBe(true)
    expect(res.body.data.data).toBeUndefined() // not double-wrapped
    expect(res.body.data.name).toBe(devotee.name)
  })

  it('GET /api/bookings returns { success, data, pagination } with populated names', async () => {
    const res = await request(app).get('/api/bookings').set(authHeaders(devotee))

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(Array.isArray(res.body.data.all)).toBe(true)

    const found = res.body.data.all.find((b) => b._id === booking._id.toString())
    expect(found).toBeTruthy()
    expect(found.devoteeId.name).toBe(devotee.name)
    expect(found.priestId.name).toBe(priest.user.name)
  })

  it('GET /api/bookings/:id returns populated devoteeId.name and priestId.profilePicture', async () => {
    const res = await request(app)
      .get(`/api/bookings/${booking._id}`)
      .set(authHeaders(devotee))

    expect(res.status).toBe(200)
    expect(Object.keys(res.body).sort()).toEqual(['data', 'success'])
    expect(res.body.data.devoteeId.name).toBe(devotee.name)
    expect(res.body.data.devoteeId.name).not.toBeNull()
    expect(res.body.data.priestId.profilePicture).toBeTruthy()
    expect(res.body.data.priestId.profilePicture.url).toBe('https://example.com/priest.jpg')
  })

  it('GET /api/priest/public/:priestProfileId returns a non-empty languages array', async () => {
    const res = await request(app).get(`/api/priest/public/${priest.profile._id}`)

    expect(res.status).toBe(200)
    expect(Object.keys(res.body).sort()).toEqual(['data', 'success'])
    expect(Array.isArray(res.body.data.languages)).toBe(true)
    expect(res.body.data.languages).toEqual(expect.arrayContaining(['Telugu', 'Hindi']))
  })
})
