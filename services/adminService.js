// services/adminService.js
const User = require('../models/user');
const PriestProfile = require('../models/priestProfile');
const Notification = require('../models/notification');
const Banner = require('../models/banner');
const Ceremony = require('../models/ceremony');
const Booking = require('../models/booking');

const getPendingVerifications = async () => {
  return await PriestProfile.find({ verificationStatus: 'pending' }).populate(
    'userId',
    'name email phone profilePicture'
  );
};

const reviewDocument = async (priestId, docType, status) => {
  const profile = await PriestProfile.findOne({ userId: priestId });
  if (!profile) {
    const error = new Error('Profile not found');
    error.statusCode = 404;
    throw error;
  }

  const docIndex = profile.verificationDocuments.findIndex((d) => d.type === docType);
  if (docIndex === -1) {
    const error = new Error('Document not found');
    error.statusCode = 404;
    throw error;
  }

  profile.verificationDocuments[docIndex].status = status;
  await profile.save();
  return true;
};

const updateVerificationStatus = async (priestId, { status, rejectionReason }) => {
  const profile = await PriestProfile.findOne({ userId: priestId });
  if (!profile) {
    const error = new Error('Profile not found');
    error.statusCode = 404;
    throw error;
  }

  profile.verificationStatus = status;
  profile.rejectionReason = status === 'rejected' ? rejectionReason : '';
  profile.isVerified = status === 'approved';

  await User.findByIdAndUpdate(priestId, { isVerified: profile.isVerified });
  await profile.save();

  await Notification.createNotification({
    userId: priestId,
    title: status === 'approved' ? 'Profile Verified! 🎉' : 'Verification Update Required',
    message:
      status === 'approved'
        ? 'Congratulations! Your account is now verified.'
        : `Your verification request was rejected. Reason: ${rejectionReason}.`,
    type: 'general',
    targetRole: 'priest',
    relatedId: priestId,
  });

  return profile;
};

// --- BANNER MANAGEMENT ---

const getAllBanners = async () => {
  return await Banner.find().sort({ order: 1 });
};

const createBanner = async (bannerData) => {
  const banner = new Banner(bannerData);
  return await banner.save();
};

const updateBanner = async (id, bannerData) => {
  return await Banner.findByIdAndUpdate(id, bannerData, { new: true });
};

const deleteBanner = async (id) => {
  return await Banner.findByIdAndDelete(id);
};

// --- CEREMONY MANAGEMENT ---

const getAllCeremonies = async (params = {}) => {
  const filter = {};
  if (params.category) filter.category = params.category;
  if (params.search) {
    filter.name = { $regex: params.search, $options: 'i' };
  }
  return await Ceremony.find(filter).sort({ name: 1 });
};

const createCeremony = async (ceremonyData) => {
  const ceremony = new Ceremony(ceremonyData);
  return await ceremony.save();
};

const updateCeremony = async (id, ceremonyData) => {
  return await Ceremony.findByIdAndUpdate(id, ceremonyData, { new: true });
};

const deleteCeremony = async (id) => {
  // Instead of hard deleting, we toggle isActive to false
  return await Ceremony.findByIdAndUpdate(id, { isActive: false }, { new: true });
};

// Permanently removes a ceremony from the catalog. Blocked if any pujari
// still has it in their services[] — deleting it out from under them would
// leave a dangling ceremonyId reference (breaking their profile display and
// new-booking creation, which looks up the ceremony by this id). Admin should
// deactivate it (or have affected pujaris drop it) first.
const hardDeleteCeremony = async (id) => {
  const ceremony = await Ceremony.findById(id);
  if (!ceremony) {
    const error = new Error('Ceremony not found');
    error.statusCode = 404;
    throw error;
  }

  const priestCount = await PriestProfile.countDocuments({ 'services.ceremonyId': id });
  if (priestCount > 0) {
    const error = new Error(
      `Cannot permanently delete — ${priestCount} pujari${priestCount > 1 ? 's' : ''} still offer this ceremony. Deactivate it instead, or have them remove it from their services first.`
    );
    error.statusCode = 400;
    throw error;
  }

  await Ceremony.findByIdAndDelete(id);
  return ceremony;
};

// --- DEVOTEE MANAGEMENT ---

const getAllDevotees = async () => {
  return await User.find({ userType: 'devotee' }).select('-password').sort({ createdAt: -1 });
};

const toggleUserStatus = async (id, isActive) => {
  return await User.findByIdAndUpdate(id, { isActive }, { new: true }).select('-password');
};

// --- DASHBOARD STATISTICS ---

const getStats = async () => {
  const [
    devoteeCount,
    priestCount,
    pendingVerificationCount,
    bookingCount,
    allBookings
  ] = await Promise.all([
    User.countDocuments({ userType: 'devotee' }),
    User.countDocuments({ userType: 'priest' }),
    PriestProfile.countDocuments({ verificationStatus: 'pending' }),
    Booking.countDocuments(),
    Booking.find({})
      .populate('devoteeId', 'name phone')
      .populate('priestId', 'name')
      .sort({ createdAt: -1 })
      .lean(),
  ]);

  // Calculate platform revenue
  const totalRevenue = allBookings
    .filter(b => b.paymentStatus === 'completed')
    .reduce((sum, b) => sum + (b.totalAmount || 0), 0);

  // Status Breakdown
  const statusBreakdown = {};
  allBookings.forEach(b => {
    statusBreakdown[b.status] = (statusBreakdown[b.status] || 0) + 1;
  });

  // Recent Bookings (top 5)
  const recentBookings = allBookings.slice(0, 5).map(b => ({
    _id: b._id,
    bookingId: b._id.toString().substring(18).toUpperCase(),
    customerName: b.devoteeId?.name || 'Guest User',
    customerMobile: b.devoteeId?.phone || 'N/A',
    puja: { name: b.ceremonyType },
    preferredDate: b.date,
    status: b.status,
  }));

  // Popular Pujas (top 5 by booking count)
  const pujaCounts = {};
  allBookings.forEach(b => {
    pujaCounts[b.ceremonyType] = (pujaCounts[b.ceremonyType] || 0) + 1;
  });
  const popularPujas = Object.entries(pujaCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Monthly trends (Last 6 Months)
  const monthlyTrends = [];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  // Initialize last 6 months
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    monthlyTrends.push({
      month: monthNames[d.getMonth()],
      year: d.getFullYear(),
      bookings: 0,
      revenue: 0,
    });
  }

  allBookings.forEach(b => {
    const bDate = new Date(b.createdAt);
    const bMonthName = monthNames[bDate.getMonth()];
    const bYear = bDate.getFullYear();

    const trend = monthlyTrends.find(t => t.month === bMonthName && t.year === bYear);
    if (trend) {
      trend.bookings += 1;
      if (b.paymentStatus === 'completed') {
        trend.revenue += (b.totalAmount || 0);
      }
    }
  });

  // Active bookings count
  const activeStatuses = ['pending', 'searching', 'requested', 'confirmed', 'arrived', 'in_progress'];
  const activeBookingsCount = allBookings.filter(b => activeStatuses.includes(b.status)).length;

  return {
    stats: {
      devotees: devoteeCount,
      priests: priestCount,
      pendingVerifications: pendingVerificationCount,
      activeBookings: activeBookingsCount,
      totalBookings: bookingCount,
      totalRevenue,
    },
    statusBreakdown,
    recentBookings,
    popularPujas,
    monthlyTrends,
  };
};

// --- BOOKINGS MANAGEMENT ---

const getAllBookings = async (params = {}) => {
  const filter = {};
  if (params.status) filter.status = params.status;
  
  let bookings = await Booking.find(filter)
    .populate('devoteeId', 'name email phone')
    .populate('priestId', 'name')
    .sort({ createdAt: -1 });

  if (params.search) {
    const q = params.search.toLowerCase();
    bookings = bookings.filter(b => 
      (b.devoteeId?.name && b.devoteeId.name.toLowerCase().includes(q)) ||
      (b.devoteeId?.phone && b.devoteeId.phone.includes(q)) ||
      b.ceremonyType.toLowerCase().includes(q) ||
      b._id.toString().includes(q)
    );
  }

  return bookings;
};

const getBookingById = async (id) => {
  return await Booking.findById(id)
    .populate('devoteeId', 'name email phone')
    .populate('priestId', 'name');
};

const updateBookingStatus = async (id, status) => {
  return await Booking.findByIdAndUpdate(
    id, 
    { status, $push: { statusHistory: { status, timestamp: new Date() } } }, 
    { new: true }
  );
};

const assignPujariToBooking = async (bookingId, pujariId) => {
  return await Booking.findByIdAndUpdate(
    bookingId,
    { 
      priestId: pujariId, 
      status: 'confirmed',
      $push: { statusHistory: { status: 'confirmed', timestamp: new Date(), reason: 'Assigned by Admin' } }
    },
    { new: true }
  );
};

const updateBookingItemsStatus = async (id, itemsDeliveryStatus) => {
  return await Booking.findByIdAndUpdate(
    id,
    { itemsDeliveryStatus },
    { new: true }
  );
};

// --- PUJARI MANAGEMENT ---

const getAllPujaris = async (params = {}) => {
  let priests = await User.find({ userType: 'priest' })
    .populate('priestProfile', 'verificationStatus onboardingCompleted')
    .sort({ name: 1 });

  if (params.search) {
    const q = params.search.toLowerCase();
    priests = priests.filter(p => 
      p.name.toLowerCase().includes(q) ||
      (p.phone && p.phone.includes(q)) ||
      (p.email && p.email.toLowerCase().includes(q))
    );
  }

  return priests;
};

const getPujariById = async (id) => {
  return await User.findById(id).populate('priestProfile');
};

const createPujari = async (data) => {
  const user = new User({
    name: data.name,
    phone: data.mobile,
    email: data.email,
    userType: 'priest',
    isActive: true,
    isVerified: true,
    firebaseUid: `fb_admin_created_${Date.now()}`,
  });
  await user.save();

  const profile = new PriestProfile({
    userId: user._id,
    experience: parseInt(data.experience) || 0,
    languagesSpoken: data.languages || [],
    description: data.notes || '',
    serviceAreas: (data.serviceAreas || []).map(city => ({ city, radius: 10, travelCharges: 0 })),
    isVerified: true,
    verificationStatus: 'approved',
  });
  await profile.save();

  return user;
};

const updatePujari = async (id, data) => {
  const user = await User.findByIdAndUpdate(id, {
    name: data.name,
    phone: data.mobile,
    email: data.email,
  }, { new: true });

  await PriestProfile.findOneAndUpdate({ userId: id }, {
    experience: parseInt(data.experience) || 0,
    languagesSpoken: data.languages || [],
    description: data.notes || '',
    serviceAreas: (data.serviceAreas || []).map(city => ({ city, radius: 10, travelCharges: 0 })),
  });

  return user;
};

const deletePujari = async (id) => {
  return await User.findByIdAndUpdate(id, { isActive: false }, { new: true });
};

module.exports = {
  getPendingVerifications,
  reviewDocument,
  updateVerificationStatus,
  getAllBanners,
  createBanner,
  updateBanner,
  deleteBanner,
  getAllCeremonies,
  createCeremony,
  updateCeremony,
  deleteCeremony,
  hardDeleteCeremony,
  getAllDevotees,
  toggleUserStatus,
  getStats,
  getAllBookings,
  getBookingById,
  updateBookingStatus,
  updateBookingItemsStatus,
  assignPujariToBooking,
  getAllPujaris,
  getPujariById,
  createPujari,
  updatePujari,
  deletePujari,
};
