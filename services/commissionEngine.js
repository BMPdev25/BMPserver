// services/commissionEngine.js
const Booking = require('../models/booking');
const Wallet = require('../models/wallet');
const Transaction = require('../models/transaction');
const CompanyRevenue = require('../models/companyRevenue');

// Platform commission rate (5%)
const COMMISSION_RATE = 0.05;

async function processBookingCompletion(bookingId) {
  const booking = await Booking.findById(bookingId);
  if (!booking) {
    throw new Error(`Booking not found: ${bookingId}`);
  }
  if (booking.status !== 'completed') {
    throw new Error(
      `Booking ${bookingId} is not in 'completed' status (current: ${booking.status})`
    );
  }

  const existingTx = await Transaction.findOne({
    bookingId: bookingId,
    type: 'credit_for_booking',
    status: 'completed',
  });
  if (existingTx) {
    throw new Error(`Booking ${bookingId} has already been processed for payment`);
  }

  const priestShare = booking.basePrice;
  const commission =
    booking.platformFee || Math.round(booking.basePrice * COMMISSION_RATE * 100) / 100;
  const totalAmount = booking.totalAmount || priestShare + commission;

  let wallet = await Wallet.findOne({ priestId: booking.priestId });
  if (!wallet) {
    wallet = await Wallet.create({
      priestId: booking.priestId,
      currentBalance: 0,
      totalCredited: 0,
      totalDebited: 0,
    });
  }

  if (wallet.status === 'frozen') {
    throw new Error(`Wallet for priest ${booking.priestId} is frozen`);
  }

  wallet.currentBalance += priestShare;
  wallet.totalCredited += priestShare;
  await wallet.save();

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

  const revenue = await CompanyRevenue.create({
    bookingId: booking._id,
    priestId: booking.priestId,
    totalAmount: totalAmount,
    commissionAmount: commission,
    commissionRate: COMMISSION_RATE,
    priestShare: priestShare,
  });

  booking.paymentStatus = 'completed';
  await booking.save();

  return { wallet, transaction, revenue };
}

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
