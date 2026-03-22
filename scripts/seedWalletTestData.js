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
const { processBookingCompletion } = require('../services/commissionEngine');

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
        const result = await processBookingCompletion(booking._id);
        console.log(`  ✓ Booking ${booking._id}: ₹${result.transaction.amount} → Priest ${booking.priestId}`);
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
      console.log(`  ${w.priestId?.name || w.priestId}: ₹${w.currentBalance} (credited: ₹${w.totalCredited})`);
    }

    // 8. Show company revenue
    const totalRevenue = await CompanyRevenue.aggregate([
      { $group: { _id: null, total: { $sum: '$commissionAmount' } } }
    ]);
    console.log(`\nTotal platform revenue: ₹${totalRevenue[0]?.total || 0}`);

    process.exit(0);
  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  }
}

seed();
