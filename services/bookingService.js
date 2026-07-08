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
const pushService = require('./pushService');

const PLATFORM_FEE_PERCENT = 0.05;
// Minimum gap a priest must have between accepting an instant booking and the
// ceremony start — gives travel + preparation time.
const INSTANT_MIN_LEAD_MS = 2 * 60 * 60 * 1000;
// How long the devotee has to pay after a priest accepts (accept-then-pay flow).
const PAYMENT_WINDOW_MS = 30 * 60 * 1000;

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

/**
 * Issue a Razorpay refund for a paid booking and mark it refunded.
 * Safe to call on any booking — no-ops unless paymentStatus === 'completed'
 * and a Razorpay payment id is present. Never throws: a refund failure is
 * logged for the support team but must not block the cancellation flow.
 *
 * @param {string} bookingId   - Booking._id
 * @param {object} booking     - the in-memory booking (mutated to reflect refund)
 * @param {string} reason      - refund reason recorded on the booking
 */
const issueRefundIfPaid = async (bookingId, booking, reason) => {
  if (booking.paymentStatus !== 'completed' || !booking.paymentDetails?.rzpPaymentId) {
    return;
  }

  // Atomically claim the refund slot — prevents double refund under concurrent calls
  const claimed = await Booking.findOneAndUpdate(
    { _id: bookingId, paymentStatus: 'completed' },
    { $set: { paymentStatus: 'refunding' } },
    { new: true }
  );
  if (!claimed) return; // already refunded or refunding

  try {
    const rzp = getRazorpayInstance();
    const refund = await rzp.payments.refund(claimed.paymentDetails.rzpPaymentId, {
      amount: claimed.totalAmount * 100,
      notes: { reason },
    });
    await Booking.findByIdAndUpdate(claimed._id, {
      $set: {
        paymentStatus: 'refunded',
        'paymentDetails.refundAmount': claimed.totalAmount,
        'paymentDetails.refundReason': reason,
        'paymentDetails.refundDate': new Date(),
      },
    });
    booking.paymentStatus = 'refunded';
    console.log(`[Refund] Initiated for booking ${bookingId}: refund ${refund.id}`);
  } catch (refundErr) {
    // Revert claim so the refund can be retried
    await Booking.findByIdAndUpdate(claimed._id, {
      $set: { paymentStatus: 'completed' },
    });
    console.error(`[Refund] FAILED for booking ${bookingId}:`, refundErr.message);
  }
};

/**
 * Convert an "HH:MM" 24-hour time string to minutes past midnight.
 * Returns NaN if the input is missing or malformed.
 */
const toMinutes = (time) => {
  if (typeof time !== 'string') return NaN;
  const [h, m] = time.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return NaN;
  return h * 60 + m;
};

/**
 * True if the two [start, end) time intervals overlap on the same day.
 * Touching boundaries (one ends exactly when the other starts) do NOT overlap.
 * If either booking is missing valid times, falls back to exact startTime
 * equality so we never silently skip a potential clash.
 */
const timesOverlap = (startA, endA, startB, endB) => {
  const aStart = toMinutes(startA);
  const aEnd = toMinutes(endA);
  const bStart = toMinutes(startB);
  const bEnd = toMinutes(endB);
  if ([aStart, aEnd, bStart, bEnd].some(Number.isNaN)) {
    return startA === startB;
  }
  return aStart < bEnd && bStart < aEnd;
};

// The platform operates on India Standard Time (UTC+5:30). Booking dates are
// stored as midnight-UTC of the intended IST calendar day, so any "which day is
// it" comparison must be done in IST — comparing raw UTC dates wrongly treats
// the IST early-morning hours (when UTC is still the previous day) as a
// different day, e.g. blocking a priest from marking arrival for a dawn puja.
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const istDateStr = (d) =>
  new Date(new Date(d).getTime() + IST_OFFSET_MS).toISOString().split('T')[0];

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
    query.status = Array.isArray(status) ? { $in: status } : status;
  }

  // Apply category as a DB-level filter so pagination counts are accurate
  if (category && category !== 'all') {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    if (category === 'today') {
      query.date = { $gte: todayStart, $lte: todayEnd };
      // Include 'pending' so a request scheduled for today is visible in the
      // priest's "today" view — that's exactly the slot they still need to act on.
      if (!query.status) query.status = { $in: ['pending', 'confirmed', 'arrived', 'in_progress'] };
    } else if (category === 'upcoming') {
      query.date = { $gt: todayEnd };
      if (!query.status) query.status = { $in: ['pending', 'confirmed'] };
    } else if (category === 'completed') {
      query.status = 'completed';
    }
  }

  const total = await Booking.countDocuments(query);

  let bookings = await Booking.find(query)
    .select(
      'ceremonyType date startTime endTime status paymentStatus totalAmount basePrice platformFee location devoteeId priestId paymentDetails.receiptNumber createdAt updatedAt'
    )
    .populate('devoteeId', 'name profilePicture createdAt')
    .populate('priestId', 'name profilePicture')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  bookings = bookings.map((booking) => {
    const bookingObj = booking.toObject();
    bookingObj.category = categorizeBooking(booking);
    return bookingObj;
  });

  const categorizedBookings = {
    today: bookings.filter((b) => b.category === 'today'),
    upcoming: bookings.filter((b) => b.category === 'upcoming'),
    completed: bookings.filter((b) => b.category === 'completed'),
    all: bookings,
  };

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
    .select('-__v -statusHistory')
    .populate('devoteeId', 'name phone email profilePicture rating createdAt')
    .populate('priestId', 'name phone email profilePicture');

  if (!booking) {
    const error = new Error('Booking not found');
    error.statusCode = 404;
    throw error;
  }

  const devoteeIdStr = booking.devoteeId?._id?.toString() ?? booking.devoteeId?.toString() ?? null;
  const priestIdStr = booking.priestId?._id?.toString() ?? booking.priestId?.toString() ?? null;
  const callerIsDevotee = devoteeIdStr !== null && devoteeIdStr === userId;
  const callerIsPriest = priestIdStr !== null && priestIdStr === userId;
  if (!callerIsDevotee && !callerIsPriest) {
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
  const { priestId, ceremonyType, ceremonyId, date, startTime, endTime, location, notes } =
    bookingData;
  const { isScheduledWindow } = require('../utils/dateWindows');

  // ENFORCE: scheduled bookings are for day+3 onwards. Dates within the instant
  // window must go through the instant flow — the frontend detects this code and
  // offers to switch the devotee to instant booking.
  if (!isScheduledWindow(date)) {
    const error = new Error(
      'This date is within the instant booking window. Please use instant booking ' +
        'for today, tomorrow, and the day after.'
    );
    error.statusCode = 400;
    error.code = 'USE_INSTANT_WINDOW';
    throw error;
  }

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

  // Price source: the priest's own price for this ceremony (falls back to the
  // ceremony base price if the priest hasn't set a specific price).
  const ceremonyIdForPrice = ceremonyId || ceremonyItem._id;
  const priestService = (priestProfile?.services || []).find(
    (s) => s.ceremonyId?.toString() === ceremonyIdForPrice?.toString()
  );
  const basePrice = priestService?.price ?? ceremonyItem.pricing.basePrice;
  const platformFee = Math.round(basePrice * PLATFORM_FEE_PERCENT);

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
    ceremonyId: ceremonyIdForPrice || null,
    bookingType: 'scheduled',
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
        status: 'pending',
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

  // Notify priest of new request
  await pushService.notifyPriestNewRequest(booking.priestId._id || booking.priestId, booking);

  return booking;
};

// Instant booking lifecycle timings.
const INSTANT_TTL_MS = 10 * 60 * 1000; // searching expires after 10 min
const INSTANT_HEAD_START_MS = 3 * 60 * 1000; // preferred priest's 3-min lead

/**
 * Create an INSTANT booking. No priest is chosen up front: the booking is
 * broadcast to priests who perform the ceremony and sits in 'searching' until
 * one accepts (see acceptInstantBooking). No payment is taken now — the devotee
 * pays only after a priest accepts (accept-then-pay).
 *
 * Enforces the IST instant date window (today … day+2) and the 2-hour lead time.
 * If a preferredPriestId is supplied (instant started from a priest's page),
 * that priest is notified first and gets a short head-start before the broadcast.
 */
const createInstantBooking = async (devoteeId, bookingData) => {
  const { ceremonyId, date, startTime, endTime, location, notes, preferredPriestId } = bookingData;
  const { isInstantWindow } = require('../utils/dateWindows');

  // ENFORCE: date must be inside the instant window (today … day+2, IST).
  if (!isInstantWindow(date)) {
    const error = new Error(
      'Instant booking is only available for today, tomorrow, and the day after. ' +
        'For later dates, please choose a specific pandit.'
    );
    error.statusCode = 400;
    error.code = 'NOT_INSTANT_WINDOW';
    throw error;
  }

  // ENFORCE: ceremony must exist (looked up by id for instant bookings).
  if (!ceremonyId || !mongoose.Types.ObjectId.isValid(ceremonyId)) {
    const error = new Error('A valid ceremonyId is required');
    error.statusCode = 400;
    throw error;
  }
  const ceremony = await Ceremony.findById(ceremonyId).select('name pricing');
  if (!ceremony) {
    const error = new Error('Ceremony not found');
    error.statusCode = 404;
    throw error;
  }

  // ENFORCE: the ceremony must start at least 2 hours from now (IST).
  const [h, m] = (startTime || '').split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) {
    const error = new Error('A valid startTime (HH:MM) is required');
    error.statusCode = 400;
    throw error;
  }
  const ceremonyDateTime = new Date(`${date}T${startTime}:00+05:30`);
  if (ceremonyDateTime.getTime() < Date.now() + INSTANT_MIN_LEAD_MS) {
    const error = new Error('Ceremony must start at least 2 hours from now');
    error.statusCode = 400;
    throw error;
  }

  const basePrice = ceremony.pricing.basePrice;
  const platformFee = Math.round(basePrice * PLATFORM_FEE_PERCENT);
  // Devotee is charged base + platform fee (keeps the revenue ledger balanced);
  // the priest's share is basePrice and the platform keeps platformFee.
  const totalAmount = basePrice + platformFee;

  const instantExpiresAt = new Date(Date.now() + INSTANT_TTL_MS);
  const headStartExpiresAt = preferredPriestId
    ? new Date(Date.now() + INSTANT_HEAD_START_MS)
    : null;

  const booking = await Booking.create({
    devoteeId,
    priestId: null, // not assigned yet
    ceremonyType: ceremony.name,
    ceremonyId,
    bookingType: 'instant',
    status: 'searching',
    date: new Date(date),
    startTime,
    endTime,
    location,
    notes,
    basePrice,
    platformFee,
    totalAmount,
    paymentStatus: 'pending', // payment happens AFTER a priest accepts
    preferredPriestId: preferredPriestId || null,
    instantExpiresAt,
    headStartExpiresAt,
    paymentDetails: {
      receiptNumber: `BMP_${Date.now()}_${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
    },
    statusHistory: [
      {
        status: 'searching',
        timestamp: new Date(),
        updatedBy: devoteeId,
        reason: 'Instant booking created — searching for a priest',
      },
    ],
  });

  await broadcastInstantBooking(booking, {
    headStartPriestId: preferredPriestId || null,
  });

  return booking;
};

/**
 * Notify priests of a new instant booking. Targets verified, currently-available
 * priests who actually perform the requested ceremony. If a preferred priest is
 * given, they are notified first and everyone else only after the head-start
 * window elapses (and only if the booking is still searching).
 */
const broadcastInstantBooking = async (booking, options = {}) => {
  const { headStartPriestId } = options;
  const io = global.io || null;
  const userSockets = global.userSockets || null; // Map<userId, socketId>

  const availablePriests = await PriestProfile.find({
    isVerified: true,
    'currentAvailability.status': 'available',
    'services.ceremonyId': booking.ceremonyId,
  })
    .select('userId')
    .lean();

  if (availablePriests.length === 0) {
    console.warn(`[Instant] No available priests for ceremony ${booking.ceremonyId}`);
    return;
  }

  const priestUserIds = availablePriests.map((p) => p.userId.toString());

  const notifyPriest = async (priestUserId) => {
    const socketId =
      userSockets && typeof userSockets.get === 'function' ? userSockets.get(priestUserId) : null;
    if (socketId && io) {
      io.to(socketId).emit('new_instant_request', {
        bookingId: booking._id,
        ceremonyType: booking.ceremonyType,
        date: booking.date,
        startTime: booking.startTime,
        location: booking.location,
        basePrice: booking.basePrice,
        isInstant: true,
        expiresAt: booking.instantExpiresAt,
      });
    }
    await pushService.sendToUser(
      priestUserId,
      'Instant Booking Request ⚡',
      `${booking.ceremonyType} requested for today/tomorrow. Respond quickly!`,
      { screen: 'RequestsTab', bookingId: booking._id.toString(), targetRole: 'priest' },
      'booking'
    );
  };

  const headStartId = headStartPriestId ? headStartPriestId.toString() : null;
  if (headStartId && priestUserIds.includes(headStartId)) {
    // Give the preferred priest a head-start, then open to everyone else.
    await notifyPriest(headStartId);
    setTimeout(async () => {
      try {
        const current = await Booking.findById(booking._id).select('status').lean();
        if (current?.status === 'searching') {
          for (const priestId of priestUserIds) {
            if (priestId !== headStartId) await notifyPriest(priestId);
          }
        }
      } catch (e) {
        console.warn('[Instant] Head-start broadcast failed:', e.message);
      }
    }, INSTANT_HEAD_START_MS);
  } else {
    // No preference — notify everyone immediately.
    for (const priestId of priestUserIds) {
      await notifyPriest(priestId);
    }
  }
};

/**
 * List instant bookings still awaiting a priest ('searching'), newest first.
 * These have no priestId yet — any verified priest may claim one. Returns lean
 * objects with the devotee summary for the priest's request feed.
 */
const getInstantAvailable = async ({ limit = 20 } = {}) => {
  const bookings = await Booking.find({ status: 'searching', bookingType: 'instant' })
    .select(
      'ceremonyType date startTime endTime basePrice totalAmount location devoteeId status bookingType createdAt'
    )
    .populate('devoteeId', 'name profilePicture createdAt')
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .lean();

  return bookings;
};

const updateBookingStatus = async (bookingId, userId, { status, reason }) => {
  const VALID_TRANSITIONS = {
    pending: ['confirmed', 'cancelled', 'rejected'],
    // Note: 'requested' is not produced anywhere — bookings start at 'pending'
    // (or 'searching' for instant). Left out of the transition map intentionally.
    confirmed: ['arrived', 'completed', 'cancelled'],
    arrived: ['in_progress', 'cancelled'],
    in_progress: ['completed', 'cancelled'],
    completed: [],
    cancelled: [],
  };

  const booking = await Booking.findById(bookingId).populate('devoteeId', 'name phone email');
  if (!booking) {
    const error = new Error('Booking not found');
    error.statusCode = 404;
    throw error;
  }

  if (!booking.priestId || booking.priestId.toString() !== userId) {
    const error = new Error('Only the assigned priest can change the booking status');
    error.statusCode = 403;
    throw error;
  }

  if (!VALID_TRANSITIONS[booking.status]?.includes(status)) {
    const error = new Error(`Cannot transition booking from '${booking.status}' to '${status}'`);
    error.statusCode = 400;
    throw error;
  }

  // Instant bookings are confirmed by the devotee's payment, not by the priest
  // re-accepting. Block a priest from confirming an unpaid instant booking so the
  // accept-then-pay gate can't be bypassed.
  if (
    status === 'confirmed' &&
    booking.bookingType === 'instant' &&
    booking.paymentStatus !== 'completed'
  ) {
    const error = new Error(
      'This instant booking is awaiting devotee payment and cannot be confirmed manually.'
    );
    error.statusCode = 400;
    throw error;
  }

  if (status === 'confirmed') {
    const bookingDay = new Date(booking.date);
    const startOfDay = new Date(bookingDay);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(bookingDay);
    endOfDay.setUTCHours(23, 59, 59, 999);

    // Fetch all of the priest's active bookings that day, then check for an
    // actual time-interval overlap in JS — matching only on identical startTime
    // would let overlapping ranges (e.g. 10:00–12:00 vs 11:00–13:00) slip through.
    const sameDayBookings = await Booking.find({
      _id: { $ne: booking._id },
      priestId: booking.priestId,
      date: { $gte: startOfDay, $lte: endOfDay },
      status: { $in: ['confirmed', 'arrived', 'in_progress'] },
    }).select('startTime endTime');

    const conflict = sameDayBookings.find((other) =>
      timesOverlap(booking.startTime, booking.endTime, other.startTime, other.endTime)
    );

    if (conflict) {
      const error = new Error(
        'You already have a confirmed booking that overlaps this time. Please check your calendar before accepting.'
      );
      error.statusCode = 409;
      throw error;
    }
  }

  if (status === 'completed' && booking.paymentStatus !== 'completed') {
    const error = new Error('Cannot mark booking complete — payment has not been verified');
    error.statusCode = 400;
    throw error;
  }

  if (['arrived', 'in_progress'].includes(status)) {
    // Compare in IST so a dawn ceremony can be actioned from IST midnight onward,
    // not blocked until UTC catches up to the same calendar day.
    if (process.env.NODE_ENV !== 'test' && istDateStr(new Date()) < istDateStr(booking.date)) {
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
  } else if (status === 'cancelled' || status === 'rejected') {
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

  if (status === 'confirmed') {
    await pushService.notifyDevoteeBookingConfirmed(booking.devoteeId._id, booking);
  }

  if (status === 'cancelled') {
    // Refund the devotee if they had already paid before the priest cancelled
    await issueRefundIfPaid(booking._id, booking, reason || 'Cancelled by priest');
    // This endpoint is priestOnly — the priest is always the caller here
    await pushService.notifyDevoteeCancelledByPriest(booking.devoteeId._id, booking);
  }

  if (status === 'rejected') {
    // Refund the devotee if they had already paid before the priest declined
    await issueRefundIfPaid(booking._id, booking, reason || 'Declined by priest');
    await pushService.notifyDevoteeBookingDeclined(booking.devoteeId._id, booking);
  }

  // Auto-cancel concurrent pending requests if confirmed
  if (status === 'confirmed') {
    try {
      const bookingDay = new Date(booking.date);
      const startOfDay = new Date(bookingDay);
      startOfDay.setUTCHours(0, 0, 0, 0);
      const endOfDay = new Date(bookingDay);
      endOfDay.setUTCHours(23, 59, 59, 999);

      const sameDayPending = await Booking.find({
        _id: { $ne: booking._id },
        devoteeId: booking.devoteeId,
        date: { $gte: startOfDay, $lte: endOfDay },
        status: 'pending',
      });

      // Only cancel the devotee's other pending requests whose time actually
      // overlaps the one just confirmed — non-overlapping same-day requests
      // (e.g. a morning and an evening ceremony) must be left intact.
      const concurrent = sameDayPending.filter((other) =>
        timesOverlap(booking.startTime, booking.endTime, other.startTime, other.endTime)
      );

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
    const priestShare = booking.basePrice;
    const commissionAmount = booking.platformFee;

    // Ensure the wallet exists before the ledger transaction. (Kept outside the
    // session so a brand-new wallet is committed independently of the credit.)
    const wallet = await getOrCreateWallet(booking.priestId);

    // All four ledger writes must commit together or not at all — a partial
    // failure here is financial drift (e.g. wallet credited but no Transaction
    // row, or revenue recorded without crediting the priest). Wrap them in a
    // single MongoDB transaction (Atlas supports sessions).
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        // ATOMIC idempotency gate: the unique index on (bookingId,
        // type='credit_for_booking') prevents double-credit even under
        // concurrent requests. A duplicate throws error.code 11000, which
        // aborts the whole transaction and is handled as a no-op below.
        // (create() must use the array form to accept a session.)
        await Transaction.create(
          [
            {
              priestId: booking.priestId,
              walletId: wallet._id,
              bookingId: booking._id,
              type: 'credit_for_booking',
              direction: 'inflow',
              amount: priestShare,
              status: 'completed',
              description: `Earnings for ${booking.ceremonyType}`,
            },
          ],
          { session }
        );

        // Atomic $inc — safe even if called concurrently (no read-modify-write)
        await Wallet.findOneAndUpdate(
          { priestId: booking.priestId },
          { $inc: { currentBalance: priestShare, totalCredited: priestShare } },
          { session }
        );

        await CompanyRevenue.create(
          [
            {
              bookingId: booking._id,
              priestId: booking.priestId,
              totalAmount: booking.totalAmount,
              commissionAmount: commissionAmount,
              commissionRate: PLATFORM_FEE_PERCENT,
              priestShare: priestShare,
            },
          ],
          { session }
        );

        // pendingPayments = money credited to wallet but not yet withdrawn
        await PriestProfile.findOneAndUpdate(
          { userId: booking.priestId },
          {
            $inc: {
              ceremonyCount: 1,
              'earnings.totalEarnings': priestShare,
              'earnings.pendingPayments': priestShare,
            },
          },
          { session }
        );
      });

      // Side-effecting push — sent only after the ledger has committed, so a
      // transaction rollback (or duplicate-key abort) never fires a false
      // "payment credited" notification.
      await pushService.notifyPriestPaymentCredited(
        booking.priestId._id || booking.priestId,
        booking,
        priestShare
      );
    } catch (e) {
      if (e.code === 11000) {
        // Duplicate key on (bookingId, type) — already processed, not an error.
        // The transaction aborted, so nothing was credited twice.
        console.log(`[Wallet] Booking ${booking._id} already credited. Skipping.`);
      } else {
        console.warn('Ledger update failed:', e.message);
      }
    } finally {
      await session.endSession();
    }
  }

  // Reliability recalculation
  if (status === 'completed' || status === 'cancelled' || status === 'rejected') {
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

/**
 * A priest claims an instant booking that is broadcast to multiple priests.
 * Such bookings live in the 'searching' state with NO priestId assigned until
 * the first priest accepts. This is a distinct flow from updateBookingStatus,
 * which assumes the priest is already assigned to the booking.
 *
 * The claim is atomic: the findOneAndUpdate filters on status:'searching', so
 * only the first concurrent request transitions it to 'confirmed' — any later
 * request finds it no longer 'searching' and is rejected.
 */
const acceptInstantBooking = async (bookingId, priestId) => {
  if (!mongoose.Types.ObjectId.isValid(bookingId)) {
    const error = new Error('Invalid booking ID format');
    error.statusCode = 400;
    throw error;
  }

  const booking = await Booking.findById(bookingId);
  if (!booking) {
    const error = new Error('Booking not found');
    error.statusCode = 404;
    throw error;
  }

  if (booking.status !== 'searching') {
    const error = new Error(
      `This booking is no longer awaiting a priest (current status: '${booking.status}').`
    );
    error.statusCode = 409;
    throw error;
  }

  // The claiming priest must exist and be verified
  const priest = await User.findById(priestId);
  if (!priest || priest.userType !== 'priest') {
    const error = new Error('Priest not found');
    error.statusCode = 403;
    throw error;
  }
  const priestProfile = await PriestProfile.findOne({ userId: priestId });
  if (priestProfile && !priestProfile.isVerified) {
    const error = new Error('Only verified priests can accept bookings.');
    error.statusCode = 403;
    throw error;
  }

  // The ceremony must start at least INSTANT_MIN_LEAD_MS from the moment of
  // acceptance so the priest has time to travel and prepare. Start time is
  // derived the same way as createBooking's lead-time check (server-local clock).
  const ceremonyStart = new Date(booking.date);
  const [startH, startM] = (booking.startTime || '').split(':').map(Number);
  if (!Number.isNaN(startH) && !Number.isNaN(startM)) {
    ceremonyStart.setHours(startH, startM, 0, 0);
    if (ceremonyStart.getTime() - Date.now() < INSTANT_MIN_LEAD_MS) {
      const error = new Error(
        'This ceremony starts too soon to accept — instant bookings need at least 2 hours of lead time.'
      );
      error.statusCode = 400;
      throw error;
    }
  }

  // Reject if the instant broadcast has already expired (10-min TTL).
  if (booking.instantExpiresAt && Date.now() > booking.instantExpiresAt.getTime()) {
    await Booking.findByIdAndUpdate(booking._id, {
      $set: {
        status: 'cancelled',
        cancellationReason: 'Instant booking expired — no priest accepted in time',
        cancellationDate: new Date(),
      },
    });
    const error = new Error('This instant booking has expired.');
    error.statusCode = 410;
    throw error;
  }

  // The priest must actually offer this ceremony (when the booking records one).
  if (booking.ceremonyId) {
    const offersCeremony = await PriestProfile.findOne({
      userId: priestId,
      'services.ceremonyId': booking.ceremonyId,
    }).select('_id');
    if (!offersCeremony) {
      const error = new Error('You do not offer this ceremony.');
      error.statusCode = 403;
      throw error;
    }
  }

  // Reject the claim if the priest already has an overlapping active booking
  const bookingDay = new Date(booking.date);
  const startOfDay = new Date(bookingDay);
  startOfDay.setUTCHours(0, 0, 0, 0);
  const endOfDay = new Date(bookingDay);
  endOfDay.setUTCHours(23, 59, 59, 999);

  const sameDayBookings = await Booking.find({
    priestId,
    date: { $gte: startOfDay, $lte: endOfDay },
    status: { $in: ['pending', 'confirmed', 'arrived', 'in_progress'] },
  }).select('startTime endTime');

  const overlaps = sameDayBookings.some((other) =>
    timesOverlap(booking.startTime, booking.endTime, other.startTime, other.endTime)
  );
  if (overlaps) {
    const error = new Error('You already have a booking that overlaps this time.');
    error.statusCode = 409;
    throw error;
  }

  // Atomic first-come claim: only the request that still sees 'searching' wins.
  // The booking moves to 'pending' (priest assigned, awaiting devotee payment) —
  // it is NOT confirmed until the devotee pays. paymentExpiresAt lets the cron
  // release the slot if payment never completes; instantExpiresAt is cleared so
  // the instant-expiry sweep no longer touches it.
  const claimed = await Booking.findOneAndUpdate(
    { _id: bookingId, status: 'searching' },
    {
      $set: {
        priestId,
        status: 'pending',
        instantExpiresAt: null,
        paymentExpiresAt: new Date(Date.now() + PAYMENT_WINDOW_MS),
      },
      $push: {
        statusHistory: {
          status: 'pending',
          timestamp: new Date(),
          updatedBy: priestId,
          reason: 'Instant booking accepted — awaiting devotee payment',
        },
      },
    },
    { new: true }
  );

  if (!claimed) {
    const error = new Error('This booking has just been accepted by another priest.');
    error.statusCode = 409;
    throw error;
  }

  await claimed.populate([
    { path: 'devoteeId', select: 'name phone email' },
    { path: 'priestId', select: 'name phone email' },
  ]);

  // Tell the devotee a priest was found and they must pay to confirm.
  await pushService.notifyDevoteePriestFoundPayNow(claimed.devoteeId._id, claimed);

  return claimed;
};

const cancelBookingByDevotee = async (bookingId, userId, reason) => {
  const cancellationReason = reason || 'Cancelled by devotee';

  // Atomic status change — acts as the concurrency gate.
  // Both devoteeId AND status filter ensure only one request succeeds.
  const updated = await Booking.findOneAndUpdate(
    {
      _id: bookingId,
      devoteeId: userId,
      // 'searching' included so a devotee can abandon an instant request that
      // no priest has accepted yet.
      status: { $in: ['pending', 'confirmed', 'searching'] },
    },
    {
      $set: {
        status: 'cancelled',
        cancellationReason,
        cancellationDate: new Date(),
      },
      $push: {
        statusHistory: {
          status: 'cancelled',
          timestamp: new Date(),
          updatedBy: userId,
          reason: cancellationReason,
        },
      },
    },
    { new: true }
  );

  if (!updated) {
    // Diagnose why the update did not match
    const existing = await Booking.findById(bookingId);
    if (!existing) {
      const error = new Error('Booking not found');
      error.statusCode = 404;
      throw error;
    }
    if (existing.devoteeId.toString() !== userId.toString()) {
      const error = new Error('Not authorized to cancel this booking');
      error.statusCode = 403;
      throw error;
    }
    if (existing.status === 'cancelled') {
      const error = new Error('Booking is already cancelled');
      error.statusCode = 409;
      throw error;
    }
    const error = new Error(`Cannot cancel booking in '${existing.status}' status`);
    error.statusCode = 400;
    throw error;
  }

  // Only ONE request reaches here — safe to attempt refund
  await issueRefundIfPaid(bookingId, updated, cancellationReason);

  // A 'searching' instant booking has no assigned priest yet — nothing to notify.
  if (updated.priestId) {
    await pushService.notifyPriestBookingCancelled(
      updated.priestId._id || updated.priestId,
      updated
    );
  }
  await updateDevoteeReliability(userId, 'cancellation').catch(() => {});

  return updated;
};

const createPaymentOrder = async (bookingId, userId) => {
  const booking = await Booking.findById(bookingId);
  if (!booking) {
    const error = new Error('Booking not found');
    error.statusCode = 404;
    throw error;
  }

  if (booking.devoteeId.toString() !== userId.toString()) {
    const error = new Error('Access denied');
    error.statusCode = 403;
    throw error;
  }

  if (booking.paymentStatus === 'completed') {
    const error = new Error('This booking has already been paid for');
    error.statusCode = 409;
    throw error;
  }

  const rzp = getRazorpayInstance();

  // If an order already exists, validate its state before returning it
  if (booking.paymentDetails?.rzpOrderId) {
    try {
      const existingOrder = await rzp.orders.fetch(booking.paymentDetails.rzpOrderId);

      if (existingOrder.status === 'paid') {
        const err = new Error('This booking has already been paid for');
        err.statusCode = 409;
        throw err;
      }

      if (existingOrder.status === 'created') {
        return existingOrder;
      }

      // Status is 'attempted' or unknown — fall through to create a fresh order
      console.warn(
        `[Payment] Order ${existingOrder.id} status: ${existingOrder.status} — creating new order`
      );
    } catch (fetchErr) {
      if (fetchErr.statusCode === 409) throw fetchErr;
      console.warn(
        '[Payment] Could not fetch existing order — creating new one:',
        fetchErr.message
      );
    }
  }

  const options = {
    amount: booking.totalAmount * 100,
    currency: 'INR',
    receipt: booking.paymentDetails.receiptNumber,
  };

  const order = await rzp.orders.create(options);
  booking.paymentDetails.rzpOrderId = order.id;
  // 30-minute window to complete payment
  booking.paymentExpiresAt = new Date(Date.now() + 30 * 60 * 1000);
  await booking.save();

  return order;
};

const verifyPayment = async (bookingId, paymentData, userId) => {
  if (!process.env.RAZORPAY_KEY_SECRET) {
    throw new Error('Payment verification not configured');
  }

  const { rzpPaymentId, rzpOrderId, rzpSignature } = paymentData;

  const booking = await Booking.findById(bookingId);
  if (!booking) {
    const error = new Error('Booking not found');
    error.statusCode = 404;
    throw error;
  }

  if (booking.devoteeId.toString() !== userId.toString()) {
    throw Object.assign(new Error('Access denied'), { statusCode: 403 });
  }

  // Reject if payment window has expired
  if (
    booking.paymentExpiresAt &&
    new Date() > booking.paymentExpiresAt &&
    booking.paymentStatus !== 'completed'
  ) {
    const error = new Error('Payment session expired. Please initiate a new payment order.');
    error.statusCode = 410;
    throw error;
  }

  // Validate submitted orderId matches what we issued for this booking
  if (booking.paymentDetails?.rzpOrderId && booking.paymentDetails.rzpOrderId !== rzpOrderId) {
    const error = new Error('Order ID mismatch');
    error.statusCode = 400;
    throw error;
  }

  const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET);
  hmac.update(rzpOrderId + '|' + rzpPaymentId);
  const expected = hmac.digest('hex');
  const valid =
    expected.length === rzpSignature.length &&
    crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(rzpSignature));

  if (!valid) {
    const error = new Error('Payment verification failed');
    error.statusCode = 400;
    throw error;
  }

  booking.paymentStatus = 'completed';
  booking.paymentDetails.rzpPaymentId = rzpPaymentId;
  booking.paymentDetails.rzpSignature = rzpSignature;

  // Instant bookings are accept-then-pay: the priest already accepted (status
  // 'pending', awaiting payment), so a successful payment confirms the booking.
  // Scheduled bookings are pay-first and stay 'pending' until the priest accepts.
  if (booking.bookingType === 'instant' && booking.status === 'pending') {
    booking.status = 'confirmed';
    booking.statusHistory.push({
      status: 'confirmed',
      timestamp: new Date(),
      updatedBy: booking.devoteeId,
      reason: 'Payment completed — instant booking confirmed',
    });
  }

  await booking.save();

  return booking;
};

module.exports = {
  getBookings,
  getBookingDetails,
  createBooking,
  createInstantBooking,
  getInstantAvailable,
  updateBookingStatus,
  acceptInstantBooking,
  cancelBookingByDevotee,
  createPaymentOrder,
  verifyPayment,
};
