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
const Wallet = require('../../models/wallet')
const Transaction = require('../../models/transaction')
const PriestProfile = require('../../models/priestProfile')
const {
  createDevotee,
  createVerifiedPriest,
  createBooking,
  authHeaders,
} = require('../helpers/factory')

const dateStr = (daysFromNow) => {
  const d = new Date()
  d.setDate(d.getDate() + daysFromNow)
  return d.toISOString().split('T')[0]
}

describe('Booking lifecycle — the revenue path', () => {
  let devotee, priest

  beforeEach(async () => {
    devotee = await createDevotee()
    priest = await createVerifiedPriest({ price: 2400 })
  })

  it('creates a scheduled booking with server-computed pricing', async () => {
    const res = await request(app)
      .post('/api/bookings')
      .set(authHeaders(devotee))
      .send({
        priestId: priest.user._id.toString(),
        ceremonyId: priest.ceremony._id.toString(),
        ceremonyType: priest.ceremony.name,
        date: dateStr(4),
        startTime: '10:00',
        endTime: '11:00',
        location: { address: '123 Test Street', city: 'Mumbai' },
        // Tamper attempt — client-supplied pricing must never be trusted.
        basePrice: 1,
        platformFee: 1,
        totalAmount: 1,
      })

    expect(res.status).toBe(201)
    expect(res.body.data.status).toBe('pending')

    const expectedBasePrice = priest.service.price // 2400
    const expectedFee = Math.round(expectedBasePrice * 0.05)
    expect(res.body.data.basePrice).toBe(expectedBasePrice)
    expect(res.body.data.platformFee).toBe(expectedFee)
    expect(res.body.data.totalAmount).toBe(expectedBasePrice + expectedFee)
  })

  it('rejects payment verification from a non-owner', async () => {
    const otherDevotee = await createDevotee()
    const booking = await createBooking(devotee._id, priest.user._id, 'pending', {
      paymentStatus: 'pending',
      paymentDetails: { receiptNumber: 'r1', rzpOrderId: 'order_owner_check' },
    })

    const res = await request(app)
      .post('/api/bookings/payment/verify')
      .set(authHeaders(otherDevotee))
      .send({
        bookingId: booking._id.toString(),
        rzpOrderId: 'order_owner_check',
        rzpPaymentId: 'pay_x',
        rzpSignature: 'irrelevant_signature',
      })

    expect(res.status).toBe(403)
  })

  it('priest confirms, devotee cannot change status', async () => {
    const priestBooking = await createBooking(devotee._id, priest.user._id, 'pending')
    const confirmRes = await request(app)
      .put(`/api/priest/bookings/${priestBooking._id}/status`)
      .set(authHeaders(priest.user))
      .send({ status: 'confirmed' })

    expect(confirmRes.status).toBe(200)
    expect(confirmRes.body.booking.status).toBe('confirmed')

    const devoteeBooking = await createBooking(devotee._id, priest.user._id, 'pending')
    const devoteeAttempt = await request(app)
      .put(`/api/priest/bookings/${devoteeBooking._id}/status`)
      .set(authHeaders(devotee))
      .send({ status: 'confirmed' })

    expect(devoteeAttempt.status).toBe(403)
  })

  it('completes via the exact route the frontend calls, credits wallet exactly once', async () => {
    const booking = await createBooking(devotee._id, priest.user._id, 'confirmed', {
      basePrice: priest.service.price,
      platformFee: Math.round(priest.service.price * 0.05),
      totalAmount: priest.service.price + Math.round(priest.service.price * 0.05),
      paymentStatus: 'pending',
    })

    // Simulate a verified payment directly in the DB.
    await Booking.findByIdAndUpdate(booking._id, { $set: { paymentStatus: 'completed' } })

    const res = await request(app)
      .post(`/api/bookings/${booking._id}/complete`)
      .set(authHeaders(priest.user))
      .send({})

    expect(res.status).toBe(200)

    const wallet = await Wallet.findOne({ priestId: priest.user._id })
    expect(wallet.currentBalance).toBe(priest.service.price)

    const txCount = await Transaction.countDocuments({
      bookingId: booking._id,
      type: 'credit_for_booking',
    })
    expect(txCount).toBe(1)

    const updatedProfile = await PriestProfile.findOne({ userId: priest.user._id })
    expect(updatedProfile.ceremonyCount).toBe(1)

    // Idempotency — calling complete again must not double-credit.
    await request(app)
      .post(`/api/bookings/${booking._id}/complete`)
      .set(authHeaders(priest.user))
      .send({})

    const walletAfterSecondCall = await Wallet.findOne({ priestId: priest.user._id })
    expect(walletAfterSecondCall.currentBalance).toBe(priest.service.price)

    const txCountAfterSecondCall = await Transaction.countDocuments({
      bookingId: booking._id,
      type: 'credit_for_booking',
    })
    expect(txCountAfterSecondCall).toBe(1)
  })

  it('blocks completion if payment was never verified', async () => {
    const booking = await createBooking(devotee._id, priest.user._id, 'pending', {
      paymentStatus: 'pending',
    })

    const res = await request(app)
      .post(`/api/bookings/${booking._id}/complete`)
      .set(authHeaders(priest.user))
      .send({})

    expect(res.status).toBe(400)
  })
})
