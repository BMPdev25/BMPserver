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

jest.mock('razorpay', () => {
  return jest.fn().mockImplementation(() => require('../mocks/paymentGateway'))
})

const request = require('supertest')
const { app } = require('../../server')
const Booking = require('../../models/booking')
const {
  createTestDevotee,
  createTestPriest,
  createTestBooking,
  createTestCeremony,
} = require('../helpers/testFactory')

const authAs = (user, type) => ({
  'x-test-user-id': user._id.toString(),
  'x-test-user-type': type,
})

describe('Instant Booking Accept Flow', () => {
  let devotee, priestUser

  beforeEach(async () => {
    devotee = await createTestDevotee()
    const priest = await createTestPriest()
    priestUser = priest.user
  })

  // Build a 'searching' instant booking with NO priest assigned.
  const createSearchingBooking = () =>
    createTestBooking(devotee._id, undefined, {
      status: 'searching',
      priestId: undefined,
      bookingType: 'instant',
    })

  test('priest can claim a searching instant booking → confirmed + assigned + payment deadline', async () => {
    const booking = await createSearchingBooking()

    const res = await request(app)
      .post('/api/priest/bookings/instant/accept')
      .set(authAs(priestUser, 'priest'))
      .send({ bookingId: booking._id.toString() })

    expect(res.status).toBe(200)

    const updated = await Booking.findById(booking._id)
    expect(updated.status).toBe('confirmed')
    expect(updated.priestId.toString()).toBe(priestUser._id.toString())
    // Accept-then-pay: still unpaid, with a payment window opened for the devotee
    expect(updated.paymentStatus).toBe('pending')
    expect(updated.paymentExpiresAt).toBeTruthy()
    expect(updated.paymentExpiresAt.getTime()).toBeGreaterThan(Date.now())
  })

  test('rejects acceptance when the ceremony starts within 2 hours (400)', async () => {
    // date = today, startTime ~1 hour from now → inside the 2h lead requirement
    const soon = new Date(Date.now() + 60 * 60 * 1000)
    const hh = String(soon.getHours()).padStart(2, '0')
    const mm = String(soon.getMinutes()).padStart(2, '0')

    const booking = await createTestBooking(devotee._id, undefined, {
      status: 'searching',
      priestId: undefined,
      bookingType: 'instant',
      date: new Date(),
      startTime: `${hh}:${mm}`,
      endTime: '23:59',
    })

    const res = await request(app)
      .post('/api/priest/bookings/instant/accept')
      .set(authAs(priestUser, 'priest'))
      .send({ bookingId: booking._id.toString() })

    expect(res.status).toBe(400)

    const updated = await Booking.findById(booking._id)
    expect(updated.status).toBe('searching') // unchanged — not claimed
  })

  test('second priest cannot claim an already-accepted booking (409)', async () => {
    const booking = await createSearchingBooking()
    const otherPriest = (await createTestPriest()).user

    const first = await request(app)
      .post('/api/priest/bookings/instant/accept')
      .set(authAs(priestUser, 'priest'))
      .send({ bookingId: booking._id.toString() })
    expect(first.status).toBe(200)

    const second = await request(app)
      .post('/api/priest/bookings/instant/accept')
      .set(authAs(otherPriest, 'priest'))
      .send({ bookingId: booking._id.toString() })
    expect(second.status).toBe(409)
  })

  test('accepting a non-searching booking is rejected (409)', async () => {
    // A normal already-confirmed scheduled booking is not an instant request
    const booking = await createTestBooking(devotee._id, priestUser._id, {
      status: 'confirmed',
    })

    const res = await request(app)
      .post('/api/priest/bookings/instant/accept')
      .set(authAs(priestUser, 'priest'))
      .send({ bookingId: booking._id.toString() })

    expect(res.status).toBe(409)
  })

  test('missing bookingId returns 400', async () => {
    const res = await request(app)
      .post('/api/priest/bookings/instant/accept')
      .set(authAs(priestUser, 'priest'))
      .send({})

    expect(res.status).toBe(400)
  })
})

describe('Instant Booking Creation', () => {
  let devotee, ceremony

  beforeEach(async () => {
    devotee = await createTestDevotee()
    await createTestPriest() // a verified+available priest to broadcast to
    ceremony = await createTestCeremony()
  })

  // A date/time safely more than 2 hours out: tomorrow at 10:00.
  const tomorrow = () => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    return d.toISOString().split('T')[0]
  }

  const validBody = () => ({
    ceremonyType: ceremony.name,
    date: tomorrow(),
    startTime: '10:00',
    endTime: '11:00',
    location: { address: 'Test Street 123', city: 'Bangalore' },
  })

  test('creates a searching instant booking with no priest and no payment taken', async () => {
    const res = await request(app)
      .post('/api/bookings/instant')
      .set(authAs(devotee, 'devotee'))
      .send(validBody())

    expect(res.status).toBe(201)
    expect(res.body.data.status).toBe('searching')
    expect(res.body.data.bookingType).toBe('instant')
    expect(res.body.data.priestId == null).toBe(true)
    expect(res.body.data.paymentStatus).toBe('pending')
  })

  test('rejects an instant booking starting within 2 hours (400)', async () => {
    const soon = new Date(Date.now() + 60 * 60 * 1000)
    const hh = String(soon.getHours()).padStart(2, '0')
    const mm = String(soon.getMinutes()).padStart(2, '0')

    const res = await request(app)
      .post('/api/bookings/instant')
      .set(authAs(devotee, 'devotee'))
      .send({ ...validBody(), date: new Date().toISOString().split('T')[0], startTime: `${hh}:${mm}`, endTime: '23:59' })

    expect(res.status).toBe(400)
  })
})

describe('Instant Available feed (priest)', () => {
  let devotee, priestUser

  beforeEach(async () => {
    devotee = await createTestDevotee()
    priestUser = (await createTestPriest()).user
  })

  test('lists searching instant bookings, excludes assigned/non-instant ones', async () => {
    // A searching instant booking (should appear)
    const searching = await createTestBooking(devotee._id, undefined, {
      status: 'searching',
      priestId: undefined,
      bookingType: 'instant',
    })
    // A normal confirmed scheduled booking (should NOT appear)
    await createTestBooking(devotee._id, priestUser._id, { status: 'confirmed' })

    const res = await request(app)
      .get('/api/priest/bookings/instant-available')
      .set(authAs(priestUser, 'priest'))

    expect(res.status).toBe(200)
    const ids = res.body.data.map((b) => b._id.toString())
    expect(ids).toContain(searching._id.toString())
    expect(res.body.data.every((b) => b.status === 'searching')).toBe(true)
  })
})
