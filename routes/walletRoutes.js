// routes/walletRoutes.js
const express = require('express');
const walletController = require('../controllers/walletController');
const { protect, priestOnly } = require('../middleware/authMiddleware');

const router = express.Router();

// All wallet routes require authenticated priest
router.use(protect);
router.use(priestOnly);

// GET /api/wallet — Get wallet balance + recent transactions
router.get('/', walletController.getWallet);

// POST /api/wallet/withdraw — Request a payout
router.post('/withdraw', walletController.requestWithdrawal);

module.exports = router;
