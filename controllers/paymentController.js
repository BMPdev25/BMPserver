// controllers/paymentController.js
const crypto = require('crypto');
const Booking = require('../models/booking');
const pushService = require('../services/pushService');

/**
 * POST /api/payment/webhook
 * Handles Razorpay webhook events securely.
 */
exports.handleWebhook = async (req, res, next) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!signature) {
      console.warn('[Webhook] Missing x-razorpay-signature header');
      return res.status(400).json({ success: false, message: 'Missing signature' });
    }

    if (!secret) {
      console.error('[Webhook] RAZORPAY_WEBHOOK_SECRET is not configured in .env');
      return res.status(500).json({ success: false, message: 'Server webhook configuration error' });
    }

    // Verify webhook signature authenticity using HMAC SHA256 of raw body
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(req.rawBody || '')
      .digest('hex');

    if (expectedSignature !== signature) {
      console.warn('[Webhook] Webhook signature mismatch');
      return res.status(400).json({ success: false, message: 'Invalid signature' });
    }

    const { event, payload } = req.body;
    console.log(`[Webhook] Processing event: ${event}`);

    if (event === 'payment.captured') {
      const paymentEntity = payload.payment.entity;
      const orderId = paymentEntity.order_id;
      const paymentId = paymentEntity.id;

      if (!orderId) {
        console.warn('[Webhook] payment.captured event payload missing order_id');
        return res.status(200).json({ success: true, message: 'Missing order_id in event payload' });
      }

      // Find booking by rzpOrderId
      const booking = await Booking.findOne({ 'paymentDetails.rzpOrderId': orderId });
      if (!booking) {
        console.warn(`[Webhook] No booking matches Razorpay Order ID: ${orderId}`);
        return res.status(200).json({ success: true, message: 'No matching booking found' });
      }

      // Idempotency check: if paymentStatus is already completed, return immediately
      if (booking.paymentStatus === 'completed') {
        console.log(`[Webhook] Booking ${booking._id} already marked completed. Skipping.`);
        return res.status(200).json({ success: true, message: 'Booking already paid' });
      }

      // Lock payment status and details
      booking.paymentStatus = 'completed';
      booking.paymentDetails.rzpPaymentId = paymentId;
      booking.paymentDetails.rzpSignature = signature;

      // For instant bookings: accept-then-pay flow means priest is set (status 'pending').
      // Confirm the booking immediately upon payment success.
      if (booking.bookingType === 'instant' && booking.status === 'pending') {
        booking.status = 'confirmed';
        booking.statusHistory.push({
          status: 'confirmed',
          timestamp: new Date(),
          reason: 'Payment captured via webhook — instant booking confirmed',
        });
      }

      await booking.save();
      console.log(`[Webhook] Payment verified successfully for booking ${booking._id}`);

      // Notify Devotee of payment success
      await pushService.sendToUser(
        booking.devoteeId,
        'Payment Successful! 🎉',
        `Your payment for ${booking.ceremonyType} has been successfully verified.`,
        { screen: 'BookingsTab', bookingId: booking._id.toString(), targetRole: 'devotee' },
        'booking'
      );

      // Trigger priest confirmation notifications
      if (booking.bookingType === 'instant') {
        if (booking.priestId && booking.status === 'confirmed') {
          await pushService.notifyDevoteeBookingConfirmed(
            booking.devoteeId,
            booking
          );
        }
      } else {
        // For scheduled bookings: pay-first flow. Notify priest that a booking has been paid and needs confirmation.
        if (booking.priestId) {
          await pushService.sendToUser(
            booking.priestId,
            'New Paid Request ⚡',
            `A devotee has paid for ${booking.ceremonyType}. Open Requests to confirm.`,
            { screen: 'RequestsTab', bookingId: booking._id.toString(), targetRole: 'priest' },
            'booking'
          );
        }
      }
    } else if (event === 'payment.failed') {
      const paymentEntity = payload.payment.entity;
      const orderId = paymentEntity.order_id;
      console.log(`[Webhook] Payment failed for order ID: ${orderId}`);
    } else if (event === 'refund.processed') {
      const refundEntity = payload.refund.entity;
      const paymentId = refundEntity.payment_id;
      
      const booking = await Booking.findOne({ 'paymentDetails.rzpPaymentId': paymentId });
      if (booking && booking.paymentStatus !== 'refunded') {
        booking.paymentStatus = 'refunded';
        booking.paymentDetails.refundAmount = (refundEntity.amount || 0) / 100;
        booking.paymentDetails.refundDate = new Date();
        await booking.save();
        console.log(`[Webhook] Booking ${booking._id} status updated to refunded`);
      }
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('[Webhook] Error handling Razorpay Webhook:', error);
    next(error);
  }
};
