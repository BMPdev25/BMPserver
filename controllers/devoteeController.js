// controllers/devoteeController.js
const User = require('../models/user');
const PriestProfile = require('../models/priestProfile');
const Booking = require('../models/booking');
const Notification = require('../models/notification');

// Get all priests (for debugging)
exports.getAllPriests = async (req, res) => {
  try {
    console.log('Getting all priests...');
    
    // Get all priest profiles
    const allPriests = await PriestProfile.find({})
      .populate('userId', 'name email phone location')
      .exec();
    
    console.log('Total priests in database:', allPriests.length);
    
    res.status(200).json({
      total: allPriests.length,
      priests: allPriests.map(priest => ({
        _id: priest._id,
        name: priest.userId?.name || 'No name',
        experience: priest.experience,
        religiousTradition: priest.religiousTradition,
        ceremonies: priest.ceremonies,
        isVerified: priest.isVerified,
        hasUserId: !!priest.userId
      }))
    });
  } catch (error) {
    console.error('Get all priests error:', error);
    res.status(500).json({
      message: 'Server error while fetching all priests',
      error: error.message
    });
  }
};

// Search for priests
exports.searchPriests = async (req, res) => {
  try {
    const { ceremony, city, date, page = 1, limit = 10 } = req.query;
    console.log('Search priests request:', req.query);
    
    // Build query filter
    const filter = {};
    
    if (ceremony) {
      filter.ceremonies = { $in: [ceremony] };
    }
    
    if (city) {
      filter['userId.location.city'] = new RegExp(city, 'i');
    }
    
    console.log('Search filter:', filter);
    
    // Get priest profiles with user details
    const priests = await PriestProfile.find(filter)
      .populate('userId', 'name email phone location')
      .sort({ 'ratings.average': -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();
    
    console.log('Found priests count:', priests.length);
    console.log('Sample priest data:', priests[0] ? {
      _id: priests[0]._id,
      userId: priests[0].userId,
      experience: priests[0].experience,
      religiousTradition: priests[0].religiousTradition,
      ceremonies: priests[0].ceremonies,
      isVerified: priests[0].isVerified
    } : 'No priests found');
    
    // Filter out priests who are not verified (all priests are verified by default now)
    const verifiedPriests = priests.filter(priest => priest.isVerified !== false);
    
    console.log('Verified priests count:', verifiedPriests.length);
    
    // Format response
    const formattedPriests = verifiedPriests.map(priest => ({
      _id: priest._id,
      name: priest.userId?.name || 'Unknown Name',
      email: priest.userId?.email || '',
      phone: priest.userId?.phone || '',
      experience: priest.experience,
      religiousTradition: priest.religiousTradition,
      ceremonies: priest.ceremonies,
      profilePicture: priest.profilePicture,
      ratings: priest.ratings,
      ceremonyCount: priest.ceremonyCount,
      location: priest.userId?.location,
      priceList: priest.priceList,
      isVerified: priest.isVerified,
    }));
    
    console.log('Formatted priests count:', formattedPriests.length);
    
    res.status(200).json({
      priests: formattedPriests,
      currentPage: parseInt(page),
      totalPages: Math.ceil(verifiedPriests.length / limit),
      totalPriests: verifiedPriests.length,
    });
  } catch (error) {
    console.error('Search priests error:', error);
    res.status(500).json({
      message: 'Server error while searching for priests',
      error: error.message
    });
  }
};

// Get priest details
exports.getPriestDetails = async (req, res) => {
  try {
    const { priestId } = req.params;
    console.log('Getting priest details for priestId:', priestId);

    // Try to find actual priest first
    let priest = await PriestProfile.findById(priestId)
      .populate('userId', 'name email phone location')
      .exec();
    
    if (priest) {
      console.log('Found actual priest:', priest.userId?.name);
      const priestData = {
        _id: priest._id,
        name: priest.userId?.name || 'Unknown Priest',
        experience: priest.experience,
        religiousTradition: priest.religiousTradition,
        ceremonies: priest.ceremonies,
        description: priest.description || 'Experienced priest specializing in various religious ceremonies.',
        profilePicture: priest.profilePicture || '',
        ratings: priest.ratings || { average: 4.5, count: 50 },
        availability: 'available',
        priceList: priest.priceList || {
          'Wedding': 15000,
          'Grih Pravesh': 8000,
          'Baby Naming': 5000,
          'Satyanarayan Katha': 11000,
          'default': 8000
        },
        ceremonyCount: priest.ceremonyCount || 100
      };
      return res.status(200).json(priestData);
    }

    // Fallback demo data if priest not found in database
    console.log('Priest not found in database, using demo data');
    const demoData = {
      _id: priestId,
      name: priestId.includes('mahantesh') ? 'Mahantesh' : 'Dr. Rajesh Sharma',
      experience: 25,
      religiousTradition: 'Hinduism',
      ceremonies: ['Wedding', 'Grih Pravesh', 'Baby Naming', 'Satyanarayan Katha'],
      description: 'Experienced priest specializing in various religious ceremonies.',
      profilePicture: '',
      ratings: {
        average: 4.9,
        count: 120
      },
      availability: 'available',
      priceList: {
        'Wedding': 15000,
        'Grih Pravesh': 8000,
        'Baby Naming': 5000,
        'Satyanarayan Katha': 11000,
        'default': 8000
      },
      ceremonyCount: 200
    };

    res.status(200).json(demoData);
  } catch (error) {
    console.error('Get priest details error:', error);
    res.status(500).json({
      message: 'Server error while fetching priest details',
      error: error.message
    });
  }
};

// Get devotee's bookings
exports.getBookings = async (req, res) => {
  try {
    const devoteeId = req.user.id;
    console.log('Fetching bookings for devoteeId:', devoteeId);
    // Fetch bookings for this devotee
    const bookings = await Booking.find({ devoteeId })
      .populate('priestId', 'name email phone profilePicture')
      .sort({ createdAt: -1 })
      .exec();
    console.log('Bookings found:', bookings);
    
    res.status(200).json(bookings);
  } catch (error) {
    console.error('Get bookings error:', error);
    res.status(500).json({
      message: 'Server error while fetching bookings'
    });
  }
};

// Create a booking
exports.createBooking = async (req, res) => {
  try {
    const devoteeId = req.user.id;
    console.log('Creating booking for devoteeId:', devoteeId, 'with body:', req.body);
    
    // Validate required fields
    const requiredFields = ['priestId', 'ceremonyType', 'date', 'startTime', 'endTime', 'location', 'basePrice', 'totalAmount'];
    const missingFields = requiredFields.filter(field => !req.body[field]);
    
    if (missingFields.length > 0) {
      console.error('Missing required fields:', missingFields);
      return res.status(400).json({
        message: `Missing required fields: ${missingFields.join(', ')}`
      });
    }
    
    // Validate location object
    if (!req.body.location.address || !req.body.location.city) {
      console.error('Missing location address or city');
      return res.status(400).json({
        message: 'Location address and city are required'
      });
    }
    
    // Create new booking with actual data persistence
    // Fetch the User ID for the priest instead of the PriestProfile ID
    const priestProfile = await PriestProfile.findById(req.body.priestId);
    if (!priestProfile) {
      return res.status(400).json({
        message: 'Invalid priest profile ID'
      });
    }

    const userPriestId = priestProfile.userId;
    
    // Get price from priest profile with proper fallback logic
    let finalBasePrice = req.body.basePrice; // Use the price sent from frontend as fallback
    
    if (priestProfile.priceList) {
      // PriestProfile.priceList is a Map, so we need to use .get() method
      const ceremonyPrice = priestProfile.priceList.get(req.body.ceremonyType);
      const defaultPrice = priestProfile.priceList.get('default');
      
      if (ceremonyPrice) {
        finalBasePrice = ceremonyPrice;
      } else if (defaultPrice) {
        finalBasePrice = defaultPrice;
      }
      
      console.log('Price lookup:', {
        ceremonyType: req.body.ceremonyType,
        ceremonyPrice,
        defaultPrice,
        finalBasePrice,
        priceListKeys: Array.from(priestProfile.priceList.keys())
      });
    } else {
      console.log('PriceList not found, using frontend price:', finalBasePrice);
    }

    const bookingData = {
      ...req.body,
      priestId: userPriestId, // Use the User ID for the priest
      devoteeId,
      status: req.body.paymentStatus === 'completed' ? 'confirmed' : 'pending',
      paymentStatus: req.body.paymentStatus || 'pending',
      basePrice: finalBasePrice // Use the calculated price
    };
    
    console.log('Final booking data to save:', bookingData);
    
    const booking = new Booking(bookingData);
    const savedBooking = await booking.save();
    
    console.log('Booking saved successfully:', savedBooking._id);
    
    // Get devotee details for notification
    const devotee = await User.findById(devoteeId).select('name');
    const devoteeName = devotee?.name || 'A devotee';
    
    // Create notification for the priest
    try {
      await Notification.createNotification({
        userId: userPriestId, // Use the correct priest user ID
        title: 'New Booking Request',
        message: `You have a new booking request for ${req.body.ceremonyType} from ${devoteeName}. Date: ${new Date(req.body.date).toLocaleDateString()} at ${req.body.startTime}.`,
        type: 'booking',
        relatedId: savedBooking._id
      });
      console.log('Notification created for priest:', userPriestId);
    } catch (notificationError) {
      console.error('Error creating notification:', notificationError);
      // Don't fail the booking if notification fails
    }
    
    // Populate priest details for response
    await savedBooking.populate('priestId', 'name email phone profilePicture');
    
    res.status(201).json(savedBooking);
  } catch (error) {
    console.error('Create booking error details:', {
      message: error.message,
      stack: error.stack,
      validationErrors: error.errors,
      name: error.name
    });
    
    // Handle validation errors specifically
    if (error.name === 'ValidationError') {
      const errorMessages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        message: 'Validation failed',
        errors: errorMessages
      });
    }
    
    res.status(500).json({
      message: 'Server error while creating booking',
      error: error.message
    });
  }
};

// Update devotee profile
exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    // Update fields
    user.name = req.body.name || user.name;
    user.email = req.body.email || user.email;
    user.phone = req.body.phone || user.phone;
    // Add more fields as needed
    await user.save();
    res.json(user);
  } catch (error) {
    console.error('Update devotee profile error:', error);
    res.status(500).json({ message: 'Server error while updating profile' });
  }
};

// Get devotee's notifications
exports.getNotifications = async (req, res) => {
  try {
    const { limit = 50, unreadOnly = false } = req.query;
    const devoteeId = req.user.id;
    
    const query = { userId: devoteeId };
    if (unreadOnly === 'true') {
      query.read = false;
    }

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    res.status(200).json(notifications);
  } catch (error) {
    console.error('Get devotee notifications error:', error);
    res.status(500).json({
      message: 'Server error while fetching notifications'
    });
  }
};

// Mark notification as read
exports.markNotificationAsRead = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const devoteeId = req.user.id;

    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, userId: devoteeId },
      { read: true, updatedAt: new Date() },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    res.status(200).json({ message: 'Notification marked as read', notification });
  } catch (error) {
    console.error('Mark devotee notification as read error:', error);
    res.status(500).json({
      message: 'Server error while marking notification as read'
    });
  }
};

// Mark all notifications as read
exports.markAllNotificationsAsRead = async (req, res) => {
  try {
    const devoteeId = req.user.id;

    await Notification.updateMany(
      { userId: devoteeId, read: false },
      { read: true, updatedAt: new Date() }
    );

    res.status(200).json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Mark all devotee notifications as read error:', error);
    res.status(500).json({
      message: 'Server error while marking all notifications as read'
    });
  }
};
