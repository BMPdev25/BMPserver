// controllers/priestController.js
const priestService = require('../services/priestService');
const bookingService = require('../services/bookingService');
const walletController = require('./walletController');
const PriestProfile = require('../models/priestProfile');
const User = require('../models/user');
const Notification = require('../models/notification');
const { getPresignedUrl } = require('../services/storageService');

// Create or update priest profile
exports.updateProfile = async (req, res, next) => {
  try {
    const profile = await priestService.updateProfile(req.user.id, req.body);

    // Keep User document in sync for fields that live on both models
    const userUpdates = {};
    if (req.body.name && req.body.name.trim() !== '') {
      userUpdates.name = req.body.name.trim();
    }
    if (Array.isArray(req.body.languagesSpoken)) {
      userUpdates.languagesSpoken = req.body.languagesSpoken;
    }
    if (Object.keys(userUpdates).length > 0) {
      await User.findByIdAndUpdate(req.user.id, userUpdates);
    }

    res.status(200).json(profile);
  } catch (error) {
    next(error);
  }
};

// Toggle priest status
exports.toggleStatus = async (req, res, next) => {
  try {
    const { status, autoToggle } = req.body;
    const currentAvailability = await priestService.toggleStatus(req.user.id, {
      status,
      autoToggle,
    });
    res.status(200).json({ success: true, data: { currentAvailability } });
  } catch (error) {
    next(error);
  }
};

// Get priest profile
exports.getProfile = async (req, res, next) => {
  try {
    const profile = await priestService.getProfile(req.user.id);
    res.status(200).json(profile);
  } catch (error) {
    next(error);
  }
};

exports.getProfileCompletion = async (req, res, next) => {
  try {
    const completionData = await priestService.getProfileCompletion(req.user.id);
    res.status(200).json(completionData);
  } catch (error) {
    next(error);
  }
};

// Get priest's bookings
exports.getBookings = async (req, res, next) => {
  try {
    const result = await bookingService.getBookings(req.user.id, 'priest', {
      category: req.query.category,
      status: req.query.status,
      page: req.query.page,
      limit: req.query.limit,
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

// Get priest's earnings
exports.getEarnings = async (req, res, next) => {
  try {
    const result = await priestService.getEarnings(req.user.id);
    const priestProfile = await PriestProfile.findOne(
      { userId: req.user.id },
      'ratings ceremonyCount'
    );
    res.status(200).json({
      success: true,
      data: {
        wallet: {
          currentBalance: result.availableBalance ?? 0,
        },
        earnings: {
          thisMonth: result.thisMonth ?? 0,
          totalEarnings: result.totalCredited ?? 0,
          pendingPayments: result.availableBalance ?? 0,
        },
        ceremonyCount: result.pujasCompleted ?? result.totalBookings ?? 0,
        ratings: {
          average: priestProfile?.ratings?.average ?? 0,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// Request withdrawal — delegates to the real wallet payout implementation so
// /api/priest/earnings/withdraw and /api/wallet/withdraw share one code path
// (balance checks, pending transaction, bank transfer, refund-on-failure).
exports.requestWithdrawal = (req, res, next) => walletController.requestWithdrawal(req, res, next);

// Get transactions history
exports.getTransactions = async (req, res, next) => {
  try {
    const { type, limit } = req.query;
    const { transactions } = await priestService.getEarnings(req.user.id);
    res.status(200).json(transactions);
  } catch (error) {
    next(error);
  }
};

// Get priest's notifications
exports.getNotifications = async (req, res, next) => {
  try {
    const notifications = await priestService.getNotifications(req.user.id, req.query);
    res.status(200).json(notifications);
  } catch (error) {
    next(error);
  }
};

// Mark notification as read
exports.markNotificationAsRead = async (req, res, next) => {
  try {
    const notification = await priestService.markNotificationAsRead(
      req.user.id,
      req.params.notificationId
    );
    res.status(200).json({ message: 'Notification marked as read', notification });
  } catch (error) {
    next(error);
  }
};

// Mark all notifications as read
exports.markAllNotificationsAsRead = async (req, res, next) => {
  try {
    await Notification.updateMany(
      { userId: req.user.id, read: false, targetRole: 'priest' },
      { read: true, updatedAt: new Date() }
    );
    res.status(200).json({ message: 'All notifications marked as read' });
  } catch (error) {
    next(error);
  }
};

// Update booking status
exports.updateBookingStatus = async (req, res, next) => {
  try {
    const { bookingId } = req.params;
    const { status, reason } = req.body;
    const booking = await bookingService.updateBookingStatus(bookingId, req.user.id, {
      status,
      reason,
    });
    res.status(200).json({
      success: true,
      message: `Booking ${status} successfully`,
      booking: booking,
    });
  } catch (error) {
    next(error);
  }
};

// Get available pujaris
exports.getAvailablePujaris = async (req, res, next) => {
  try {
    const {
      ceremonyId,
      lat,
      lng,
      radius = 50,
      page = 1,
      limit = 10,
      sort = 'rating',
      minRating,
      minPrice,
      maxPrice,
      languages,
      city,
    } = req.query;

    // Build geo filter (optional)
    const hasLocation = lat && lng;
    let geoFilter = {};
    if (hasLocation) {
      const radiusMetres = parseFloat(radius) * 1000;
      geoFilter = {
        location: {
          $geoWithin: {
            $centerSphere: [
              [parseFloat(lng), parseFloat(lat)],
              radiusMetres / 6378100, // metres → radians
            ],
          },
        },
      };
    }

    // Build base filter
    const filter = {
      ...geoFilter,
      isVerified: true,
    };

    // Optional availability status filter (e.g. ?availability=available)
    if (req.query.availability) {
      filter['currentAvailability.status'] = req.query.availability;
    }

    // Ceremony filter (optional now)
    if (ceremonyId) {
      filter['services.ceremonyId'] = ceremonyId;
    }

    // Rating filter
    if (minRating) {
      filter['ratings.average'] = { $gte: parseFloat(minRating) };
    }

    // Language filter
    if (languages) {
      const langArray = Array.isArray(languages) ? languages : [languages];
      filter['languagesSpoken'] = { $in: langArray };
    }

    // City/town filter
    if (city) {
      filter['address.town'] = new RegExp(city.trim(), 'i');
    }

    // Price filter (on services array)
    if (minPrice || maxPrice) {
      const priceFilter = {};
      if (minPrice) priceFilter.$gte = parseFloat(minPrice);
      if (maxPrice) priceFilter.$lte = parseFloat(maxPrice);
      filter['services.price'] = priceFilter;
    }

    // Sort mapping ($geoWithin does not produce distance metadata, so distance sort is unavailable)
    const sortMap = {
      rating:     { 'ratings.average': -1 },
      experience: { experience: -1 },
      newest:     { createdAt: -1 },
      price_asc:  { 'services.price': 1 },
      price_desc: { 'services.price': -1 },
    };
    const sortQuery = sortMap[sort] || sortMap.rating;

    // Pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const [pujarisDocs, total] = await Promise.all([
      PriestProfile.find(filter)
        .sort(sortQuery)
        .skip(skip)
        .limit(limitNum)
        .select('userId services ratings currentAvailability location experience religiousTradition specializations verificationStatus profilePicture')
        .populate('userId', 'name profilePicture languagesSpoken')
        .populate('services.ceremonyId', 'name category duration')
        .lean(),
      PriestProfile.countDocuments(filter),
    ]);

    const pujaris = pujarisDocs.map((p) => ({
      _id: p._id,
      userId: p.userId?._id,
      name: p.userId?.name || 'Unknown Priest',
      profilePicture: p.profilePicture || p.userId?.profilePicture?.url,
      primarySpecialization: p.specializations?.[0]?.name || '',
      rating: p.ratings?.average || 0,
      reviewCount: p.ratings?.count || 0,
      startingPrice: p.services?.length
        ? Math.min(...p.services.map((s) => s.price))
        : 0,
      experienceYears: p.experience || 0,
      services: p.services || [],
      verificationStatus: p.verificationStatus,
    }));

    res.status(200).json({
      success: true,
      data: {
        pujaris,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          hasMore: pageNum * limitNum < total,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get pending actions
exports.getPendingActions = async (req, res, next) => {
  try {
    // Basic logic moved to service or kept for multi-collection join
    const priestId = req.user.id;
    const now = new Date();
    const dueBookings = await bookingService.getBookings(priestId, 'priest', {
      status: 'confirmed',
    });

    const actions = dueBookings.data.all
      .filter((b) => new Date(b.date) < now)
      .map((b) => ({
        ...b,
        actionType: 'mark_complete',
        title: 'Mark as Complete',
        description: `Ceremony with ${b.devoteeId?.name} is past due.`,
      }));

    res.status(200).json(actions);
  } catch (error) {
    next(error);
  }
};

// Upload document
const ALLOWED_DOCUMENT_TYPES = ['profile_picture', 'government_id', 'religious_certificate', 'other'];

exports.uploadDocument = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    const { documentType } = req.body;
    if (!documentType || !ALLOWED_DOCUMENT_TYPES.includes(documentType)) {
      return res.status(400).json({
        message: `Invalid documentType. Must be one of: ${ALLOWED_DOCUMENT_TYPES.join(', ')}`,
      });
    }
    const result = await priestService.uploadDocument(req.user.id, req.file, documentType);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

// Submit verification
exports.submitVerification = async (req, res, next) => {
  try {
    const profile = await PriestProfile.findOne({ userId: req.user.id });
    if (!profile) {
      return res.status(404).json({ success: false, message: 'Priest profile not found' });
    }

    if (!profile.services || profile.services.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'You must add at least one service before submitting for verification.',
      });
    }

    const hasGovernmentId = (profile.verificationDocuments || []).some(
      (d) => d.type === 'government_id' && d.url
    );
    if (!hasGovernmentId) {
      return res.status(400).json({
        success: false,
        message: 'You must upload a government ID document before submitting for verification.',
      });
    }

    profile.verificationStatus = 'pending';
    profile.onboardingCompleted = true;
    // isVerified stays false until admin approves; pre-save hook keeps it in sync
    await profile.save();

    res.status(200).json({
      success: true,
      message: 'Verification profile submitted for review.',
    });
  } catch (error) {
    next(error);
  }
};

// Get document — returns a short-lived presigned URL (never exposes the raw S3 key)
exports.getDocument = async (req, res, next) => {
  try {
    const profile = await PriestProfile.findOne({ userId: req.user.id });
    const doc = profile?.verificationDocuments.find(
      (d) => d.type === req.params.documentType
    );
    if (!doc?.url) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }
    const presignedUrl = await getPresignedUrl(doc.url, 3600);
    res.status(200).json({ success: true, data: { url: presignedUrl } });
  } catch (error) {
    next(error);
  }
};

// Accept an instant booking (priest claims a 'searching' broadcast request)
exports.acceptInstantBooking = async (req, res, next) => {
  try {
    const { bookingId } = req.body;
    if (!bookingId) {
      return res.status(400).json({ success: false, message: 'Valid booking ID is required' });
    }

    const booking = await bookingService.acceptInstantBooking(bookingId, req.user.id);
    res.status(200).json({ message: 'Instant booking accepted', booking });
  } catch (error) {
    next(error);
  }
};

exports.getPublicProfile = async (req, res, next) => {
  try {
    const { priestProfileId } = req.params;
    
    const profile = await PriestProfile.findById(priestProfileId)
      .select('userId services ratings experience description religiousTradition availability location currentAvailability isVerified verificationStatus specializations serviceRadiusKm ceremonyCount profilePicture')
      .populate('userId', 'name profilePicture languagesSpoken')
      .populate('services.ceremonyId', 'name description')
      .lean();
    
    if (!profile || !profile.isVerified) {
      return res.status(404).json({ 
        success: false, 
        message: 'Pandit profile not found' 
      });
    }

    // Strip sensitive fields
    const publicProfile = {
      _id: profile._id,
      userId: profile.userId?._id,
      name: profile.userId?.name,
      profilePicture: profile.profilePicture,
      experience: profile.experience,
      religiousTradition: profile.religiousTradition,
      description: profile.description,
      services: profile.services,
      languages: profile.userId?.languagesSpoken || [],
      ratings: profile.ratings,
      specializations: profile.specializations,
      serviceRadiusKm: profile.serviceRadiusKm,
      ceremonyCount: profile.ceremonyCount,
      currentAvailability: {
        status: profile.currentAvailability?.status,
      },
      availability: {
        weeklySchedule: profile.availability?.weeklySchedule,
      },
      verificationStatus: profile.verificationStatus,
      isVerified: profile.isVerified,
    };

    res.status(200).json({ success: true, data: publicProfile });
  } catch (error) {
    next(error);
  }
};

exports.getPublicReviews = async (req, res, next) => {
  try {
    const { priestProfileId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);
    const Rating = require('../models/rating');

    // Step 1: resolve PriestProfile → User._id
    const profile = await PriestProfile
      .findById(priestProfileId)
      .select('userId')
      .lean();

    if (!profile) {
      return res.status(404).json({ 
        success: false, message: 'Profile not found' 
      });
    }

    // Step 2: query Rating using User._id
    const [reviews, total] = await Promise.all([
      Rating.find({ priestId: profile.userId })
        .populate('userId', 'name profilePicture') // devotee info
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Rating.countDocuments({ priestId: profile.userId }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        reviews,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          hasMore: parseInt(page) * parseInt(limit) < total,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};