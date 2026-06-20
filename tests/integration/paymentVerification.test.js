// Razorpay credentials must exist before bookingService is required, because
// getRazorpayInstance() reads them and verifyPayment signs with the secret.
process.env.NODE_ENV = 'test'
process.env.RAZORPAY_KEY_ID = 'rzp_test_key'
process.env.RAZORPAY_KEY_SECRET = 'rzp_test_secret'

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

// Mock the Razorpay SDK. Stable mock fns (mock-prefixed so the jest.mock factory
// may close over them) let each test configure the gateway's responses.
const mockOrdersCreate = jest.fn()
const mockOrdersFetch = jest.fn()
jest.mock('razorpay', () =>
  jest.fn().mockImplementation(() => ({
    orders: { create: mockOrdersCreate, fetch: mockOrdersFetch },
  }))
)

const crypto = require('crypto')
const Booking = require('../../models/booking')
const bookingService = require('../../services/bookingService')
const {
  createTestDevotee,
  createTestPriest,
  createTestBooking,
} = require('../helpers/testFactory')

// Produce the signature Razorpay would send for a given order/payment pair,
// using the same algorithm the server verifies with.
const sign = (orderId, paymentId) =>
  crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest('hex')

const future = () => new Date(Date.now() + 30 * 60 * 1000)
const past = () => new Date(Date.now() - 60 * 1000)

describe('bookingService.verifyPayment — signature verification', () => {
  let devotee, priestUser

  beforeEach(async () => {
    devotee = await createTestDevotee()
    priestUser = (await createTestPriest()).user
  })

  test('accepts a correctly signed payment and marks the booking paid', async () => {
    const booking = await createTestBooking(devotee._id, priestUser._id, {
      status: 'pending',
      paymentStatus: 'pending',
      paymentExpiresAt: future(),
      paymentDetails: { receiptNumber: 'r1', rzpOrderId: 'order_ok' },
    })

    const result = await bookingService.verifyPayment(booking._id, {
      rzpOrderId: 'order_ok',
      rzpPaymentId: 'pay_ok',
      rzpSignature: sign('order_ok', 'pay_ok'),
    })

    expect(result.paymentStatus).toBe('completed')
    expect(result.paymentDetails.rzpPaymentId).toBe('pay_ok')

    const fromDb = await Booking.findById(booking._id)
    expect(fromDb.paymentStatus).toBe('completed')
  })

  test('rejects a tampered signature and leaves the booking unpaid', async () => {
    const booking = await createTestBooking(devotee._id, priestUser._id, {
      status: 'pending',
      paymentStatus: 'pending',
      paymentExpiresAt: future(),
      paymentDetails: { receiptNumber: 'r2', rzpOrderId: 'order_bad' },
    })

    await expect(
      bookingService.verifyPayment(booking._id, {
        rzpOrderId: 'order_bad',
        rzpPaymentId: 'pay_bad',
        rzpSignature: 'deadbeef_not_a_real_signature',
      })
    ).rejects.toMatchObject({ statusCode: 400, message: /verification failed/i })

    const fromDb = await Booking.findById(booking._id)
    expect(fromDb.paymentStatus).toBe('pending')
    expect(fromDb.paymentDetails.rzpPaymentId).toBeFalsy()
  })

  test('rejects a valid signature computed for a different order (order id mismatch)', async () => {
    const booking = await createTestBooking(devotee._id, priestUser._id, {
      status: 'pending',
      paymentStatus: 'pending',
      paymentExpiresAt: future(),
      paymentDetails: { receiptNumber: 'r3', rzpOrderId: 'order_issued' },
    })

    // Signature is internally consistent for order_attacker, but that is not the
    // order we issued for this booking.
    await expect(
      bookingService.verifyPayment(booking._id, {
        rzpOrderId: 'order_attacker',
        rzpPaymentId: 'pay_x',
        rzpSignature: sign('order_attacker', 'pay_x'),
      })
    ).rejects.toMatchObject({ statusCode: 400, message: /mismatch/i })

    const fromDb = await Booking.findById(booking._id)
    expect(fromDb.paymentStatus).toBe('pending')
  })

  test('rejects payment after the 30-minute window has expired (410)', async () => {
    const booking = await createTestBooking(devotee._id, priestUser._id, {
      status: 'pending',
      paymentStatus: 'pending',
      paymentExpiresAt: past(),
      paymentDetails: { receiptNumber: 'r4', rzpOrderId: 'order_late' },
    })

    await expect(
      bookingService.verifyPayment(booking._id, {
        rzpOrderId: 'order_late',
        rzpPaymentId: 'pay_late',
        rzpSignature: sign('order_late', 'pay_late'),
      })
    ).rejects.toMatchObject({ statusCode: 410 })

    const fromDb = await Booking.findById(booking._id)
    expect(fromDb.paymentStatus).toBe('pending')
  })

  test('throws 404 when the booking does not exist', async () => {
    const mongoose = require('mongoose')
    const missingId = new mongoose.Types.ObjectId()
    await expect(
      bookingService.verifyPayment(missingId, {
        rzpOrderId: 'o',
        rzpPaymentId: 'p',
        rzpSignature: sign('o', 'p'),
      })
    ).rejects.toMatchObject({ statusCode: 404 })
  })

  test('confirms an instant booking on successful payment (accept-then-pay)', async () => {
    const booking = await createTestBooking(devotee._id, priestUser._id, {
      bookingType: 'instant',
      status: 'pending',
      paymentStatus: 'pending',
      paymentExpiresAt: future(),
      paymentDetails: { receiptNumber: 'r5', rzpOrderId: 'order_inst' },
    })

    const result = await bookingService.verifyPayment(booking._id, {
      rzpOrderId: 'order_inst',
      rzpPaymentId: 'pay_inst',
      rzpSignature: sign('order_inst', 'pay_inst'),
    })

    expect(result.paymentStatus).toBe('completed')
    expect(result.status).toBe('confirmed')
    expect(result.statusHistory.some((h) => h.status === 'confirmed')).toBe(true)
  })

  test('leaves a scheduled booking pending after payment (priest must still accept)', async () => {
    const booking = await createTestBooking(devotee._id, priestUser._id, {
      bookingType: 'scheduled',
      status: 'pending',
      paymentStatus: 'pending',
      paymentExpiresAt: future(),
      paymentDetails: { receiptNumber: 'r6', rzpOrderId: 'order_sched' },
    })

    const result = await bookingService.verifyPayment(booking._id, {
      rzpOrderId: 'order_sched',
      rzpPaymentId: 'pay_sched',
      rzpSignature: sign('order_sched', 'pay_sched'),
    })

    expect(result.paymentStatus).toBe('completed')
    expect(result.status).toBe('pending')
  })
})

describe('bookingService.createPaymentOrder', () => {
  let devotee, priestUser

  beforeEach(async () => {
    devotee = await createTestDevotee()
    priestUser = (await createTestPriest()).user
    mockOrdersCreate.mockReset()
    mockOrdersFetch.mockReset()
    mockOrdersCreate.mockResolvedValue({
      id: 'order_new',
      amount: 210000,
      currency: 'INR',
      status: 'created',
    })
  })

  test('creates an order for the amount in paise and persists order id + expiry', async () => {
    const booking = await createTestBooking(devotee._id, priestUser._id, {
      paymentStatus: 'pending',
      totalAmount: 2100,
      paymentDetails: { receiptNumber: 'rcpt_1' },
    })

    const order = await bookingService.createPaymentOrder(booking._id, devotee._id)

    expect(order.id).toBe('order_new')
    // Razorpay works in paise — 2100 INR => 210000.
    expect(mockOrdersCreate).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 210000, currency: 'INR', receipt: 'rcpt_1' })
    )

    const fromDb = await Booking.findById(booking._id)
    expect(fromDb.paymentDetails.rzpOrderId).toBe('order_new')
    expect(fromDb.paymentExpiresAt).toBeInstanceOf(Date)
    expect(fromDb.paymentExpiresAt.getTime()).toBeGreaterThan(Date.now())
  })

  test('denies a devotee creating an order for someone else\'s booking (403)', async () => {
    const otherDevotee = await createTestDevotee()
    const booking = await createTestBooking(devotee._id, priestUser._id, {
      paymentStatus: 'pending',
      paymentDetails: { receiptNumber: 'rcpt_2' },
    })

    await expect(
      bookingService.createPaymentOrder(booking._id, otherDevotee._id)
    ).rejects.toMatchObject({ statusCode: 403 })

    expect(mockOrdersCreate).not.toHaveBeenCalled()
  })

  test('refuses to create an order for an already-paid booking (409)', async () => {
    const booking = await createTestBooking(devotee._id, priestUser._id, {
      paymentStatus: 'completed',
      paymentDetails: { receiptNumber: 'rcpt_3' },
    })

    await expect(
      bookingService.createPaymentOrder(booking._id, devotee._id)
    ).rejects.toMatchObject({ statusCode: 409 })

    expect(mockOrdersCreate).not.toHaveBeenCalled()
  })

  test('reuses an existing unpaid order instead of creating a duplicate', async () => {
    const booking = await createTestBooking(devotee._id, priestUser._id, {
      paymentStatus: 'pending',
      paymentDetails: { receiptNumber: 'rcpt_4', rzpOrderId: 'order_existing' },
    })
    mockOrdersFetch.mockResolvedValue({ id: 'order_existing', status: 'created' })

    const order = await bookingService.createPaymentOrder(booking._id, devotee._id)

    expect(order.id).toBe('order_existing')
    expect(mockOrdersFetch).toHaveBeenCalledWith('order_existing')
    expect(mockOrdersCreate).not.toHaveBeenCalled()
  })

  test('rejects when the gateway reports the existing order is already paid (409)', async () => {
    const booking = await createTestBooking(devotee._id, priestUser._id, {
      paymentStatus: 'pending',
      paymentDetails: { receiptNumber: 'rcpt_5', rzpOrderId: 'order_paid' },
    })
    mockOrdersFetch.mockResolvedValue({ id: 'order_paid', status: 'paid' })

    await expect(
      bookingService.createPaymentOrder(booking._id, devotee._id)
    ).rejects.toMatchObject({ statusCode: 409 })

    expect(mockOrdersCreate).not.toHaveBeenCalled()
  })
})
