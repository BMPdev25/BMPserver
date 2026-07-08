/**
 * Mock implementation of Razorpay for integration testing.
 * Simulates external API calls and webhook triggers.
 */
const crypto = require('crypto');

// Computes the same HMAC-SHA256 signature bookingService.verifyPayment expects
// (hmac(RAZORPAY_KEY_SECRET, `${orderId}|${paymentId}`)), using the real
// RAZORPAY_KEY_SECRET loaded from .env.test — so signature verification is
// genuinely exercised in tests rather than bypassed.
const signPayment = (orderId, paymentId) =>
  crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

module.exports = {
  orders: {
    create: jest.fn().mockResolvedValue({
      id: 'order_mock_123',
      amount: 50000,
      currency: 'INR',
      status: 'created',
    }),
  },
  payments: {
    fetch: jest.fn().mockResolvedValue({
      id: 'pay_mock_123',
      status: 'captured',
      amount: 50000,
    }),
    refund: jest.fn().mockResolvedValue({
      id: 'rfnd_mock_123',
      status: 'processed',
    }),
  },
  // Mock for verifying webhook signature
  validateWebhookSignature: jest.fn().mockReturnValue(true),
  signPayment,
};
