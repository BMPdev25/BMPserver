// controllers/bookingController.js
const bookingService = require('../services/bookingService');

// Get bookings with categorization
exports.getBookings = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const userType = req.user.userType;
    const { category, status, page, limit } = req.query;

    const result = await bookingService.getBookings(userId, userType, {
      category,
      status,
      page,
      limit,
    });

    res.status(200).json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
};

// Get booking details
exports.getBookingDetails = async (req, res, next) => {
  try {
    const { bookingId } = req.params;
    const userId = req.user.id;

    const booking = await bookingService.getBookingDetails(bookingId, userId);

    res.status(200).json({
      success: true,
      data: booking,
    });
  } catch (error) {
    next(error);
  }
};

// Create booking
exports.createBooking = async (req, res, next) => {
  try {
    const devoteeId = req.user.id;
    const booking = await bookingService.createBooking(devoteeId, req.body);

    res.status(201).json({
      success: true,
      message: 'Booking created successfully',
      data: booking,
    });
  } catch (error) {
    next(error);
  }
};

// Update booking status
exports.updateBookingStatus = async (req, res, next) => {
  try {
    const { bookingId } = req.params;
    const { status, reason } = req.body;
    const userId = req.user.id;

    const booking = await bookingService.updateBookingStatus(bookingId, userId, { status, reason });

    res.status(200).json({
      success: true,
      message: `Booking ${status} successfully`,
      booking: booking,
    });
  } catch (error) {
    next(error);
  }
};

// Cancel booking by devotee
exports.cancelBookingByDevotee = async (req, res, next) => {
  try {
    const { bookingId } = req.params;
    const userId = req.user.id;
    const { reason } = req.body;

    const booking = await bookingService.cancelBookingByDevotee(bookingId, userId, reason);

    res.status(200).json({
      success: true,
      message: 'Booking cancelled successfully',
      data: booking,
    });
  } catch (error) {
    next(error);
  }
};

// Create payment order
exports.createPaymentOrder = async (req, res, next) => {
  try {
    const { bookingId } = req.body;
    const userId = req.user.id;

    const order = await bookingService.createPaymentOrder(bookingId, userId);

    res.status(201).json({
      success: true,
      data: order,
    });
  } catch (error) {
    next(error);
  }
};

// Verify payment
exports.verifyPayment = async (req, res, next) => {
  try {
    const { bookingId, rzpPaymentId, rzpOrderId, rzpSignature } = req.body;

    const booking = await bookingService.verifyPayment(bookingId, {
      rzpPaymentId,
      rzpOrderId,
      rzpSignature,
    });

    res.status(200).json({
      success: true,
      message: 'Payment verified successfully',
      data: booking,
    });
  } catch (error) {
    next(error);
  }
};

// Get payment details
exports.getPaymentDetails = async (req, res, next) => {
  try {
    const { bookingId } = req.params;
    const userId = req.user.id;

    const booking = await bookingService.getBookingDetails(bookingId, userId);

    res.status(200).json({
      success: true,
      data: {
        totalAmount: booking.totalAmount,
        paymentStatus: booking.paymentStatus,
        receiptNumber: booking.paymentDetails?.receiptNumber,
        rzpOrderId: booking.paymentDetails?.rzpOrderId,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Mock legacy markAsCompleted for backward compatibility
exports.markAsCompleted = async (req, res, next) => {
  try {
    const { bookingId } = req.params;
    const userId = req.user.id;

    const booking = await bookingService.updateBookingStatus(bookingId, userId, {
      status: 'completed',
    });

    res.status(200).json({
      success: true,
      message: 'Booking marked as completed successfully',
      booking: booking,
    });
  } catch (error) {
    next(error);
  }
};
