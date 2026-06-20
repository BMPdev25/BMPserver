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

const Wallet = require('../../models/wallet')
const Transaction = require('../../models/transaction')
const CompanyRevenue = require('../../models/companyRevenue')
const {
  processBookingCompletion,
  getOrCreateWallet,
  COMMISSION_RATE,
} = require('../../services/commissionEngine')
const {
  createTestDevotee,
  createTestPriest,
  createTestBooking,
  createTestWallet,
} = require('../helpers/testFactory')

describe('commissionEngine.processBookingCompletion', () => {
  let devotee, priestUser

  beforeEach(async () => {
    devotee = await createTestDevotee()
    priestUser = (await createTestPriest()).user
  })

  // Helper: a completed, unpaid booking ready for settlement.
  const completedBooking = (overrides = {}) =>
    createTestBooking(devotee._id, priestUser._id, {
      status: 'completed',
      paymentStatus: 'pending',
      basePrice: 2000,
      platformFee: 100,
      totalAmount: 2100,
      ...overrides,
    })

  test('credits the priest share (basePrice) to the wallet', async () => {
    const booking = await completedBooking()

    const { wallet } = await processBookingCompletion(booking._id)

    expect(wallet.currentBalance).toBe(2000)
    expect(wallet.totalCredited).toBe(2000)
    expect(wallet.totalDebited).toBe(0)

    // Persisted, not just the returned in-memory doc
    const fromDb = await Wallet.findOne({ priestId: priestUser._id })
    expect(fromDb.currentBalance).toBe(2000)
  })

  test('creates a completed credit_for_booking transaction for the priest share', async () => {
    const booking = await completedBooking()

    const { transaction } = await processBookingCompletion(booking._id)

    expect(transaction.type).toBe('credit_for_booking')
    expect(transaction.direction).toBe('inflow')
    expect(transaction.amount).toBe(2000)
    expect(transaction.status).toBe('completed')
    expect(transaction.bookingId.toString()).toBe(booking._id.toString())
  })

  test('logs company revenue whose parts sum to the total the devotee paid', async () => {
    const booking = await completedBooking()

    const { revenue } = await processBookingCompletion(booking._id)

    expect(revenue.priestShare).toBe(2000)
    expect(revenue.commissionAmount).toBe(100)
    expect(revenue.totalAmount).toBe(2100)
    expect(revenue.commissionRate).toBe(COMMISSION_RATE)

    // The core money invariant: nothing is created or lost in settlement.
    expect(revenue.priestShare + revenue.commissionAmount).toBe(revenue.totalAmount)
  })

  test('marks the booking paymentStatus as completed', async () => {
    const booking = await completedBooking()

    await processBookingCompletion(booking._id)

    const Booking = require('../../models/booking')
    const updated = await Booking.findById(booking._id)
    expect(updated.paymentStatus).toBe('completed')
  })

  test('is idempotent — a second settlement of the same booking throws and does not double-credit', async () => {
    const booking = await completedBooking()

    await processBookingCompletion(booking._id)
    await expect(processBookingCompletion(booking._id)).rejects.toThrow(/already been processed/i)

    // Exactly one credit transaction and one revenue record exist.
    const txCount = await Transaction.countDocuments({
      bookingId: booking._id,
      type: 'credit_for_booking',
    })
    expect(txCount).toBe(1)

    const revCount = await CompanyRevenue.countDocuments({ bookingId: booking._id })
    expect(revCount).toBe(1)

    // Balance reflects a single credit, not two.
    const wallet = await Wallet.findOne({ priestId: priestUser._id })
    expect(wallet.currentBalance).toBe(2000)
  })

  test('throws when the booking is not in completed status (no premature credit)', async () => {
    const booking = await createTestBooking(devotee._id, priestUser._id, {
      status: 'confirmed',
      paymentStatus: 'completed',
    })

    await expect(processBookingCompletion(booking._id)).rejects.toThrow(/not in 'completed' status/i)

    const wallet = await Wallet.findOne({ priestId: priestUser._id })
    expect(wallet).toBeNull()
  })

  test('throws when the booking does not exist', async () => {
    const mongoose = require('mongoose')
    const missingId = new mongoose.Types.ObjectId()
    await expect(processBookingCompletion(missingId)).rejects.toThrow(/not found/i)
  })

  test('refuses to credit a frozen wallet', async () => {
    await createTestWallet(priestUser._id, { status: 'frozen' })
    const booking = await completedBooking()

    await expect(processBookingCompletion(booking._id)).rejects.toThrow(/frozen/i)

    // No credit applied, booking left unpaid for retry once unfrozen.
    const wallet = await Wallet.findOne({ priestId: priestUser._id })
    expect(wallet.currentBalance).toBe(0)
    const Booking = require('../../models/booking')
    const updated = await Booking.findById(booking._id)
    expect(updated.paymentStatus).not.toBe('completed')
  })

  test('accumulates balance across multiple settled bookings for the same priest', async () => {
    const b1 = await completedBooking({ basePrice: 2000, platformFee: 100, totalAmount: 2100 })
    const b2 = await completedBooking({ basePrice: 3000, platformFee: 150, totalAmount: 3150 })

    await processBookingCompletion(b1._id)
    await processBookingCompletion(b2._id)

    const wallet = await Wallet.findOne({ priestId: priestUser._id })
    expect(wallet.currentBalance).toBe(5000)
    expect(wallet.totalCredited).toBe(5000)

    // Reuses the single wallet rather than creating a second.
    const walletCount = await Wallet.countDocuments({ priestId: priestUser._id })
    expect(walletCount).toBe(1)
  })
})

describe('commissionEngine.getOrCreateWallet', () => {
  let priestUser

  beforeEach(async () => {
    priestUser = (await createTestPriest()).user
  })

  test('creates a zeroed wallet on first call', async () => {
    const wallet = await getOrCreateWallet(priestUser._id)
    expect(wallet.currentBalance).toBe(0)
    expect(wallet.totalCredited).toBe(0)
    expect(wallet.totalDebited).toBe(0)
  })

  test('returns the existing wallet on subsequent calls without creating a duplicate', async () => {
    const first = await getOrCreateWallet(priestUser._id)
    const second = await getOrCreateWallet(priestUser._id)

    expect(second._id.toString()).toBe(first._id.toString())
    const count = await Wallet.countDocuments({ priestId: priestUser._id })
    expect(count).toBe(1)
  })
})
