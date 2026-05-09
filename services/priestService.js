// services/priestService.js
const PriestProfile = require('../models/priestProfile');
const User = require('../models/user');
const Booking = require('../models/booking');
const Transaction = require('../models/transaction');
const Notification = require('../models/notification');
const Review = require('../models/review');
const { getOrCreateWallet } = require('../services/commissionEngine');

const updateProfile = async (userId, updateData) => {
  let profile = await PriestProfile.findOne({ userId });

  if (profile) {
    profile = await PriestProfile.findOneAndUpdate({ userId }, updateData, {
      new: true,
    });
  } else {
    profile = new PriestProfile({
      userId,
      ...updateData,
    });
    await profile.save();
    await User.findByIdAndUpdate(userId, { profileCompleted: true });
  }

  return profile;
};

const getProfile = async (userId) => {
  let profile = await PriestProfile.findOne({ userId })
    .populate({
      path: 'userId',
      populate: { path: 'languagesSpoken' },
    })
    .populate('services.ceremonyId', 'name duration images description requirements');

  if (!profile) {
    profile = new PriestProfile({
      userId,
      experience: 0,
      services: [],
      location: { type: 'Point', coordinates: [0, 0] },
      verificationDocuments: [],
      templesAffiliated: [],
    });
    await profile.save();
    profile = await PriestProfile.findOne({ userId })
      .populate({
        path: 'userId',
        populate: { path: 'languagesSpoken' },
      })
      .populate('services.ceremonyId', 'name duration images description requirements');
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
    .populate('devoteeId', 'name email phone')
    .sort({ date: 1 });

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
  });
  const thisMonthEarnings = thisMonthTxns.reduce((sum, tx) => sum + tx.amount, 0);

  const lastMonthTxns = await Transaction.find({
    priestId: userId,
    type: 'credit_for_booking',
    status: 'completed',
    createdAt: { $gte: lastMonth, $lte: lastMonthEnd },
  });
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
    .sort({ createdAt: -1 })
    .limit(10)
    .populate('bookingId', 'ceremonyType date devoteeId');

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

const getNotifications = async (userId, { limit = 50, unreadOnly = false }) => {
  const query = { userId, targetRole: 'priest' };
  if (unreadOnly === 'true') query.read = false;

  return await Notification.find(query).sort({ createdAt: -1 }).limit(parseInt(limit));
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
  const profile = await PriestProfile.findOne({ userId });
  if (!profile) {
    const error = new Error('Profile not found');
    error.statusCode = 404;
    throw error;
  }

  if (documentType === 'profile_picture') {
    const b64 = file.buffer.toString('base64');
    profile.profilePicture = `data:${file.mimetype};base64,${b64}`;
  } else {
    const newDoc = {
      type: documentType,
      data: file.buffer,
      contentType: file.mimetype,
      fileName: file.originalname,
      status: 'pending',
    };
    const idx = profile.verificationDocuments.findIndex((d) => d.type === documentType);
    if (idx !== -1) profile.verificationDocuments[idx] = newDoc;
    else profile.verificationDocuments.push(newDoc);
  }

  await profile.save();
  return { message: 'Document uploaded successfully' };
};

const getProfileCompletion = async (userId) => {
  const profile = await getProfile(userId);
  const user = profile.userId;

  const fields = [
    { name: 'basicInfo', check: () => user && user.name && user.email },
    { name: 'languages', check: () => user && user.languagesSpoken && user.languagesSpoken.length > 0 },
    { name: 'description', check: () => profile.description && profile.description.length > 0 },
    { name: 'experience', check: () => profile.experience !== undefined && profile.experience !== null },
    { name: 'profilePicture', check: () => profile.profilePicture && profile.profilePicture.length > 0 },
    { name: 'services', check: () => profile.services && profile.services.length > 0 },
    { name: 'location', check: () => profile.location && profile.location.coordinates && (profile.location.coordinates[0] !== 0 || profile.location.coordinates[1] !== 0) },
    { name: 'documents', check: () => profile.verificationDocuments && profile.verificationDocuments.length > 0 },
  ];

  const completedFields = [];
  const missingFields = [];

  fields.forEach(field => {
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
    canAcceptRequests: (profile.isVerified || false) && profile.services && profile.services.length > 0
  };
};

module.exports = {
  updateProfile,
  getProfile,
  toggleStatus,
  getBookings,
  getEarnings,
  getNotifications,
  markNotificationAsRead,
  uploadDocument,
  getProfileCompletion,
};
