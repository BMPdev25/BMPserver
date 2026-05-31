// controllers/devoteeController.js
const devoteeService = require('../services/devoteeService');
const bookingService = require('../services/bookingService');
const User = require('../models/user');
const Booking = require('../models/booking');
const Notification = require('../models/notification');
const Review = require('../models/review');

// Get all priests (for debugging)
exports.getAllPriests = async (req, res, next) => {
  try {
    const allPriests = await devoteeService.getAllPriests();
    res.status(200).json({
      total: allPriests.length,
      priests: allPriests.map((priest) => ({
        _id: priest._id,
        name: priest.userId?.name || 'No name',
        email: priest.userId?.email || '',
        phone: priest.userId?.phone || '',
        experience: priest.experience,
        religiousTradition: priest.religiousTradition,
        isVerified: priest.isVerified,
        hasUserId: !!priest.userId,
        location: priest.userId?.location,
        profilePicture: priest.profilePicture,
        ratings: {
          average: priest.ratings?.average ?? 0,
          count: priest.ratings?.count ?? 0,
        },
        languages: priest.userId?.languagesSpoken?.map((l) => l.name) || [],
      })),
    });
  } catch (error) {
    next(error);
  }
};

// Search for priests
exports.searchPriests = async (req, res, next) => {
  try {
    const { ceremony, city, date, religion, minRating, page = 1, limit = 10 } = req.query;

    // Build query filter
    const filter = {};
    const preQueries = [];

    // 1. Ceremony Lookup
    if (ceremony) {
      preQueries.push(
        Ceremony.findOne({ name: new RegExp(ceremony, 'i'), isActive: true })
          .select('_id').lean()
          .then(doc => {
            if (doc) filter['services.ceremonyId'] = doc._id;
            return !!doc;
          })
      );
    }

    // 2. City Lookup
    if (city) {
      preQueries.push(
        User.find({ 'location.city': new RegExp(city, 'i') })
          .select('_id').lean()
          .then(users => {
            if (users.length > 0) filter.userId = { $in: users.map(u => u._id) };
            return users.length > 0;
          })
      );
    }

    // 3. Search Term Lookup (Name)
    if (req.query.search) {
      preQueries.push(
        User.find({ name: new RegExp(req.query.search, "i") })
          .select('_id').lean()
          .then(users => {
            const userIds = users.map(u => u._id);
            const searchRegex = new RegExp(req.query.search, "i");
            filter.$or = [
              { userId: { $in: userIds } },
              { description: searchRegex }
            ];
            return true;
          })
      );
    }

    // Execute pre-queries in parallel
    const results = await Promise.all(preQueries);
    
    // If a ceremony was requested but not found, return empty results immediately
    if (ceremony && results[0] === false) {
      return res.status(200).json({
        priests: [],
        currentPage: parseInt(page),
        totalPages: 0,
        totalPriests: 0,
      });
    }

    // Filter by religious tradition
    if (religion) {
      filter.religiousTradition = new RegExp(religion, 'i');
    }

    // Filter by minimum rating
    if (minRating) {
      filter['ratings.average'] = { $gte: parseFloat(minRating) };
    }

    // REMOVED: Strict 'available' filter. We want to show offline priests too for future bookings.
    // Instead, we can sort by availability or show status in UI.

    // Add verification criteria (Approved or Pending)
    // We combine this with existing $or if it exists, or create a new one
    const verificationCriteria = {
      $or: [
        { verificationStatus: { $in: ['approved', 'pending'] } },
        { isVerified: true }
      ]
    };

    // If we already have an $or (from search term), we need to wrap everything in an $and
    // to ensure both the search match AND the verification criteria are met.
    let finalFilter = filter;
    if (filter.$or) {
      finalFilter = {
        $and: [
          filter,
          verificationCriteria
        ]
      };
    } else {
      Object.assign(finalFilter, verificationCriteria);
    }

    // Get priest profiles with user details
    const priests = await PriestProfile.find(finalFilter)
      .populate({
        path: "userId",
        select: "name email phone location languagesSpoken",
        populate: { path: "languagesSpoken", select: "name" }
      })
      .populate("services.ceremonyId", "name")
      .select("userId experience religiousTradition profilePicture ratings ceremonyCount priceList isVerified verificationStatus currentAvailability services analytics.completionRate")
      .sort({ "ratings.average": -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean()
      .exec();

    const verifiedPriests = priests; 

    // Format response
    const formattedPriests = verifiedPriests.map((priest) => ({
      _id: priest._id,
      name: priest.userId?.name || 'Unknown Name',
      email: priest.userId?.email || '',
      phone: priest.userId?.phone || '',
      experience: priest.experience,
      religiousTradition: priest.religiousTradition,
      profilePicture: priest.profilePicture,
      rating: priest.ratings,
      ceremonyCount: priest.ceremonyCount || 0,
      location: priest.userId?.location,
      priceList: priest.priceList,
      isVerified: priest.isVerified,
      languages: priest.userId?.languagesSpoken?.map((l) => l.name || l) || [],
      services:
        priest.services?.map((s) => ({
          name: s.ceremonyId?.name || 'Unknown',
          price: s.price,
          duration: s.durationMinutes,
          ritualSteps: s.ceremonyId?.ritualSteps || [],
        })) || [],
      completionRate: priest.analytics?.completionRate ?? 100,
    }));

    res.status(200).json({
      priests: formattedPriests,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalPriests: total,
    });
  } catch (error) {
    next(error);
  }
};

// Get priest details
exports.getPriestDetails = async (req, res, next) => {
  try {
    const priest = await devoteeService.getPriestDetails(req.params.priestId);

    const mappedCeremonies =
      priest.services?.map((service) => ({
        id: service.ceremonyId?._id,
        name: service.ceremonyId?.name || 'Unknown Ceremony',
        price: service.price,
        duration: service.durationMinutes,
        ritualSteps: service.ceremonyId?.ritualSteps || [],
      })) || [];

    const priestData = {
      _id: priest._id,
      name: priest.userId?.name || 'Unknown Priest',
      experience: priest.experience,
      religiousTradition: priest.religiousTradition,
      ceremonies: mappedCeremonies,
      description: priest.description || '',
      profilePicture: priest.profilePicture || '',
      rating: priest.ratings || { average: 4.5, count: 50 },
      availability: priest.currentAvailability?.status || 'available',
      languages: priest.userId?.languagesSpoken?.map((l) => l.name) || [],
      certifications: priest.specializations?.map((s) => s.certification).filter(Boolean) || [],
      ceremonyCount: priest.ceremonyCount || 0,
      completionRate: priest.analytics?.completionRate ?? 100,
    };

    res.status(200).json(priestData);
  } catch (error) {
    next(error);
  }
};

// Get devotee's bookings
exports.getBookings = async (req, res, next) => {
  try {
    const { data } = await bookingService.getBookings(req.user.id, 'devotee', req.query);
    res.status(200).json(data.all || []);
  } catch (error) {
    next(error);
  }
};

// Create a booking
exports.createBooking = async (req, res, next) => {
  try {
    const booking = await bookingService.createBooking(req.user.id, req.body);
    res.status(201).json(booking);
  } catch (error) {
    next(error);
  }
};

// Update devotee profile
exports.updateProfile = async (req, res, next) => {
  try {
    const user = await devoteeService.updateProfile(req.user.id, req.body);
    res.status(200).json(user);
  } catch (error) {
    next(error);
  }
};

// Get devotee's notifications
exports.getNotifications = async (req, res, next) => {
  try {
    const notifications = await Notification.find({ userId: req.user.id, targetRole: 'devotee' })
      .sort({ createdAt: -1 })
      .limit(parseInt(req.query.limit) || 50)
      .lean();
    res.status(200).json(notifications);
  } catch (error) {
    next(error);
  }
};

// Mark notification as read
exports.markNotificationAsRead = async (req, res, next) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.notificationId, userId: req.user.id, targetRole: 'devotee' },
      { read: true, updatedAt: new Date() },
      { new: true }
    );
    if (!notification) return res.status(404).json({ message: 'Notification not found' });
    res.status(200).json({ message: 'Notification marked as read', notification });
  } catch (error) {
    next(error);
  }
};

// Mark all notifications as read
exports.markAllNotificationsAsRead = async (req, res, next) => {
  try {
    await Notification.updateMany(
      { userId: req.user.id, read: false, targetRole: 'devotee' },
      { read: true, updatedAt: new Date() }
    );
    res.status(200).json({ message: 'All notifications marked as read' });
  } catch (error) {
    next(error);
  }
};

// --- Address Management ---
exports.getAddresses = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('addresses');
    res.status(200).json(user.addresses || []);
  } catch (error) {
    next(error);
  }
};

exports.addAddress = async (req, res, next) => {
  try {
    const addresses = await devoteeService.manageAddress(req.user.id, 'add', req.body);
    res.status(201).json(addresses);
  } catch (error) {
    next(error);
  }
};

exports.updateAddress = async (req, res, next) => {
  try {
    const addresses = await devoteeService.manageAddress(
      req.user.id,
      'update',
      req.body,
      req.params.addressId
    );
    res.status(200).json(addresses);
  } catch (error) {
    next(error);
  }
};

exports.deleteAddress = async (req, res, next) => {
  try {
    const addresses = await devoteeService.manageAddress(
      req.user.id,
      'delete',
      null,
      req.params.addressId
    );
    res.status(200).json(addresses);
  } catch (error) {
    next(error);
  }
};

// --- Pending Actions ---
exports.getPendingActions = async (req, res, next) => {
  try {
    const devoteeId = req.user.id;
    const completedBookings = await Booking.find({ devoteeId, status: 'completed' })
      .populate('priestId', 'name profilePicture')
      .select('_id ceremonyType date priestId')
      .lean();

    const bookingIds = completedBookings.map((b) => b._id);
    const existingReviews = await Review.find({
      bookingId: { $in: bookingIds },
      reviewerId: devoteeId,
    })
      .select('bookingId')
      .lean();

    const reviewedBookingIds = new Set(existingReviews.map((r) => r.bookingId.toString()));
    const actions = completedBookings
      .filter((b) => !reviewedBookingIds.has(b._id.toString()))
      .map((b) => ({
        _id: b._id,
        type: 'rate_priest',
        title: 'Rate your Experience',
        description: `How was the ${b.ceremonyType}?`,
        booking: {
          _id: b._id,
          ceremonyType: b.ceremonyType,
          date: b.date,
          priestName: b.priestId?.name || 'Priest',
          priestId: b.priestId?._id,
        },
        date: b.date,
      }));

    res.status(200).json(actions);
  } catch (error) {
    next(error);
  }
};
