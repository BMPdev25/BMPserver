// scripts/seedWalletTestData.js
// Drops old Transaction documents, creates wallets for existing priests,
// and processes any completed bookings through the commission engine.
//
// Usage: node scripts/seedWalletTestData.js

const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const Transaction = require('../models/transaction');
const Wallet = require('../models/wallet');
const CompanyRevenue = require('../models/companyRevenue');
const Booking = require('../models/booking');
const User = require('../models/user');
const { getOrCreateWallet, COMMISSION_RATE } = require('../services/commissionEngine');

// Local settlement helper for this dev seed. The production credit path is the
// inline transactional block in bookingService.updateBookingStatus, which can
// only be reached by transitioning a booking INTO 'completed'. This seed instead
// back-fills wallets from bookings that are ALREADY 'completed', so it replicates
// the minimal credit here (non-transactional — acceptable for a local seed).
async function creditCompletedBooking(bookingId) {
  const booking = await Booking.findById(bookingId);
  if (!booking) throw new Error(`Booking not found: ${bookingId}`);
  if (booking.status !== 'completed') {
    throw new Error(`Booking ${bookingId} is not in 'completed' status (current: ${booking.status})`);
  }

  const existingTx = await Transaction.findOne({
    bookingId,
    type: 'credit_for_booking',
    status: 'completed',
  });
  if (existingTx) throw new Error(`Booking ${bookingId} has already been processed for payment`);

  const priestShare = booking.basePrice;
  const commission =
    booking.platformFee || Math.round(booking.basePrice * COMMISSION_RATE * 100) / 100;
  const totalAmount = booking.totalAmount || priestShare + commission;

  const wallet = await getOrCreateWallet(booking.priestId);
  if (wallet.status === 'frozen') throw new Error(`Wallet for priest ${booking.priestId} is frozen`);

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

  await CompanyRevenue.create({
    bookingId: booking._id,
    priestId: booking.priestId,
    totalAmount,
    commissionAmount: commission,
    commissionRate: COMMISSION_RATE,
    priestShare,
  });

  booking.paymentStatus = 'completed';
  await booking.save();

  return { wallet, transaction };
}

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI, { dbName: 'bmp' });
    console.log('Connected to MongoDB');

    // 1. Drop old transactions (incompatible schema)
    const oldTxCount = await Transaction.countDocuments();
    if (oldTxCount > 0) {
      await Transaction.deleteMany({});
      console.log(`Deleted ${oldTxCount} old transaction(s)`);
    }

    // 2. Drop old wallets (fresh start)
    await Wallet.deleteMany({});
    console.log('Cleared wallets');

    // 3. Drop old company revenue
    await CompanyRevenue.deleteMany({});
    console.log('Cleared company revenue');

    // 4. Find all priest users
    const priests = await User.find({ userType: 'priest' });
    console.log(`Found ${priests.length} priest(s)`);

    // 5. Create wallets for each priest
    for (const priest of priests) {
      await Wallet.create({
        priestId: priest._id,
        currentBalance: 0,
        totalCredited: 0,
        totalDebited: 0,
      });
      console.log(`Created wallet for priest: ${priest.name} (${priest._id})`);
    }

    // 6. Process all completed bookings through the commission engine
    const completedBookings = await Booking.find({ status: 'completed' });
    console.log(`\nFound ${completedBookings.length} completed booking(s) to process`);

    let successCount = 0;
    let errorCount = 0;
    for (const booking of completedBookings) {
      try {
        const result = await creditCompletedBooking(booking._id);
        console.log(
          `  ✓ Booking ${booking._id}: ₹${result.transaction.amount} → Priest ${booking.priestId}`
        );
        successCount++;
      } catch (err) {
        console.log(`  ✗ Booking ${booking._id}: ${err.message}`);
        errorCount++;
      }
    }

    console.log(`\nDone! ${successCount} booking(s) processed, ${errorCount} error(s)`);

    // 7. Show final wallet balances
    const wallets = await Wallet.find().populate('priestId', 'name');
    console.log('\n--- Wallet Summary ---');
    for (const w of wallets) {
      console.log(
        `  ${w.priestId?.name || w.priestId}: ₹${w.currentBalance} (credited: ₹${w.totalCredited})`
      );
    }

    // 8. Show company revenue
    const totalRevenue = await CompanyRevenue.aggregate([
      { $group: { _id: null, total: { $sum: '$commissionAmount' } } },
    ]);
    console.log(`\nTotal platform revenue: ₹${totalRevenue[0]?.total || 0}`);

    process.exit(0);
  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  }
}

seed();
