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
const paymentGateway = require('../mocks/paymentGateway')
const { createDevotee, createVerifiedPriest, createBooking, authHeaders } = require('../helpers/factory')

describe('Cancellation & refund', () => {
  let devotee, priest

  beforeEach(async () => {
    devotee = await createDevotee()
    priest = await createVerifiedPriest()
    paymentGateway.payments.refund.mockClear()
  })

  const paidConfirmedBooking = (overrides = {}) =>
    createBooking(devotee._id, priest.user._id, 'confirmed', {
      paymentStatus: 'completed',
      paymentDetails: {
        receiptNumber: `rcpt_${Date.now()}`,
        rzpPaymentId: 'pay_mock_paid_1',
      },
      ...overrides,
    })

  it('cancelling a paid booking triggers exactly one refund', async () => {
    const booking = await paidConfirmedBooking()

    const res = await request(app)
      .put(`/api/bookings/${booking._id}/cancel-devotee`)
      .set(authHeaders(devotee))
      .send({ reason: 'Change of plans' })

    expect(res.status).toBe(200)

    const updated = await Booking.findById(booking._id)
    expect(updated.paymentStatus).toBe('refunded')
    expect(paymentGateway.payments.refund).toHaveBeenCalledTimes(1)
  })

  it('cancelling an already-refunded booking does not refund again', async () => {
    const booking = await paidConfirmedBooking()

    const first = await request(app)
      .put(`/api/bookings/${booking._id}/cancel-devotee`)
      .set(authHeaders(devotee))
      .send({ reason: 'Change of plans' })
    expect(first.status).toBe(200)
    expect(paymentGateway.payments.refund).toHaveBeenCalledTimes(1)

    const second = await request(app)
      .put(`/api/bookings/${booking._id}/cancel-devotee`)
      .set(authHeaders(devotee))
      .send({ reason: 'Trying again' })

    expect(second.status).not.toBe(200)
    expect(paymentGateway.payments.refund).toHaveBeenCalledTimes(1)
  })

  it('concurrent devotee-cancel and priest-cancel — exactly one wins', async () => {
    const booking = await paidConfirmedBooking()

    const [devoteeRes, priestRes] = await Promise.all([
      request(app)
        .put(`/api/bookings/${booking._id}/cancel-devotee`)
        .set(authHeaders(devotee))
        .send({ reason: 'Devotee cancel' }),
      request(app)
        .put(`/api/priest/bookings/${booking._id}/status`)
        .set(authHeaders(priest.user))
        .send({ status: 'cancelled', reason: 'Priest cancel' }),
    ])

    const successCount = [devoteeRes.status, priestRes.status].filter((s) => s === 200).length
    expect(successCount).toBe(1)
    expect(paymentGateway.payments.refund).toHaveBeenCalledTimes(1)

    const updated = await Booking.findById(booking._id)
    expect(updated.status).toBe('cancelled')
    expect(updated.paymentStatus).toBe('refunded')
  })
})
