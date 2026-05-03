// services/bookingService.js
const mongoose = require('mongoose');
const Booking = require('../models/booking');
const User = require('../models/user');
const PriestProfile = require('../models/priestProfile');
const Notification = require('../models/notification');
const Ceremony = require('../models/ceremony');
const Wallet = require('../models/wallet');
const Transaction = require('../models/transaction');
const CompanyRevenue = require('../models/companyRevenue');
const { getOrCreateWallet } = require('../services/commissionEngine');
const { recalculateReliability, updateDevoteeReliability } = require('../utils/reliabilityEngine');
const { isPriestAvailable } = require('../utils/availability');
const Razorpay = require('razorpay');
const crypto = require('crypto');

const PLATFORM_FEE_PERCENT = 0.05;

let razorpay;
const getRazorpayInstance = () => {
  if (!razorpay) {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) {
      throw new Error('Razorpay keys missing: set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET');
    }
    razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
  }
  return razorpay;
};

const categorizeBooking = (booking) => {
  const now = new Date();
  const bookingDate = new Date(booking.date);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const bookingDay = new Date(
    bookingDate.getFullYear(),
    bookingDate.getMonth(),
    bookingDate.getDate()
  );

  if (booking.status === 'completed') return 'completed';
  if (bookingDay.getTime() === today.getTime()) return 'today';
  if (bookingDate > now) return 'upcoming';
  return 'completed';
};

const getBookings = async (userId, userType, { category, status, page = 1, limit = 10 }) => {
  const skip = (page - 1) * limit;
  const query = {};

  if (userType === 'priest') {
    query.priestId = userId;
  } else {
    query.devoteeId = userId;
  }

  if (status && status !== 'all') {
    query.status = status;
  }

  let bookings = await Booking.find(query)
    .populate('devoteeId', 'name phone profilePicture rating')
    .populate('priestId', 'name phone profilePicture')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  bookings = bookings.map((booking) => {
    const bookingObj = booking.toObject();
    bookingObj.category = categorizeBooking(booking);
    return bookingObj;
  });

  if (category && category !== 'all') {
    bookings = bookings.filter((booking) => booking.category === category);
  }

  const categorizedBookings = {
    today: bookings.filter((b) => b.category === 'today'),
    upcoming: bookings.filter((b) => b.category === 'upcoming'),
    completed: bookings.filter((b) => b.category === 'completed'),
    all: bookings,
  };

  const total = await Booking.countDocuments(query);

  return {
    data: category && category !== 'all' ? categorizedBookings[category] : categorizedBookings,
    pagination: {
      current: parseInt(page),
      total: Math.ceil(total / limit),
      hasMore: skip + bookings.length < total,
    },
  };
};

const getBookingDetails = async (bookingId, userId) => {
  if (!mongoose.Types.ObjectId.isValid(bookingId)) {
    const error = new Error('Invalid booking ID format');
    error.statusCode = 400;
    throw error;
  }

  const booking = await Booking.findById(bookingId)
    .populate('devoteeId', 'name phone email profilePicture rating')
    .populate('priestId', 'name phone email profilePicture');

  if (!booking) {
    const error = new Error('Booking not found');
    error.statusCode = 404;
    throw error;
  }

  const devoteeIdStr = booking.devoteeId?._id?.toString() || booking.devoteeId?.toString();
  const priestIdStr = booking.priestId?._id?.toString() || booking.priestId?.toString();
  if (devoteeIdStr && priestIdStr && devoteeIdStr !== userId && priestIdStr !== userId) {
    const error = new Error('Access denied');
    error.statusCode = 403;
    throw error;
  }

  let priestProfile = null;
  const priestUserIdForProfile = booking.priestId?._id || booking.priestId;
  if (priestUserIdForProfile) {
    priestProfile = await PriestProfile.findOne({ userId: priestUserIdForProfile })
      .select('ratings experience religiousTradition')
      .lean();
  }

  let ceremonyDetails = null;
  const selectFields =
    'name description history category subcategory duration ritualSteps requirements religiousTraditions images';

  if (booking.ceremonyType) {
    const searchName = booking.ceremonyType.trim();
    const ceremony = await Ceremony.findOne({
      name: new RegExp(`^${searchName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
    })
      .select(selectFields)
      .lean();

    if (ceremony) {
      ceremonyDetails = {
        _id: ceremony._id,
        name: ceremony.name,
        description: ceremony.description,
        history: ceremony.history || null,
        category: ceremony.category,
        subcategory: ceremony.subcategory,
        duration: ceremony.duration,
        ritualSteps: ceremony.ritualSteps || [],
        materials: ceremony.requirements?.materials || [],
        specialInstructions: ceremony.requirements?.specialInstructions || [],
        spaceRequirements: ceremony.requirements?.spaceRequirements || null,
        participants: ceremony.requirements?.participants || null,
        image: ceremony.images?.[0]?.url || null,
      };
    }
  }

  const bookingObj = booking.toObject();
  bookingObj.category = categorizeBooking(booking);
  if (priestProfile) bookingObj.priestProfile = priestProfile;
  if (ceremonyDetails) bookingObj.ceremonyDetails = ceremonyDetails;

  return bookingObj;
};

const createBooking = async (devoteeId, bookingData) => {
  const { priestId, ceremonyType, date, startTime, endTime, location, notes } = bookingData;

  const now = new Date();
  const minLeadTime = 2 * 60 * 60 * 1000;
  const bookingStartTime = new Date(date);
  const [h, m] = startTime.split(':').map(Number);
  bookingStartTime.setHours(h, m, 0, 0);

  if (bookingStartTime.getTime() - now.getTime() < minLeadTime) {
    const error = new Error('Bookings must be made at least 2 hours in advance');
    error.statusCode = 400;
    throw error;
  }

  const searchName = ceremonyType.trim();
  const ceremonyItem = await Ceremony.findOne({
    name: new RegExp(`^${searchName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
  });
  if (!ceremonyItem) {
    const error = new Error('Ceremony type not found');
    error.statusCode = 404;
    throw error;
  }

  const basePrice = ceremonyItem.pricing.basePrice;
  const platformFee = Math.round(basePrice * PLATFORM_FEE_PERCENT);

  const todayStr = new Date().toISOString().split('T')[0];
  const bookingDateStr = new Date(date).toISOString().split('T')[0];
  if (bookingDateStr < todayStr) {
    const error = new Error('Booking date cannot be in the past');
    error.statusCode = 400;
    throw error;
  }

  const priest = await User.findById(priestId);
  if (!priest || priest.userType !== 'priest') {
    const error = new Error('Priest not found');
    error.statusCode = 404;
    throw error;
  }

  const priestProfile = await PriestProfile.findOne({ userId: priestId });
  if (priestProfile && !priestProfile.isVerified) {
    const error = new Error(
      'This priest has not been verified yet. Bookings cannot be created for unverified priests.'
    );
    error.statusCode = 403;
    throw error;
  }

  if (priestProfile && priestProfile.availability) {
    const [sH, sM] = startTime.split(':').map(Number);
    const [eH, eM] = endTime.split(':').map(Number);
    const durationMinutes = eH * 60 + eM - (sH * 60 + sM);

    const isAvailable = isPriestAvailable(
      priestProfile.availability,
      date,
      startTime,
      durationMinutes
    );
    if (!isAvailable) {
      const error = new Error('Priest is not available at the selected time (Schedule Constraint)');
      error.statusCode = 400;
      throw error;
    }
  }

  const totalAmount = basePrice + platformFee;

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
    platformFee,
    totalAmount,
    status: 'pending',
    paymentDetails: {
      receiptNumber: `BMP_${Date.now()}_${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
    },
    statusHistory: [
      {
        status: 'confirmed',
        timestamp: new Date(),
        updatedBy: devoteeId,
        reason: 'Booking created',
      },
    ],
  });

  await booking.save();
  await booking.populate([
    { path: 'devoteeId', select: 'name phone email' },
    { path: 'priestId', select: 'name phone email' },
  ]);

  return booking;
};

const updateBookingStatus = async (bookingId, userId, { status, reason }) => {
  const VALID_TRANSITIONS = {
    pending: ['confirmed', 'cancelled'],
    requested: ['confirmed', 'cancelled'],
    confirmed: ['arrived', 'cancelled'],
    arrived: ['in_progress', 'cancelled'],
    in_progress: ['completed', 'cancelled'],
    completed: [],
    cancelled: [],
  };

  const booking = await Booking.findById(bookingId);
  if (!booking) {
    const error = new Error('Booking not found');
    error.statusCode = 404;
    throw error;
  }

  if (booking.priestId.toString() !== userId) {
    const error = new Error('Only the assigned priest can change the booking status');
    error.statusCode = 403;
    throw error;
  }

  if (!VALID_TRANSITIONS[booking.status]?.includes(status)) {
    const error = new Error(`Cannot transition booking from '${booking.status}' to '${status}'`);
    error.statusCode = 400;
    throw error;
  }

  if (['arrived', 'in_progress'].includes(status)) {
    const now = new Date();
    const bookingDate = new Date(booking.date);
    if (
      process.env.NODE_ENV !== 'test' &&
      now.toISOString().split('T')[0] < bookingDate.toISOString().split('T')[0]
    ) {
      const error = new Error(
        'Operation can only be performed on the scheduled day of the booking'
      );
      error.statusCode = 400;
      throw error;
    }
  }

  booking.status = status;
  if (status === 'completed') {
    booking.completionDate = new Date();
  } else if (status === 'cancelled') {
    booking.cancellationDate = new Date();
    booking.cancellationReason = reason;
  }

  booking.statusHistory.push({
    status,
    timestamp: new Date(),
    updatedBy: userId,
    reason: reason || `Status changed to ${status}`,
  });

  await booking.save();

  // Auto-cancel concurrent pending requests if confirmed
  if (status === 'confirmed') {
    try {
      const concurrent = await Booking.find({
        _id: { $ne: booking._id },
        devoteeId: booking.devoteeId,
        date: booking.date,
        startTime: booking.startTime,
        status: 'pending',
      });

      for (const other of concurrent) {
        other.status = 'cancelled';
        other.cancellationReason = 'Another priest accepted a concurrent request';
        other.cancellationDate = new Date();
        other.statusHistory.push({
          status: 'cancelled',
          timestamp: new Date(),
          updatedBy: userId,
          reason: 'Another priest accepted a concurrent request',
        });
        await other.save();

        await Notification.createNotification({
          userId: other.priestId,
          title: 'Request No Longer Available',
          message: `The request for ${other.ceremonyType} on ${new Date(other.date).toLocaleDateString('en-IN')} has been cancelled.`,
          type: 'booking',
          targetRole: 'priest',
          relatedId: other._id,
        });
      }
    } catch (e) {
      console.warn('Auto-cancel failed:', e.message);
    }
  }

  // Analytics and Wallet updates for completed bookings
  if (status === 'completed') {
    try {
      const priestShare = booking.basePrice * (1 - PLATFORM_FEE_PERCENT);
      const commissionAmount = booking.totalAmount - priestShare;

      const wallet = await getOrCreateWallet(booking.priestId);
      wallet.currentBalance += priestShare;
      wallet.totalCredited += priestShare;
      await wallet.save();

      await Transaction.create({
        priestId: booking.priestId,
        walletId: wallet._id,
        bookingId: booking._id,
        type: 'credit_for_booking',
        direction: 'inflow',
        amount: priestShare,
        status: 'completed',
        description: `Earnings for ${booking.ceremonyType}`,
      });

      await CompanyRevenue.create({
        bookingId: booking._id,
        priestId: booking.priestId,
        totalAmount: booking.totalAmount,
        commissionAmount: commissionAmount,
        commissionRate: PLATFORM_FEE_PERCENT,
        priestShare: priestShare,
      });

      await PriestProfile.findOneAndUpdate(
        { userId: booking.priestId },
        {
          $inc: {
            ceremonyCount: 1,
            'earnings.totalEarnings': priestShare,
            'earnings.thisMonth': priestShare,
            'earnings.pendingPayments': priestShare,
          },
        }
      );
    } catch (e) {
      console.warn('Ledger update failed:', e.message);
    }
  }

  // Reliability recalculation
  if (status === 'completed' || status === 'cancelled') {
    recalculateReliability(booking.priestId).catch(() => {});
    if (status === 'completed')
      updateDevoteeReliability(booking.devoteeId, 'completion').catch(() => {});
  }

  await booking.populate([
    { path: 'devoteeId', select: 'name phone email' },
    { path: 'priestId', select: 'name phone email' },
  ]);

  return booking;
};

const cancelBookingByDevotee = async (bookingId, userId, reason) => {
  const booking = await Booking.findById(bookingId);
  if (!booking) {
    const error = new Error('Booking not found');
    error.statusCode = 404;
    throw error;
  }

  if (booking.devoteeId.toString() !== userId) {
    const error = new Error('Not authorized to cancel this booking');
    error.statusCode = 403;
    throw error;
  }

  if (!['pending', 'confirmed'].includes(booking.status)) {
    const error = new Error(`Cannot cancel booking in '${booking.status}' status`);
    error.statusCode = 400;
    throw error;
  }

  booking.status = 'cancelled';
  booking.cancellationReason = reason || 'Cancelled by devotee';
  booking.cancellationDate = new Date();
  booking.statusHistory.push({
    status: 'cancelled',
    timestamp: new Date(),
    updatedBy: userId,
    reason: booking.cancellationReason,
  });

  await booking.save();
  await updateDevoteeReliability(userId, 'cancellation').catch(() => {});

  return booking;
};

const createPaymentOrder = async (bookingId, userId) => {
  const booking = await Booking.findById(bookingId);
  if (!booking) {
    const error = new Error('Booking not found');
    error.statusCode = 404;
    throw error;
  }

  const rzp = getRazorpayInstance();
  const options = {
    amount: booking.totalAmount * 100,
    currency: 'INR',
    receipt: booking.paymentDetails.receiptNumber,
  };

  const order = await rzp.orders.create(options);
  booking.paymentDetails.rzpOrderId = order.id;
  await booking.save();

  return order;
};

const verifyPayment = async (bookingId, paymentData) => {
  const { rzpPaymentId, rzpOrderId, rzpSignature } = paymentData;
  const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET);
  hmac.update(rzpOrderId + '|' + rzpPaymentId);
  const generatedSignature = hmac.digest('hex');

  if (generatedSignature !== rzpSignature) {
    const error = new Error('Payment verification failed');
    error.statusCode = 400;
    throw error;
  }

  const booking = await Booking.findById(bookingId);
  if (!booking) {
    const error = new Error('Booking not found');
    error.statusCode = 404;
    throw error;
  }

  booking.paymentStatus = 'completed';
  booking.paymentDetails.rzpPaymentId = rzpPaymentId;
  booking.paymentDetails.rzpSignature = rzpSignature;
  await booking.save();

  return booking;
};

module.exports = {
  getBookings,
  getBookingDetails,
  createBooking,
  updateBookingStatus,
  cancelBookingByDevotee,
  createPaymentOrder,
  verifyPayment,
};
