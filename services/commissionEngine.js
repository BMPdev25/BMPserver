// services/commissionEngine.js
const Wallet = require('../models/wallet');

// Platform commission rate (5%)
const COMMISSION_RATE = 0.05;

// NOTE: the booking-completion credit (wallet + transaction + company revenue +
// priest earnings) lives inline in services/bookingService.js updateBookingStatus,
// where it runs inside a single MongoDB transaction. The former
// processBookingCompletion() here duplicated that logic non-atomically and was
// removed; the inline path is the canonical settlement path.

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
  getOrCreateWallet,
  COMMISSION_RATE,
};
