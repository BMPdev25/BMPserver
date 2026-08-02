// routes/paymentRoutes.js
const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');

// Webhook endpoint (Signature checked inside controller, no standard user auth required)
router.post('/webhook', paymentController.handleWebhook);

module.exports = router;
