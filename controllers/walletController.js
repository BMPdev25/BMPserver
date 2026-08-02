// controllers/walletController.js
const Transaction = require('../models/transaction');
const Wallet = require('../models/wallet');
const PriestProfile = require('../models/priestProfile');
const { initiateBankTransfer } = require('../config/razorpay');
const { getOrCreateWallet } = require('../services/commissionEngine');

/**
 * GET /api/wallet
 * Get the priest's wallet details + recent transactions.
 */
exports.getWallet = async (req, res) => {
  try {
    const priestId = req.user.id;
    const wallet = await getOrCreateWallet(priestId);

    // Fetch recent transactions
    const transactions = await Transaction.find({ walletId: wallet._id })
      .sort({ createdAt: -1 })
      .limit(20)
      .populate('bookingId', 'ceremonyType date devoteeId');

    res.status(200).json({
      wallet: {
        _id: wallet._id,
        currentBalance: wallet.currentBalance,
        totalCredited: wallet.totalCredited,
        totalDebited: wallet.totalDebited,
        currency: wallet.currency,
        status: wallet.status,
        lastPayoutDate: wallet.lastPayoutDate,
      },
      transactions,
    });
  } catch (error) {
    console.error('Get wallet error:', error);
    res.status(500).json({ message: 'Server error while fetching wallet' });
  }
};

/**
 * POST /api/wallet/withdraw
 * Request a payout from the priest's wallet.
 * Body: { amount, bankDetails: { accountNumber, ifsc, name } }
 */
exports.requestWithdrawal = async (req, res) => {
  try {
    const priestId = req.user.id;
    const { amount, bankDetails } = req.body;

    // Validate amount
    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Invalid withdrawal amount' });
    }

    // Get wallet
    const wallet = await getOrCreateWallet(priestId);

    // Check wallet status
    if (wallet.status === 'frozen') {
      return res
        .status(403)
        .json({ message: 'Your wallet is currently frozen. Please contact support.' });
    }

    // Atomically deduct — prevents double-withdrawal race condition
    const updated = await Wallet.findOneAndUpdate(
      { priestId, currentBalance: { $gte: amount } },
      { $inc: { currentBalance: -amount, totalDebited: amount }, $set: { lastPayoutDate: new Date() } },
      { new: true }
    );
    if (!updated) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient balance',
      });
    }

    // Create a pending transaction
    const transaction = await Transaction.create({
      priestId,
      walletId: updated._id,
      type: 'payout_withdrawal',
      direction: 'outflow',
      amount,
      status: 'pending',
      description: 'Withdrawal to bank account',
    });

    // Initiate bank transfer (mock or Razorpay based on config)
    try {
      const payoutResult = await initiateBankTransfer(
        bankDetails || { accountNumber: 'XXXX', ifsc: 'XXXX', name: 'Priest' },
        amount
      );

      // Update transaction with payout reference
      transaction.referenceId = payoutResult.referenceId;
      transaction.status = payoutResult.success ? 'completed' : 'failed';
      await transaction.save();

      if (payoutResult.success) {
        await PriestProfile.findOneAndUpdate(
          { userId: priestId },
          { $inc: { 'earnings.pendingPayments': -amount } }
        );
      } else {
        await Wallet.findByIdAndUpdate(updated._id, {
          $inc: { currentBalance: amount, totalDebited: -amount },
        });
      }

      res.status(200).json({
        message: 'Withdrawal request processed successfully',
        transactionId: transaction._id,
        referenceId: payoutResult.referenceId,
        amount,
        status: transaction.status,
        newBalance: payoutResult.success ? updated.currentBalance : updated.currentBalance + amount,
      });
    } catch (payoutError) {
      // Payout gateway failed — restore wallet balance atomically
      await Wallet.findByIdAndUpdate(updated._id, {
        $inc: { currentBalance: amount, totalDebited: -amount },
      });

      transaction.status = 'failed';
      await transaction.save();

      console.error('Payout gateway error:', payoutError);
      res.status(500).json({
        message: 'Payout failed. Amount has been refunded to your wallet.',
        transactionId: transaction._id,
      });
    }
  } catch (error) {
    console.error('Withdrawal error:', error);
    res.status(500).json({ message: 'Server error while processing withdrawal' });
  }
};
