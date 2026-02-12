// services/commissionEngine.js
// Core business logic: processes booking completion and handles wallet credits.

const Booking = require('../models/booking');
const Wallet = require('../models/wallet');
const Transaction = require('../models/transaction');
const CompanyRevenue = require('../models/companyRevenue');

// Platform commission rate (5%)
const COMMISSION_RATE = 0.05;

/**
 * Process a completed booking:
 * 1. Fetch booking and calculate commission / priest share
 * 2. Find or create priest Wallet
 * 3. Credit priest share to Wallet
 * 4. Create Transaction record (credit_for_booking)
 * 5. Log commission in CompanyRevenue
 * 6. Mark booking paymentStatus as 'completed'
 *
 * @param {string} bookingId - The booking to process
 * @returns {Object} { wallet, transaction, revenue }
 */
async function processBookingCompletion(bookingId) {
  // 1. Fetch booking
  const booking = await Booking.findById(bookingId);
  if (!booking) {
    throw new Error(`Booking not found: ${bookingId}`);
  }
  if (booking.status !== 'completed') {
    throw new Error(`Booking ${bookingId} is not in 'completed' status (current: ${booking.status})`);
  }

  // Check if already processed (idempotency)
  const existingTx = await Transaction.findOne({
    bookingId: bookingId,
    type: 'credit_for_booking',
    status: 'completed',
  });
  if (existingTx) {
    throw new Error(`Booking ${bookingId} has already been processed for payment`);
  }

  // 2. Calculate amounts
  // basePrice = what the priest receives
  // platformFee = 5% on top (already stored on the booking)
  // totalAmount = basePrice + platformFee = what devotee paid
  const priestShare = booking.basePrice;
  const commission = booking.platformFee || Math.round(booking.basePrice * COMMISSION_RATE * 100) / 100;
  const totalAmount = booking.totalAmount || priestShare + commission;

  // 3. Find or create Wallet
  let wallet = await Wallet.findOne({ priestId: booking.priestId });
  if (!wallet) {
    wallet = await Wallet.create({
      priestId: booking.priestId,
      currentBalance: 0,
      totalCredited: 0,
      totalDebited: 0,
    });
  }

  // Check wallet status
  if (wallet.status === 'frozen') {
    throw new Error(`Wallet for priest ${booking.priestId} is frozen`);
  }

  // 4. Credit priest share to wallet
  wallet.currentBalance += priestShare;
  wallet.totalCredited += priestShare;
  await wallet.save();

  // 5. Create Transaction record
  const transaction = await Transaction.create({
    priestId: booking.priestId,
    walletId: wallet._id,
    bookingId: booking._id,
    type: 'credit_for_booking',
    direction: 'inflow',
    amount: priestShare,
    status: 'completed',
    description: `${booking.ceremonyType} ceremony`,
  });

  // 6. Log company revenue
  const revenue = await CompanyRevenue.create({
    bookingId: booking._id,
    priestId: booking.priestId,
    totalAmount: totalAmount,
    commissionAmount: commission,
    commissionRate: COMMISSION_RATE,
    priestShare: priestShare,
  });

  // 7. Update booking paymentStatus
  booking.paymentStatus = 'completed';
  await booking.save();

  return { wallet, transaction, revenue };
}

/**
 * Get or create a wallet for a priest.
 * Useful for ensuring a wallet exists before any operation.
 *
 * @param {string} priestId
 * @returns {Object} wallet document
 */
async function getOrCreateWallet(priestId) {
  let wallet = await Wallet.findOne({ priestId });
  if (!wallet) {
    wallet = await Wallet.create({
      priestId,
      currentBalance: 0,
      totalCredited: 0,
      totalDebited: 0,
    });
  }
  return wallet;
}

module.exports = {
  processBookingCompletion,
  getOrCreateWallet,
  COMMISSION_RATE,
};
