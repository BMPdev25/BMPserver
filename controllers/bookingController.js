// controllers/bookingController.js
const Booking = require('../models/booking');
const User = require('../models/user');
const PriestProfile = require('../models/priestProfile');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const { isPriestAvailable } = require('../utils/availability');

// Lazy Razorpay initialization guarded by env variables
let razorpay;
function getRazorpayInstance() {
  if (!razorpay) {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) {
      throw new Error('Razorpay keys missing: set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET');
    }
    razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
  }
  return razorpay;
}

// Helper function to categorize bookings
const categorizeBooking = (booking) => {
  const now = new Date();
  const bookingDate = new Date(booking.date);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const bookingDay = new Date(bookingDate.getFullYear(), bookingDate.getMonth(), bookingDate.getDate());
  
  if (booking.status === 'completed') return 'completed';
  if (bookingDay.getTime() === today.getTime()) return 'today';
  if (bookingDate > now) return 'upcoming';
  return 'completed';
};

// Get bookings with categorization
const getBookings = async (req, res) => {
  try {
    const userId = req.user.id;
    const { category, status, page = 1, limit = 10 } = req.query;
    
    const skip = (page - 1) * limit;
    const query = {};
    
    // Determine user role and set appropriate query
    if (req.user.userType === 'priest') {
      query.priestId = userId;
    } else {
      query.devoteeId = userId;
    }

    // Add status filter if provided
    if (status && status !== 'all') {
      query.status = status;
    }

    let bookings = await Booking.find(query)
      .populate('devoteeId', 'name phone profilePicture rating')
      .populate('priestId', 'name phone profilePicture')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Auto-categorize bookings
    bookings = bookings.map(booking => {
      booking.category = categorizeBooking(booking);
      return booking;
    });

    // Filter by category if provided
    if (category && category !== 'all') {
      bookings = bookings.filter(booking => booking.category === category);
    }

    // Categorize bookings for response
    const categorizedBookings = {
      today: bookings.filter(b => b.category === 'today'),
      upcoming: bookings.filter(b => b.category === 'upcoming'),
      completed: bookings.filter(b => b.category === 'completed'),
      all: bookings
    };

    // Get total count for pagination
    const total = await Booking.countDocuments(query);

    res.json({
      success: true,
      data: category && category !== 'all' ? categorizedBookings[category] : categorizedBookings,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / limit),
        hasMore: skip + bookings.length < total
      }
    });
  } catch (error) {
    console.error('Get bookings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch bookings',
      error: error.message
    });
  }
};

// Get booking details
const getBookingDetails = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const userId = req.user.id;

    const booking = await Booking.findById(bookingId)
      .populate('devoteeId', 'name phone email profilePicture rating')
      .populate('priestId', 'name phone email profilePicture')
      .populate({
        path: 'priestId',
        populate: {
          path: 'priestProfile',
          model: 'PriestProfile',
          select: 'ratings experience religiousTradition'
        }
      });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Check if user has access to this booking
    if (booking.devoteeId._id.toString() !== userId && booking.priestId._id.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Auto-categorize booking
    booking.category = categorizeBooking(booking);

    res.json({
      success: true,
      data: booking
    });
  } catch (error) {
    console.error('Get booking details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch booking details',
      error: error.message
    });
  }
};

// Create booking
const createBooking = async (req, res) => {
  try {
    const {
      priestId,
      ceremonyType,
      date,
      startTime,
      endTime,
      location,
      notes,
      basePrice,
      platformFee
    } = req.body;

    const devoteeId = req.user.id;

    // Validate required fields
    if (!priestId || !ceremonyType || !date || !startTime || !endTime || !location || !basePrice) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be provided'
      });
    }

    // Check if priest exists
    const priest = await User.findById(priestId);
    if (!priest || priest.userType !== 'priest') {
      return res.status(404).json({
        success: false,
        message: 'Priest not found'
      });
    }

    // Check priest schedule availability
    const priestProfile = await PriestProfile.findOne({ userId: priestId });
    if (priestProfile && priestProfile.availability) {
        // Calculate duration
        const [startHour, startMin] = startTime.split(':').map(Number);
        const [endHour, endMin] = endTime.split(':').map(Number);
        const durationMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);

        // Check availability
        const isAvailable = isPriestAvailable(priestProfile.availability, date, startTime, durationMinutes);
        if (!isAvailable) {
             return res.status(400).json({
                success: false,
                message: 'Priest is not available at the selected time (Schedule Constraint)'
            });
        }
    }

    // Check priest availability (simplified)
    const bookingDate = new Date(date);
    const existingBooking = await Booking.findOne({
      priestId,
      date: {
        $gte: new Date(bookingDate.setHours(0, 0, 0, 0)),
        $lt: new Date(bookingDate.setHours(23, 59, 59, 999))
      },
      status: { $in: ['confirmed', 'pending'] },
      $or: [
        {
          startTime: { $lte: startTime },
          endTime: { $gt: startTime }
        },
        {
          startTime: { $lt: endTime },
          endTime: { $gte: endTime }
        }
      ]
    });

    if (existingBooking) {
      return res.status(400).json({
        success: false,
        message: 'Priest is not available at the selected time'
      });
    }

    const totalAmount = basePrice + (platformFee || 0);

    // Create booking
    const booking = new Booking({
      devoteeId,
      priestId,
      ceremonyType,
      date: new Date(date),
      startTime,
      endTime,
      location,
      notes,
      basePrice,
      platformFee: platformFee || 0,
      totalAmount,
      status: 'pending', // Default to pending so priest can accept/reject
      paymentDetails: {
        receiptNumber: `BMP_${Date.now()}_${Math.random().toString(36).substr(2, 9).toUpperCase()}`
      },
      statusHistory: [{
        status: 'confirmed',
        timestamp: new Date(),
        updatedBy: devoteeId,
        reason: 'Booking created'
      }]
    });

    await booking.save();

    // Populate the booking with user details
    await booking.populate([
      { path: 'devoteeId', select: 'name phone email' },
      { path: 'priestId', select: 'name phone email' }
    ]);

    res.status(201).json({
      success: true,
      message: 'Booking created successfully',
      data: booking
    });
  } catch (error) {
    console.error('Create booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create booking',
      error: error.message
    });
  }
};

// Update booking status
const updateBookingStatus = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { status, reason } = req.body;
    const userId = req.user.id;

    if (!['confirmed', 'completed', 'cancelled'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Check if user has permission to update this booking
    if (booking.devoteeId.toString() !== userId && booking.priestId.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Update booking status
    booking.status = status;
    
    if (status === 'completed') {
      booking.completionDate = new Date();
    } else if (status === 'cancelled') {
      booking.cancellationDate = new Date();
      booking.cancellationReason = reason;
    }

    // Add to status history
    booking.statusHistory.push({
      status,
      timestamp: new Date(),
      updatedBy: userId,
      reason: reason || `Status changed to ${status}`
    });

    await booking.save();

    // Update priest analytics if booking is completed
    if (status === 'completed') {
      try {
        const priestProfile = await PriestProfile.findOne({ userId: booking.priestId });
        if (priestProfile) {
          priestProfile.ceremonyCount += 1;
          
          // Update earnings
          const currentMonth = new Date().getMonth() + 1;
          const currentYear = new Date().getFullYear();
          
          const earningAmount = booking.basePrice * 0.85; // 85% to priest, 15% platform fee
          
          priestProfile.earnings.totalEarnings += earningAmount;
          priestProfile.earnings.thisMonth += earningAmount;
          priestProfile.earnings.pendingPayments += earningAmount;
          
          // Update monthly earnings
          let monthlyEarning = priestProfile.earnings.monthlyEarnings.find(
            me => me.month === currentMonth && me.year === currentYear
          );
          
          if (monthlyEarning) {
            monthlyEarning.amount += earningAmount;
            monthlyEarning.completedCeremonies += 1;
          } else {
            priestProfile.earnings.monthlyEarnings.push({
              month: currentMonth,
              year: currentYear,
              amount: earningAmount,
              completedCeremonies: 1
            });
          }
          
          await priestProfile.save();
        }
      } catch (analyticsError) {
        console.warn('Failed to update priest analytics:', analyticsError);
      }
    }

    await booking.populate([
      { path: 'devoteeId', select: 'name phone email' },
      { path: 'priestId', select: 'name phone email' }
    ]);

    res.json({
      success: true,
      message: `Booking ${status} successfully`,
      data: booking
    });
  } catch (error) {
    console.error('Update booking status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update booking status',
      error: error.message
    });
  }
};

// Mark booking as completed (for devotees)
const markAsCompleted = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const userId = req.user.id;

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Only devotee can mark as completed
    if (booking.devoteeId.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Only the devotee can mark booking as completed'
      });
    }

    if (booking.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Booking is already completed'
      });
    }

    // Update booking to completed
    booking.status = 'completed';
    booking.completionDate = new Date();
    
    booking.statusHistory.push({
      status: 'completed',
      timestamp: new Date(),
      updatedBy: userId,
      reason: 'Marked as completed by devotee'
    });

    await booking.save();

    res.json({
      success: true,
      message: 'Booking marked as completed successfully',
      data: booking
    });
  } catch (error) {
    console.error('Mark as completed error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark booking as completed',
      error: error.message
    });
  }
};

// Create Razorpay order
const createPaymentOrder = async (req, res) => {
  try {
    const { bookingId, amount } = req.body;

    if (!bookingId || !amount) {
      return res.status(400).json({
        success: false,
        message: 'Booking ID and amount are required'
      });
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Create Razorpay order
    const order = await getRazorpayInstance().orders.create({
      amount: amount * 100, // Convert to paise
      currency: 'INR',
      receipt: `booking_${bookingId}_${Date.now()}`,
      notes: {
        bookingId: bookingId,
        ceremonyType: booking.ceremonyType,
        priestId: booking.priestId.toString()
      }
    });

    // Update booking with order ID
    booking.razorpayOrderId = order.id;
    await booking.save();

    res.json({
      success: true,
      data: {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        booking: booking
      }
    });
  } catch (error) {
    console.error('Create payment order error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create payment order',
      error: error.message
    });
  }
};

// Verify payment
const verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, bookingId } = req.body;

    // Verify signature
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment signature'
      });
    }

    // Update booking payment status
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    booking.paymentStatus = 'completed';
    booking.razorpayPaymentId = razorpay_payment_id;
    booking.paymentDetails.transactionId = razorpay_payment_id;
    booking.paymentDetails.paymentGateway = 'razorpay';

    await booking.save();

    res.json({
      success: true,
      message: 'Payment verified successfully',
      data: {
        paymentId: razorpay_payment_id,
        orderId: razorpay_order_id,
        status: 'completed'
      }
    });
  } catch (error) {
    console.error('Verify payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Payment verification failed',
      error: error.message
    });
  }
};

// Get payment details
const getPaymentDetails = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const userId = req.user.id;

    const booking = await Booking.findById(bookingId)
      .populate('devoteeId', 'name email phone')
      .populate('priestId', 'name email phone');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Check access permissions
    if (booking.devoteeId._id.toString() !== userId && booking.priestId._id.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const paymentInfo = {
      bookingId: booking._id,
      ceremonyType: booking.ceremonyType,
      basePrice: booking.basePrice,
      platformFee: booking.platformFee,
      totalAmount: booking.totalAmount,
      paymentStatus: booking.paymentStatus,
      paymentMethod: booking.paymentMethod,
      paymentDetails: booking.paymentDetails,
      transactionHistory: booking.statusHistory.filter(status => 
        status.reason && status.reason.includes('payment')
      )
    };

    res.json({
      success: true,
      data: paymentInfo
    });
  } catch (error) {
    console.error('Get payment details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment details',
      error: error.message
    });
  }
};

module.exports = {
  getBookings,
  getBookingDetails,
  createBooking,
  updateBookingStatus,
  markAsCompleted,
  createPaymentOrder,
  verifyPayment,
  getPaymentDetails,
};
