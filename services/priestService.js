// services/priestService.js
const PriestProfile = require('../models/priestProfile');
const Ceremony = require('../models/ceremony');
const Booking = require('../models/booking');
const Transaction = require('../models/transaction');
const Notification = require('../models/notification');
const { getOrCreateWallet } = require('../services/commissionEngine');
const { uploadPublicFile, uploadPrivateFile, deletePrivateFile } = require('./storageService');
const { priestProfilePicKey, priestDocumentKey } = require('../utils/s3Keys');

// Only these fields may be set through the priest's own profile-edit path.
// NEVER allow via this path: isVerified, verificationStatus, ratings, earnings,
// onboardingCompleted, userId — those are controlled server-side / by admins.
// Without this whitelist a priest could self-approve (isVerified: true) or
// inflate their own ratings/earnings by mass-assigning raw request body fields.
const PRIEST_PROFILE_EDITABLE_FIELDS = [
  'description',
  'experience',
  'religiousTraditions',
  'languagesSpoken',
  'services',
  'availability',
  'location',
  'templesAffiliated',
  'profilePicture',
];

// Ensures every service references an active catalog ceremony and is priced
// at or above the base price the admin configured for that ceremony — a
// priest may charge more than the base price, never less.
const validateServicePricing = async (services) => {
  if (!services || services.length === 0) return;

  const ceremonyIds = services.map((s) => s.ceremonyId).filter(Boolean);
  const ceremonies = await Ceremony.find({ _id: { $in: ceremonyIds }, isActive: true })
    .select('name pricing.basePrice')
    .lean();
  const ceremonyMap = new Map(ceremonies.map((c) => [c._id.toString(), c]));

  for (const service of services) {
    const ceremony = ceremonyMap.get(String(service.ceremonyId));
    if (!ceremony) {
      const error = new Error('One or more selected ceremonies are no longer available');
      error.statusCode = 400;
      throw error;
    }
    if (service.price < ceremony.pricing.basePrice) {
      const error = new Error(
        `Price for "${ceremony.name}" must be at least ₹${ceremony.pricing.basePrice.toLocaleString('en-IN')} (base price set by admin)`
      );
      error.statusCode = 400;
      throw error;
    }
  }
};

const updateProfile = async (userId, updateData) => {
  const safeUpdate = {};
  for (const key of PRIEST_PROFILE_EDITABLE_FIELDS) {
    if (updateData[key] !== undefined) safeUpdate[key] = updateData[key];
  }

  if (safeUpdate.services) {
    await validateServicePricing(safeUpdate.services);
  }

  let profile = await PriestProfile.findOne({ userId });

  if (profile) {
    profile = await PriestProfile.findOneAndUpdate({ userId }, safeUpdate, {
      new: true,
    });
  } else {
    profile = new PriestProfile({
      userId,
      ...safeUpdate,
    });
    await profile.save();
  }

  return profile;
};

const getProfile = async (userId) => {
  let profile = await PriestProfile.findOne({ userId })
    .populate('userId')
    .populate('services.ceremonyId', 'name duration images description requirements')
    .lean();

  if (!profile) {
    const newProfile = new PriestProfile({
      userId,
      experience: 0,
      services: [],
      location: { type: 'Point', coordinates: [0, 0] },
      verificationDocuments: [],
      templesAffiliated: [],
    });
    await newProfile.save();
    profile = await PriestProfile.findOne({ userId })
      .populate('userId')
      .populate('services.ceremonyId', 'name duration images description requirements')
      .lean();
  }

  return profile;
};

const toggleStatus = async (userId, { status, autoToggle }) => {
  const setPayload = { 'currentAvailability.lastUpdated': new Date() };

  if (status) {
    setPayload['currentAvailability.status'] = status;
  }

  if (typeof autoToggle === 'boolean') {
    setPayload['currentAvailability.autoToggle'] = autoToggle;
  }

  const profile = await PriestProfile.findOneAndUpdate(
    { userId },
    { $set: setPayload },
    { new: true }
  );

  if (!profile) {
    const error = new Error('Profile not found');
    error.statusCode = 404;
    throw error;
  }

  return profile.currentAvailability;
};

const getBookings = async (userId, { status }) => {
  const query = { priestId: userId };
  const now = new Date();

  if (status && ['confirmed', 'pending', 'cancelled', 'completed'].includes(status)) {
    query.status = status;
  }

  let bookings = await Booking.find(query)
    .select('ceremonyType date startTime endTime basePrice location devoteeId createdAt status')
    .populate('devoteeId', 'name profilePicture createdAt')
    .sort({ date: 1 })
    .lean();

  if (status === 'upcoming') {
    bookings = bookings.filter(
      (b) => b.status !== 'completed' && b.status !== 'cancelled' && new Date(b.date) >= now
    );
  } else if (status === 'today') {
    const todayString = now.toDateString();
    bookings = bookings.filter((b) => new Date(b.date).toDateString() === todayString);
  }

  return bookings;
};

const getEarnings = async (userId) => {
  const wallet = await getOrCreateWallet(userId);
  const now = new Date();
  const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

  const thisMonthTxns = await Transaction.find({
    priestId: userId,
    type: 'credit_for_booking',
    status: 'completed',
    createdAt: { $gte: currentMonth },
  })
    .select('amount')
    .lean();
  const thisMonthEarnings = thisMonthTxns.reduce((sum, tx) => sum + tx.amount, 0);

  const lastMonthTxns = await Transaction.find({
    priestId: userId,
    type: 'credit_for_booking',
    status: 'completed',
    createdAt: { $gte: lastMonth, $lte: lastMonthEnd },
  })
    .select('amount')
    .lean();
  const lastMonthEarnings = lastMonthTxns.reduce((sum, tx) => sum + tx.amount, 0);

  const growthPercentage =
    lastMonthEarnings > 0
      ? ((thisMonthEarnings - lastMonthEarnings) / lastMonthEarnings) * 100
      : thisMonthEarnings > 0
        ? 100
        : 0;

  const pujasCompleted = await Booking.countDocuments({
    priestId: userId,
    status: 'completed',
    completionDate: { $gte: currentMonth },
  });

  const transactions = await Transaction.find({ priestId: userId })
    .select('amount type direction status description bookingId createdAt')
    .sort({ createdAt: -1 })
    .limit(10)
    .populate({
      path: 'bookingId',
      select: 'ceremonyType date devoteeId',
      populate: {
        path: 'devoteeId',
        select: 'name profilePicture',
      },
    })
    .lean();

  return {
    thisMonth: thisMonthEarnings,
    lastMonth: lastMonthEarnings,
    growthPercentage: Math.round(growthPercentage * 100) / 100,
    availableBalance: wallet.currentBalance,
    totalCredited: wallet.totalCredited,
    totalDebited: wallet.totalDebited,
    transactions: transactions.map((tx) => ({
      id: tx._id,
      amount: tx.amount,
      type: tx.type,
      direction: tx.direction,
      date: tx.createdAt,
      description: tx.description,
      status: tx.status,
      booking: tx.bookingId,
    })),
    totalBookings: pujasCompleted,
    pujasCompleted,
    walletStatus: wallet.status,
  };
};

// Paginated transaction history. Distinct from getEarnings (which returns a
// fixed 10-item preview alongside the wallet summary) — this powers the
// "load more" transactions list and returns pagination metadata.
const getTransactions = async (userId, { page = 1, limit = 20 } = {}) => {
  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const limitNum = Math.max(parseInt(limit, 10) || 20, 1);
  const skip = (pageNum - 1) * limitNum;

  const [transactions, total] = await Promise.all([
    Transaction.find({ priestId: userId })
      .select('amount type direction status description bookingId createdAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate({
        path: 'bookingId',
        select: 'ceremonyType date devoteeId',
        populate: {
          path: 'devoteeId',
          select: 'name profilePicture',
        },
      })
      .lean(),
    Transaction.countDocuments({ priestId: userId }),
  ]);

  return {
    data: transactions.map((tx) => ({
      id: tx._id,
      amount: tx.amount,
      type: tx.type,
      direction: tx.direction,
      date: tx.createdAt,
      description: tx.description,
      status: tx.status,
      booking: tx.bookingId,
    })),
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      hasMore: skip + transactions.length < total,
    },
  };
};

const getNotifications = async (userId, { limit = 50, unreadOnly = false }) => {
  const query = { userId, targetRole: 'priest' };
  if (unreadOnly === 'true') query.read = false;

  return await Notification.find(query).sort({ createdAt: -1 }).limit(parseInt(limit)).lean();
};

const markNotificationAsRead = async (userId, notificationId) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: notificationId, userId, targetRole: 'priest' },
    { read: true, updatedAt: new Date() },
    { new: true }
  );

  if (!notification) {
    const error = new Error('Notification not found');
    error.statusCode = 404;
    throw error;
  }

  return notification;
};

const uploadDocument = async (userId, file, documentType) => {
  let profile = await PriestProfile.findOne({ userId });
  if (!profile) {
    profile = new PriestProfile({
      userId,
      experience: 0,
      services: [],
      location: { type: 'Point', coordinates: [0, 0] },
      verificationDocuments: [],
      templesAffiliated: [],
    });
  }

  if (documentType === 'profile_picture') {
    // Public bucket — URL served directly, no presigning needed
    const key = priestProfilePicKey(userId.toString());
    const url = await uploadPublicFile(file.buffer, key, file.mimetype);
    profile.profilePicture = url;
  } else {
    // Private bucket — store S3 key, presign at read time
    const key = priestDocumentKey(userId.toString(), documentType, file.mimetype);

    // Delete previous version from S3 if one exists
    const existing = profile.verificationDocuments.find((d) => d.type === documentType);
    if (existing?.url) await deletePrivateFile(existing.url).catch(() => {});

    const s3Key = await uploadPrivateFile(file.buffer, key, file.mimetype);

    const newDoc = {
      type: documentType,
      url: s3Key,
      fileName: file.originalname,
      status: 'pending',
      uploadDate: new Date(),
    };

    const idx = profile.verificationDocuments.findIndex((d) => d.type === documentType);
    if (idx !== -1) profile.verificationDocuments[idx] = newDoc;
    else profile.verificationDocuments.push(newDoc);
  }

  await profile.save();
  return { success: true, message: 'Document uploaded successfully' };
};

const getProfileCompletion = async (userId) => {
  const profile = await getProfile(userId);
  const user = profile.userId;

  const fields = [
    // email is optional (phone/OTP signups have no email), so accept either contact method
    { name: 'basicInfo', check: () => user && user.name && (user.email || user.phone) },
    {
      name: 'languages',
      check: () => user && user.languagesSpoken && user.languagesSpoken.length > 0,
    },
    { name: 'description', check: () => profile.description && profile.description.length > 0 },
    {
      name: 'experience',
      check: () => profile.experience !== undefined && profile.experience !== null,
    },
    {
      name: 'profilePicture',
      check: () => profile.profilePicture && profile.profilePicture.length > 0,
    },
    { name: 'services', check: () => profile.services && profile.services.length > 0 },
    {
      name: 'location',
      check: () =>
        profile.location &&
        profile.location.coordinates &&
        (profile.location.coordinates[0] !== 0 || profile.location.coordinates[1] !== 0),
    },
    {
      name: 'documents',
      check: () => profile.verificationDocuments && profile.verificationDocuments.length > 0,
    },
  ];

  const completedFields = [];
  const missingFields = [];

  fields.forEach((field) => {
    if (field.check()) {
      completedFields.push(field.name);
    } else {
      missingFields.push(field.name);
    }
  });

  const totalFields = fields.length;
  const completedCount = completedFields.length;
  const completionPercentage = Math.round((completedCount / totalFields) * 100);

  return {
    completionPercentage,
    completedFields,
    missingFields,
    isVerified: profile.isVerified || false,
    canAcceptRequests:
      (profile.isVerified || false) && profile.services && profile.services.length > 0,
  };
};

module.exports = {
  updateProfile,
  getProfile,
  toggleStatus,
  getBookings,
  getEarnings,
  getTransactions,
  getNotifications,
  markNotificationAsRead,
  uploadDocument,
  getProfileCompletion,
};
