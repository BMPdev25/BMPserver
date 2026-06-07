process.env.NODE_ENV = 'test'
process.env.RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'test_secret'

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

const crypto = require('crypto')
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

  test('priest can claim a searching instant booking → pending (awaiting payment) + assigned + payment deadline', async () => {
    const booking = await createSearchingBooking()

    const res = await request(app)
      .post('/api/priest/bookings/instant/accept')
      .set(authAs(priestUser, 'priest'))
      .send({ bookingId: booking._id.toString() })

    expect(res.status).toBe(200)

    const updated = await Booking.findById(booking._id)
    // Accept-then-pay: priest assigned, booking awaits devotee payment (pending),
    // becomes 'confirmed' only once payment is verified.
    expect(updated.status).toBe('pending')
    expect(updated.priestId.toString()).toBe(priestUser._id.toString())
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

  // A date 4 days out — outside the instant window (day+3 onward = scheduled).
  const farDate = () => {
    const d = new Date()
    d.setDate(d.getDate() + 4)
    return d.toISOString().split('T')[0]
  }

  const validBody = () => ({
    ceremonyId: ceremony._id.toString(),
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

  test('rejects an instant booking for a date outside the instant window (400)', async () => {
    const res = await request(app)
      .post('/api/bookings/instant')
      .set(authAs(devotee, 'devotee'))
      .send({ ...validBody(), date: farDate() })

    expect(res.status).toBe(400)
    expect(res.body.code || res.body.message).toBeTruthy()
  })
})

describe('Instant accept-then-pay confirmation', () => {
  let devotee, priestUser

  beforeEach(async () => {
    devotee = await createTestDevotee()
    priestUser = (await createTestPriest()).user
  })

  test('payment verification confirms a pending instant booking', async () => {
    // searching → priest accepts → pending (awaiting payment)
    const booking = await createTestBooking(devotee._id, undefined, {
      status: 'searching',
      priestId: undefined,
      bookingType: 'instant',
    })

    const accept = await request(app)
      .post('/api/priest/bookings/instant/accept')
      .set(authAs(priestUser, 'priest'))
      .send({ bookingId: booking._id.toString() })
    expect(accept.status).toBe(200)

    // Stamp an order id (as createPaymentOrder would) and craft a valid signature.
    await Booking.findByIdAndUpdate(booking._id, {
      $set: { 'paymentDetails.rzpOrderId': 'order_test_123' },
    })
    const sig = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update('order_test_123|pay_test_123')
      .digest('hex')

    const verify = await request(app)
      .post('/api/bookings/payment/verify')
      .set(authAs(devotee, 'devotee'))
      .send({
        bookingId: booking._id.toString(),
        rzpOrderId: 'order_test_123',
        rzpPaymentId: 'pay_test_123',
        rzpSignature: sig,
      })
    expect(verify.status).toBe(200)

    const updated = await Booking.findById(booking._id)
    expect(updated.paymentStatus).toBe('completed')
    expect(updated.status).toBe('confirmed') // instant auto-confirms on payment
  })

  test('devotee can cancel a searching instant booking', async () => {
    const booking = await createTestBooking(devotee._id, undefined, {
      status: 'searching',
      priestId: undefined,
      bookingType: 'instant',
    })

    const res = await request(app)
      .put(`/api/bookings/${booking._id}/cancel-devotee`)
      .set(authAs(devotee, 'devotee'))
      .send({ reason: 'Changed my mind' })

    expect(res.status).toBe(200)
    const updated = await Booking.findById(booking._id)
    expect(updated.status).toBe('cancelled')
  })
})

describe('GET /ceremonies/:id/with-priests', () => {
  test('returns the ceremony and priests who perform it with their own price', async () => {
    const ceremony = await createTestCeremony()
    await createTestPriest({
      profile: {
        services: [{ ceremonyId: ceremony._id, price: 2500, durationMinutes: 90 }],
      },
    })

    const res = await request(app).get(`/api/ceremonies/${ceremony._id}/with-priests`)

    expect(res.status).toBe(200)
    expect(res.body.data.ceremony._id.toString()).toBe(ceremony._id.toString())
    expect(res.body.data.priests.length).toBeGreaterThanOrEqual(1)
    expect(res.body.data.priests[0].priceForThisCeremony).toBe(2500)
  })
})

describe('Scheduled booking rejects instant-window dates', () => {
  test('POST /bookings within the instant window returns 400 USE_INSTANT_WINDOW', async () => {
    const devotee = await createTestDevotee()
    const priestUser = (await createTestPriest()).user
    const ceremony = await createTestCeremony()

    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)

    const res = await request(app)
      .post('/api/bookings')
      .set(authAs(devotee, 'devotee'))
      .send({
        priestId: priestUser._id.toString(),
        ceremonyType: ceremony.name,
        date: tomorrow.toISOString().split('T')[0],
        startTime: '10:00',
        endTime: '11:00',
        location: { address: 'Test Street 123', city: 'Bangalore' },
      })

    expect(res.status).toBe(400)
    expect(res.body.code === 'USE_INSTANT_WINDOW' || /instant booking window/i.test(res.body.message)).toBe(true)
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
