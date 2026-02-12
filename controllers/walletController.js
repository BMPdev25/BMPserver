// controllers/walletController.js
const Wallet = require('../models/wallet');
const Transaction = require('../models/transaction');
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
      return res.status(403).json({ message: 'Your wallet is currently frozen. Please contact support.' });
    }

    // Check sufficient balance
    if (amount > wallet.currentBalance) {
      return res.status(400).json({
        message: 'Insufficient balance for withdrawal',
        currentBalance: wallet.currentBalance,
      });
    }

    // Deduct from wallet immediately (optimistic)
    wallet.currentBalance -= amount;
    wallet.totalDebited += amount;
    wallet.lastPayoutDate = new Date();
    await wallet.save();

    // Create a pending transaction
    const transaction = await Transaction.create({
      priestId,
      walletId: wallet._id,
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

      // If payout failed, refund the wallet
      if (!payoutResult.success) {
        wallet.currentBalance += amount;
        wallet.totalDebited -= amount;
        await wallet.save();
      }

      res.status(200).json({
        message: 'Withdrawal request processed successfully',
        transactionId: transaction._id,
        referenceId: payoutResult.referenceId,
        amount,
        status: transaction.status,
        newBalance: wallet.currentBalance,
      });
    } catch (payoutError) {
      // Payout gateway failed — refund wallet
      wallet.currentBalance += amount;
      wallet.totalDebited -= amount;
      await wallet.save();

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
