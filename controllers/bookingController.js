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

    // Snapshot before any further population so the HTTP response is stable
    // regardless of whether the priest has an active socket connection.
    const responseData = booking.toObject();

    const io = req.app.get('io');
    const userSockets = req.app.get('userSockets');
    const socketIds = userSockets.get(
      booking.priestId._id?.toString() ?? booking.priestId.toString()
    );
    if (io && socketIds) {
      await booking.populate('devoteeId', 'name profilePicture createdAt');
      const bookingData = booking.toObject();
      if (socketIds instanceof Set || Array.isArray(socketIds) || typeof socketIds.forEach === 'function') {
        socketIds.forEach((socketId) => {
          io.to(socketId).emit('new_booking_request', bookingData);
        });
      } else if (typeof socketIds === 'string') {
        io.to(socketIds).emit('new_booking_request', bookingData);
      }
    }

    res.status(201).json({
      success: true,
      message: 'Booking created successfully',
      data: responseData,
    });
  } catch (error) {
    next(error);
  }
};

// Create an instant booking (broadcast to priests; no priest chosen up front)
exports.createInstantBooking = async (req, res, next) => {
  try {
    const devoteeId = req.user.id;
    const booking = await bookingService.createInstantBooking(devoteeId, req.body);

    res.status(201).json({
      success: true,
      message: 'Searching for an available priest',
      data: booking.toObject(),
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

    // The amount is always derived server-side from booking.totalAmount — a
    // client-supplied amount is never trusted, so only bookingId is required.
    if (!bookingId) {
      return res.status(400).json({
        success: false,
        message: 'Booking ID is required',
      });
    }

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
    const userId = req.user.id;

    const booking = await bookingService.verifyPayment(bookingId, {
      rzpPaymentId,
      rzpOrderId,
      rzpSignature,
    }, userId);

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
