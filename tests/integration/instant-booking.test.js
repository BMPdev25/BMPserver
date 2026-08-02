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
const Booking = require('../../models/booking')
const {
  createDevotee,
  createVerifiedPriest,
  createCeremony,
  createBooking,
  authHeaders,
} = require('../helpers/factory')

const dateStr = (daysFromNow) => {
  const d = new Date()
  d.setDate(d.getDate() + daysFromNow)
  return d.toISOString().split('T')[0]
}

describe('Instant booking window enforcement', () => {
  let devotee, ceremony

  beforeEach(async () => {
    devotee = await createDevotee()
    ceremony = await createCeremony()
  })

  it('rejects instant booking outside the instant window', async () => {
    const res = await request(app)
      .post('/api/bookings/instant')
      .set(authHeaders(devotee))
      .send({
        ceremonyId: ceremony._id.toString(),
        date: dateStr(5),
        startTime: '10:00',
        endTime: '11:00',
        location: { address: '123 Test Street', city: 'Mumbai' },
      })

    expect(res.status).toBe(400)
    expect(res.body.code).toBe('NOT_INSTANT_WINDOW')
  })

  it('rejects scheduled booking inside the instant window', async () => {
    const priest = await createVerifiedPriest({ ceremony })
    const res = await request(app)
      .post('/api/bookings')
      .set(authHeaders(devotee))
      .send({
        priestId: priest.user._id.toString(),
        ceremonyType: ceremony.name,
        date: dateStr(1),
        startTime: '10:00',
        endTime: '11:00',
        location: { address: '123 Test Street', city: 'Mumbai' },
      })

    expect(res.status).toBe(400)
    expect(res.body.code).toBe('USE_INSTANT_WINDOW')
  })
})

describe('Instant booking accept — concurrency and ownership', () => {
  let devotee, ceremony

  beforeEach(async () => {
    devotee = await createDevotee()
    ceremony = await createCeremony()
  })

  const searchingBooking = (overrides = {}) =>
    createBooking(devotee._id, null, 'searching', {
      bookingType: 'instant',
      ceremonyId: ceremony._id,
      date: (() => {
        const d = new Date()
        d.setDate(d.getDate() + 1)
        return d
      })(),
      startTime: '23:00',
      endTime: '23:59',
      paymentStatus: 'pending',
      ...overrides,
    })

  it('only one priest can accept a searching instant booking', async () => {
    const booking = await searchingBooking()
    const priestA = await createVerifiedPriest({ ceremony })
    const priestB = await createVerifiedPriest({ ceremony })

    const [resA, resB] = await Promise.all([
      request(app)
        .post('/api/priest/bookings/instant/accept')
        .set(authHeaders(priestA.user))
        .send({ bookingId: booking._id.toString() }),
      request(app)
        .post('/api/priest/bookings/instant/accept')
        .set(authHeaders(priestB.user))
        .send({ bookingId: booking._id.toString() }),
    ])

    const statuses = [resA.status, resB.status].sort()
    expect(statuses).toEqual([200, 409])

    const winner = resA.status === 200 ? priestA : priestB
    const updated = await Booking.findById(booking._id)
    expect(updated.priestId.toString()).toBe(winner.user._id.toString())
  })

  it('rejects accept from a priest who does not offer the ceremony', async () => {
    const otherCeremony = await createCeremony()
    const booking = await searchingBooking({ ceremonyId: ceremony._id })
    const priest = await createVerifiedPriest({ ceremony: otherCeremony })

    const res = await request(app)
      .post('/api/priest/bookings/instant/accept')
      .set(authHeaders(priest.user))
      .send({ bookingId: booking._id.toString() })

    expect(res.status).toBe(403)
  })

  it('accepted instant booking has a payment expiry set', async () => {
    const booking = await searchingBooking()
    const priest = await createVerifiedPriest({ ceremony })

    const res = await request(app)
      .post('/api/priest/bookings/instant/accept')
      .set(authHeaders(priest.user))
      .send({ bookingId: booking._id.toString() })

    expect(res.status).toBe(200)

    const updated = await Booking.findById(booking._id)
    expect(updated.paymentExpiresAt).toBeInstanceOf(Date)
    expect(updated.paymentExpiresAt.getTime()).toBeGreaterThan(Date.now())
  })
})
