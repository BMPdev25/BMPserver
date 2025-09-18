// controllers/priestController.js
const PriestProfile = require('../models/priestProfile');
const User = require('../models/user');
const Booking = require('../models/booking');
const Transaction = require('../models/transaction');
const Notification = require('../models/notification');

// Create or update priest profile
exports.updateProfile = async (req, res) => {
  try {
    const {
      experience,
      religiousTradition,
      templesAffiliated,
      ceremonies,
      description,
      profilePicture,
      priceList,
      availability
    } = req.body;

    // Find existing profile
    let profile = await PriestProfile.findOne({ userId: req.user.id });

    const updateData = {
      experience,
      religiousTradition,
      templesAffiliated,
      ceremonies,
      description,
      profilePicture
    };

    // Only update priceList if provided
    if (priceList) {
      updateData.priceList = priceList;
    }

    // Only update availability if provided
    if (availability) {
      updateData.availability = availability;
    }

    if (profile) {
      // Update existing profile
      profile = await PriestProfile.findOneAndUpdate(
        { userId: req.user.id },
        updateData,
        { new: true }
      );
    } else {
      // Create new profile
      profile = new PriestProfile({
        userId: req.user.id,
        ...updateData
      });

      await profile.save();

      // Update user's profileCompleted status
      await User.findByIdAndUpdate(
        req.user.id,
        { profileCompleted: true }
      );
    }

    res.status(200).json(profile);
  } catch (error) {
    console.error('Update priest profile error:', error);
    res.status(500).json({
      message: 'Server error while updating priest profile'
    });
  }
};

// Get priest profile
exports.getProfile = async (req, res) => {
  try {
    const profile = await PriestProfile.findOne({ userId: req.user.id });

    if (!profile) {
      return res.status(404).json({ message: 'Profile not found' });
    }

    res.status(200).json(profile);
  } catch (error) {
    console.error('Get priest profile error:', error);
    res.status(500).json({
      message: 'Server error while fetching priest profile'
    });
  }
};

// Get priest's bookings
exports.getBookings = async (req, res) => {
  try {
    const { status } = req.query;
    const query = { priestId: req.user.id };
    
    // Add status filter if provided
    if (status) {
      query.status = status;
    }

    const bookings = await Booking.find(query)
    .populate('devoteeId', 'name email phone')
    .sort({ date: -1 }); // Most recent first

    res.status(200).json(bookings);
  } catch (error) {
    console.error('Get bookings error:', error);
    res.status(500).json({
      message: 'Server error while fetching bookings'
    });
  }
};

// Get priest's earnings based on completed bookings
exports.getEarnings = async (req, res) => {
  try {
    const priestId = req.user.id;
    const { period } = req.query;

    // Calculate date ranges
    const now = new Date();
    const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    // Get completed bookings for current month
    const currentMonthBookings = await Booking.find({
      priestId: priestId,
      status: 'completed',
      completionDate: { $gte: currentMonth }
    }).populate('devoteeId', 'name');

    // Get completed bookings for last month
    const lastMonthBookings = await Booking.find({
      priestId: priestId,
      status: 'completed',
      completionDate: { $gte: lastMonth, $lte: lastMonthEnd }
    }).populate('devoteeId', 'name');

    // Calculate earnings
    const thisMonthEarnings = currentMonthBookings.reduce((total, booking) => {
      // Priest gets basePrice (platform keeps the platform fee)
      return total + (booking.basePrice || 0);
    }, 0);

    const lastMonthEarnings = lastMonthBookings.reduce((total, booking) => {
      return total + (booking.basePrice || 0);
    }, 0);

    // Calculate growth percentage
    let growthPercentage = 0;
    if (lastMonthEarnings > 0) {
      growthPercentage = ((thisMonthEarnings - lastMonthEarnings) / lastMonthEarnings) * 100;
    } else if (thisMonthEarnings > 0) {
      growthPercentage = 100; // First month with earnings
    }

    // Get all transactions (completed bookings) sorted by date
    const allCompletedBookings = await Booking.find({
      priestId: priestId,
      status: 'completed'
    })
    .populate('devoteeId', 'name')
    .sort({ completionDate: -1 })
    .limit(10); // Get latest 10 transactions

    // Format transactions
    const transactions = allCompletedBookings.map(booking => ({
      id: booking._id,
      amount: booking.basePrice,
      type: 'earnings',
      date: booking.completionDate || booking.date,
      description: booking.ceremonyType,
      client: booking.devoteeId?.name || 'Unknown Client',
      status: 'completed'
    }));

    // Calculate available balance (for simplicity, using current month earnings)
    // In a real app, this would be thisMonthEarnings minus any withdrawals
    const availableBalance = thisMonthEarnings;

    const earnings = {
      thisMonth: thisMonthEarnings,
      lastMonth: lastMonthEarnings,
      growthPercentage: Math.round(growthPercentage * 100) / 100,
      availableBalance: availableBalance,
      transactions: transactions,
      totalBookings: currentMonthBookings.length,
      totalCompletedBookings: allCompletedBookings.length
    };

    res.status(200).json(earnings);
  } catch (error) {
    console.error('Get earnings error:', error);
    res.status(500).json({
      message: 'Server error while fetching earnings'
    });
  }
};

// Request earnings withdrawal
exports.requestWithdrawal = async (req, res) => {
  try {
    const { amount, paymentMethod } = req.body;
    const priestId = req.user.id;

    // Validate amount
    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Invalid withdrawal amount' });
    }

    // Get current available balance
    const now = new Date();
    const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const currentMonthBookings = await Booking.find({
      priestId: priestId,
      status: 'completed',
      completionDate: { $gte: currentMonth }
    });

    const availableBalance = currentMonthBookings.reduce((total, booking) => {
      return total + (booking.basePrice || 0);
    }, 0);

    // Check if user has sufficient balance
    if (amount > availableBalance) {
      return res.status(400).json({ 
        message: 'Insufficient balance for withdrawal',
        availableBalance: availableBalance
      });
    }

    // Create withdrawal transaction record
    const transaction = new Transaction({
      userId: priestId,
      type: 'withdrawal',
      amount: amount,
      status: 'pending',
      paymentMethod: paymentMethod,
      description: 'Earnings withdrawal request',
      createdAt: new Date()
    });

    await transaction.save();

    res.status(200).json({
      message: 'Withdrawal request submitted successfully',
      transactionId: transaction._id,
      amount: amount,
      status: 'pending'
    });
  } catch (error) {
    console.error('Withdrawal request error:', error);
    res.status(500).json({
      message: 'Server error while processing withdrawal request'
    });
  }
};

// Get transactions history
exports.getTransactions = async (req, res) => {
  try {
    const { type, limit = 20 } = req.query;
    const priestId = req.user.id;
    
    const query = { userId: priestId };
    if (type) {
      query.type = type;
    }

    const transactions = await Transaction.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    res.status(200).json(transactions);
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({
      message: 'Server error while fetching transactions'
    });
  }
};

// Get priest's notifications
exports.getNotifications = async (req, res) => {
  try {
    const { limit = 50, unreadOnly = false } = req.query;
    const priestId = req.user.id;
    
    const query = { userId: priestId };
    if (unreadOnly === 'true') {
      query.read = false;
    }

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    res.status(200).json(notifications);
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({
      message: 'Server error while fetching notifications'
    });
  }
};

// Mark notification as read
exports.markNotificationAsRead = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const priestId = req.user.id;

    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, userId: priestId },
      { read: true, updatedAt: new Date() },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    res.status(200).json({ message: 'Notification marked as read', notification });
  } catch (error) {
    console.error('Mark notification as read error:', error);
    res.status(500).json({
      message: 'Server error while marking notification as read'
    });
  }
};

// Mark all notifications as read
exports.markAllNotificationsAsRead = async (req, res) => {
  try {
    const priestId = req.user.id;

    await Notification.updateMany(
      { userId: priestId, read: false },
      { read: true, updatedAt: new Date() }
    );

    res.status(200).json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Mark all notifications as read error:', error);
    res.status(500).json({
      message: 'Server error while marking all notifications as read'
    });
  }
};

// Update booking status (accept, complete, cancel)
exports.updateBookingStatus = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { status, notes } = req.body;
    const priestId = req.user.id;

    // Validate status
    const validStatuses = ['confirmed', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        message: 'Invalid status. Must be: confirmed, completed, or cancelled' 
      });
    }

    // Find the booking and verify it belongs to this priest
    const booking = await Booking.findOne({ _id: bookingId, priestId })
      .populate('devoteeId', 'name');

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // Update booking status
    const updateData = { 
      status, 
      updatedAt: new Date() 
    };
    
    if (notes) {
      updateData.notes = notes;
    }

    if (status === 'completed') {
      updateData.completionDate = new Date();
    } else if (status === 'cancelled') {
      updateData.cancellationDate = new Date();
      if (notes) {
        updateData.cancellationReason = notes;
      }
    }

    const updatedBooking = await Booking.findByIdAndUpdate(
      bookingId,
      updateData,
      { new: true }
    ).populate('devoteeId', 'name');

    // Create notification for the devotee
    try {
      let notificationTitle, notificationMessage, notificationType;
      
      switch (status) {
        case 'confirmed':
          notificationTitle = 'Booking Confirmed';
          notificationMessage = `Your booking for ${booking.ceremonyType} on ${new Date(booking.date).toLocaleDateString()} has been confirmed by the priest.`;
          notificationType = 'booking';
          break;
        case 'completed':
          notificationTitle = 'Payment Received';
          notificationMessage = `You have received ₹${booking.basePrice} for ${booking.ceremonyType} ceremony.`;
          notificationType = 'payment';
          break;
        case 'cancelled':
          notificationTitle = 'Booking Cancelled';
          notificationMessage = `Your booking for ${booking.ceremonyType} on ${new Date(booking.date).toLocaleDateString()} has been cancelled.${notes ? ' Reason: ' + notes : ''}`;
          notificationType = 'booking';
          break;
      }

      // Create notification for devotee
      await Notification.createNotification({
        userId: booking.devoteeId._id,
        title: notificationTitle,
        message: notificationMessage,
        type: notificationType,
        relatedId: booking._id
      });

      // If completed, also create a payment notification for the priest
      if (status === 'completed') {
        await Notification.createNotification({
          userId: priestId,
          title: 'Payment Received',
          message: `You have received ₹${booking.basePrice} for ${booking.ceremonyType} ceremony with ${booking.devoteeId?.name || 'devotee'}.`,
          type: 'payment',
          relatedId: booking._id
        });
      }

      console.log('Notification created for status update:', status);
    } catch (notificationError) {
      console.error('Error creating notification for status update:', notificationError);
      // Don't fail the status update if notification fails
    }

    res.status(200).json({
      message: `Booking ${status} successfully`,
      booking: updatedBooking
    });
  } catch (error) {
    console.error('Update booking status error:', error);
    res.status(500).json({
      message: 'Server error while updating booking status'
    });
  }
};
