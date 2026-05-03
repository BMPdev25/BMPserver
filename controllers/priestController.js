// controllers/priestController.js
const priestService = require('../services/priestService');
const bookingService = require('../services/bookingService');
const PriestProfile = require('../models/priestProfile');
const User = require('../models/user');
const Notification = require('../models/notification');

// Create or update priest profile
exports.updateProfile = async (req, res, next) => {
  try {
    const profile = await priestService.updateProfile(req.user.id, req.body);
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
    res.status(200).json({ success: true, currentAvailability });
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

// Get priest's bookings
exports.getBookings = async (req, res, next) => {
  try {
    const bookings = await priestService.getBookings(req.user.id, req.query);
    res.status(200).json(bookings);
  } catch (error) {
    next(error);
  }
};

// Get priest's earnings
exports.getEarnings = async (req, res, next) => {
  try {
    const earnings = await priestService.getEarnings(req.user.id);
    res.status(200).json(earnings);
  } catch (error) {
    next(error);
  }
};

// Request withdrawal (redirects to service logic)
exports.requestWithdrawal = async (req, res, next) => {
  try {
    const { amount, paymentMethod } = req.body;
    // For now, keep the withdrawal simple or redirect to wallet service if needed.
    // Assuming simple logic from service if created.
    res.status(200).json({ message: 'Withdrawal logic moved to wallet service.' });
  } catch (error) {
    next(error);
  }
};

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
    const { ceremonyId, lat, lng, radius = 10 } = req.query;
    if (!ceremonyId) {
      return res.status(400).json({ message: 'ceremonyId is required' });
    }

    let geoFilter = {};
    if (lat && lng) {
      geoFilter = {
        location: {
          $near: {
            $geometry: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
            $maxDistance: parseFloat(radius) * 1000,
          },
        },
      };
    }

    const pujarisDocs = await PriestProfile.find({
      ...geoFilter,
      'services.ceremonyId': ceremonyId,
      isVerified: true,
    })
      .populate('userId', 'name phone languagesSpoken location')
      .populate('services.ceremonyId', 'name requirements durationMinutes')
      .lean();

    const pujaris = pujarisDocs.map((p) => ({
      ...p,
      name: p.userId?.name || 'Unknown Priest',
      phone: p.userId?.phone,
      rating: p.ratings,
    }));

    res.status(200).json({ pujaris });
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

    const actions = dueBookings.data
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
exports.uploadDocument = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    const result = await priestService.uploadDocument(req.user.id, req.file, req.body.documentType);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

// Submit verification (Mock)
exports.submitVerification = async (req, res, next) => {
  try {
    await PriestProfile.findOneAndUpdate({ userId: req.user.id }, { isVerified: false }); // Pending review
    res.status(200).json({ message: 'Verification profile submitted for review.' });
  } catch (error) {
    next(error);
  }
};

// Get document (Serving buffer)
exports.getDocument = async (req, res, next) => {
  try {
    const profile = await PriestProfile.findOne({ userId: req.user.id });
    const doc = profile?.verificationDocuments.find((d) => d.type === req.params.documentType);
    if (!doc) return res.status(404).json({ message: 'Document not found' });

    res.set('Content-Type', doc.contentType);
    res.send(doc.data);
  } catch (error) {
    next(error);
  }
};

// Mock acceptInstantBooking
exports.acceptInstantBooking = async (req, res, next) => {
  try {
    const { bookingId } = req.body;
    const booking = await bookingService.updateBookingStatus(bookingId, req.user.id, {
      status: 'confirmed',
    });
    res.status(200).json({ message: 'Instant booking accepted', booking });
  } catch (error) {
    next(error);
  }
};
