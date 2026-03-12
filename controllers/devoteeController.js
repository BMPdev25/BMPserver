// controllers/devoteeController.js
const User = require("../models/user");
const PriestProfile = require("../models/priestProfile");
const Booking = require("../models/booking");
const Notification = require("../models/notification");
const Review = require("../models/review");

// Get all priests (for debugging)
exports.getAllPriests = async (req, res) => {
  try {
    // Get all priest profiles
    const allPriests = await PriestProfile.find({})
      .populate({
        path: "userId",
        select: "name email phone location languagesSpoken",
        populate: { path: "languagesSpoken", select: "name" }
      })
      .lean()
      .exec();

    res.status(200).json({
      total: allPriests.length,
      priests: allPriests.map((priest) => ({
        _id: priest._id,
        name: priest.userId?.name || "No name",
        email: priest.userId?.email || "",
        phone: priest.userId?.phone || "",
        experience: priest.experience,
        religiousTradition: priest.religiousTradition,
        isVerified: priest.isVerified,
        hasUserId: !!priest.userId,
        location: priest.userId?.location,
        profilePicture: priest.profilePicture,
        rating: priest.ratings, // Map to singular 'rating'
        languages: priest.userId?.languagesSpoken?.map(l => l.name) || [],
      })),
    });
  } catch (error) {
    console.error("Get all priests error:", error);
    res.status(500).json({
      message: "Server error while fetching all priests",
      error: error.message,
    });
  }
};

// Search for priests
exports.searchPriests = async (req, res) => {
  try {
    const { ceremony, city, date, religion, minRating, page = 1, limit = 10 } = req.query;

    // Build query filter
    const filter = {};

    if (ceremony) {
      // Legacy ceremony string search removed.
      // TODO: Implement search by service/ceremonyId if needed
    }

    // BUG-10 FIX: 'userId.location.city' cannot be queried via Mongoose populate dot-notation.
    // Do a pre-query on User collection to get matching user IDs, then filter by priestProfile.userId.
    if (city) {
      const cityRegex = new RegExp(city, 'i');
      const cityUsers = await User.find({ 'location.city': cityRegex }).select('_id').lean();
      const cityUserIds = cityUsers.map(u => u._id);
      filter.userId = { $in: cityUserIds };
    }

    // Filter by religious tradition
    if (religion) {
      filter.religiousTradition = new RegExp(religion, 'i');
    }

    // Filter by minimum rating
    if (minRating) {
      filter['ratings.average'] = { $gte: parseFloat(minRating) };
    }

    // If search term is provided, we need to find matching users first (by name)
    // and then add them to the priest filter
    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search, "i");
      
      // Find users matching the name
      const matchingUsers = await User.find({ name: searchRegex }).select('_id').lean();
      const matchingUserIds = matchingUsers.map(u => u._id);

      // Add to filter with OR condition for name, description, or ceremonies
      filter.$or = [
        { userId: { $in: matchingUserIds } },
        { description: searchRegex },
      ];
    }

    // Get priest profiles with user details
    const priests = await PriestProfile.find(filter)
      .populate({
        path: "userId",
        select: "name email phone location languagesSpoken",
        populate: { path: "languagesSpoken", select: "name" }
      })
      .populate("services.ceremonyId", "name") // For ceremony badges
      .select("userId experience religiousTradition profilePicture ratings ceremonyCount priceList isVerified services analytics.completionRate")
      .sort({ "ratings.average": -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean()
      .exec();

    // Filter out priests who are not verified (all priests are verified by default now)
    const verifiedPriests = priests.filter(
      (priest) => priest.isVerified !== false
    );

    // Format response
    const formattedPriests = verifiedPriests.map((priest) => ({
      _id: priest._id,
      name: priest.userId?.name || "Unknown Name",
      email: priest.userId?.email || "",
      phone: priest.userId?.phone || "",
      experience: priest.experience,
      religiousTradition: priest.religiousTradition,
      profilePicture: priest.profilePicture,
      rating: priest.ratings, // Map to singular 'rating'
      ratings: priest.ratings,
      ceremonyCount: priest.ceremonyCount,
      location: priest.userId?.location,
      priceList: priest.priceList,
      isVerified: priest.isVerified,
      languages: priest.userId?.languagesSpoken?.map(l => l.name || l) || [],
      services: priest.services?.map(s => ({
        name: s.ceremonyId?.name || "Unknown",
        price: s.price,
        duration: s.durationMinutes,
        ritualSteps: s.ceremonyId?.ritualSteps || [],
        customSteps: s.customSteps || []
      })) || [],
      completionRate: priest.analytics?.completionRate ?? 100,
    }));

    res.status(200).json({
      priests: formattedPriests,
      currentPage: parseInt(page),
      totalPages: Math.ceil(verifiedPriests.length / limit),
      totalPriests: verifiedPriests.length,
    });
  } catch (error) {
    console.error("Search priests error:", error);
    res.status(500).json({
      message: "Server error while searching for priests",
      error: error.message,
    });
  }
};

// Get priest details
exports.getPriestDetails = async (req, res) => {
  try {
    const { priestId } = req.params;
    console.log("devoteeController: getPriestDetails for priestId:", priestId);

      // Try to find actual priest first
    let priest = await PriestProfile.findById(priestId)
      .populate({
        path: "userId",
        select: "name email phone location languagesSpoken",
        populate: { path: "languagesSpoken", select: "name" }
      })
      .populate("services.ceremonyId", "name ritualSteps") // Populate ceremony details and base ritual steps
      .lean()
      .exec();

    if (!priest) {
      console.log("devoteeController: PriestProfile not found by _id. Trying to find by userId...");
      priest = await PriestProfile.findOne({ userId: priestId })
        .populate({
          path: "userId",
          select: "name email phone location languagesSpoken",
          populate: { path: "languagesSpoken", select: "name" }
        })
        .populate("services.ceremonyId", "name ritualSteps")
        .lean()
        .exec();
    }

    if (priest) {
      
      // Map services to ceremonies format expected by frontend
      const mappedCeremonies = priest.services?.map(service => ({
        id: service.ceremonyId?._id,
        name: service.ceremonyId?.name || "Unknown Ceremony",
        price: service.price,
        duration: service.durationMinutes,
        ritualSteps: service.ceremonyId?.ritualSteps || [],
        customSteps: service.customSteps || []
      })) || [];

      // Format weekly availability
      // Frontend expects: weeklyAvailability: Record<string, { available: boolean, startTime: string, endTime: string }>
      // Backend (Map) -> Object
      const weeklyAvailabilityObj = {};
      if (priest.availability && priest.availability.weeklySchedule) {
        // Handle Map or Object
        const schedule = priest.availability.weeklySchedule instanceof Map 
          ? Object.fromEntries(priest.availability.weeklySchedule) 
          : priest.availability.weeklySchedule;

        Object.keys(schedule).forEach(day => {
          const slots = schedule[day] || [];
          weeklyAvailabilityObj[day] = {
            available: slots.length > 0,
            startTime: slots.length > 0 ? slots[0].split('-')[0] : "09:00",
            endTime: slots.length > 0 ? slots[0].split('-')[1] : "17:00"
          };
        });
      }

      const priestData = {
        _id: priest._id,
        name: priest.userId?.name || "Unknown Priest",
        experience: priest.experience,
        religiousTradition: priest.religiousTradition,
        ceremonies: mappedCeremonies, // Use mapped services
        description:
          priest.description ||
          "Experienced priest specializing in various religious ceremonies.",
        profilePicture: priest.profilePicture || "",
        rating: priest.ratings || { average: 4.5, count: 50 }, // Map to singular 'rating'
        availability: priest.currentAvailability?.status || "available",
        
        // Extended Fields for UI
        languages: priest.userId?.languagesSpoken?.map(l => l.name) || [],
        certifications: priest.specializations?.map(s => s.certification).filter(Boolean) || [],
        templeAffiliation: priest.templesAffiliated && priest.templesAffiliated.length > 0 ? priest.templesAffiliated[0] : null,
        weeklyAvailability: weeklyAvailabilityObj,

        priceList: priest.priceList || {
          Wedding: 15000,
          "Grih Pravesh": 8000,
          "Baby Naming": 5000,
          "Satyanarayan Katha": 11000,
          default: 8000,
        },
        ceremonyCount: priest.ceremonyCount || 100,
        completionRate: priest.analytics?.completionRate ?? 100,
      };
      
      return res.status(200).json(priestData);
    }

    // BUG-8 FIX: Remove hardcoded demo data fallback — return proper 404 instead
    return res.status(404).json({
      success: false,
      message: 'Priest not found'
    });
  } catch (error) {
    console.error("Get priest details error:", error);
    res.status(500).json({
      message: "Server error while fetching priest details",
      error: error.message,
    });
  }
};

// Get devotee's bookings
exports.getBookings = async (req, res) => {
  try {
    const devoteeId = req.user.id;
    // console.log("Fetching bookings for devoteeId:", devoteeId);
    // Fetch bookings for this devotee
    const bookings = await Booking.find({ devoteeId })
      .populate("priestId", "name email phone profilePicture")
      .sort({ createdAt: -1 })
      .exec();
    // console.log("Bookings found:", bookings);

    res.status(200).json(bookings);
  } catch (error) {
    console.error("Get bookings error:", error);
    res.status(500).json({
      message: "Server error while fetching bookings",
    });
  }
};

// Create a booking
exports.createBooking = async (req, res) => {
  try {
    const devoteeId = req.user.id;
    console.log(
      "Creating booking for devoteeId:",
      devoteeId,
      "with body:",
      req.body
    );

    // Validate required fields
    const requiredFields = [
      "priestId",
      "ceremonyType",
      "date",
      "startTime",
      "endTime",
      "location",
      "basePrice",
      "totalAmount",
    ];
    const missingFields = requiredFields.filter((field) => !req.body[field]);

    if (missingFields.length > 0) {
      console.error("Missing required fields:", missingFields);
      return res.status(400).json({
        message: `Missing required fields: ${missingFields.join(", ")}`,
      });
    }

    // BUG-2 FIX: Reject bookings with past dates
    const todayStr = new Date().toISOString().split('T')[0];
    const bookingDateStr = new Date(req.body.date).toISOString().split('T')[0];

    if (bookingDateStr < todayStr) {
      return res.status(400).json({
        success: false,
        message: 'Booking date cannot be in the past'
      });
    }

    // Validate location object
    if (!req.body.location.address || !req.body.location.city) {
      console.error("Missing location address or city");
      return res.status(400).json({
        message: "Location address and city are required",
      });
    }

    // Create new booking with actual data persistence
    // Fetch the User ID for the priest instead of the PriestProfile ID
    const priestProfile = await PriestProfile.findById(req.body.priestId);
    if (!priestProfile) {
      return res.status(400).json({
        message: "Invalid priest profile ID",
      });
    }

    const userPriestId = priestProfile.userId;

    // Get price from priest profile with proper fallback logic
    let finalBasePrice = req.body.basePrice; // Use the price sent from frontend as fallback

    if (priestProfile.priceList) {
      // PriestProfile.priceList is a Map, so we need to use .get() method
      const ceremonyPrice = priestProfile.priceList.get(req.body.ceremonyType);
      const defaultPrice = priestProfile.priceList.get("default");

      if (ceremonyPrice) {
        finalBasePrice = ceremonyPrice;
      } else if (defaultPrice) {
        finalBasePrice = defaultPrice;
      }

      console.log("Price lookup:", {
        ceremonyType: req.body.ceremonyType,
        ceremonyPrice,
        defaultPrice,
        finalBasePrice,
        priceListKeys: Array.from(priestProfile.priceList.keys()),
      });
    } else {
      // Use frontend price as fallback
    }

    const bookingData = {
      ...req.body,
      priestId: userPriestId, // Use the User ID for the priest
      devoteeId,
      status: req.body.paymentStatus === "completed" ? "confirmed" : "pending",
      paymentStatus: req.body.paymentStatus || "pending",
      basePrice: finalBasePrice, // Use the calculated price
    };

    const booking = new Booking(bookingData);
    const savedBooking = await booking.save();

    // Get devotee details for notification
    const devotee = await User.findById(devoteeId).select("name");
    const devoteeName = devotee?.name || "A devotee";

    // Create notification for the priest
    try {
      await Notification.createNotification({
        userId: userPriestId, // Use the correct priest user ID
        title: "New Booking Request",
        message: `You have a new booking request for ${
          req.body.ceremonyType
        } from ${devoteeName}. Date: ${new Date(
          req.body.date
        ).toLocaleDateString()} at ${req.body.startTime}.`,
        type: "booking",
        relatedId: savedBooking._id,
      });
    } catch (notificationError) {
      console.error("Error creating notification:", notificationError);
      // Don't fail the booking if notification fails
    }

    // Populate priest details for response
    await savedBooking.populate("priestId", "name email phone profilePicture");

    res.status(201).json(savedBooking);
  } catch (error) {
    console.error("Create booking error details:", {
      message: error.message,
      stack: error.stack,
      validationErrors: error.errors,
      name: error.name,
    });

    // Handle validation errors specifically
    if (error.name === "ValidationError") {
      const errorMessages = Object.values(error.errors).map(
        (err) => err.message
      );
      return res.status(400).json({
        message: "Validation failed",
        errors: errorMessages,
      });
    }

    res.status(500).json({
      message: "Server error while creating booking",
      error: error.message,
    });
  }
};

// Update devotee profile
exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    // Update fields
    user.name = req.body.name || user.name;
    user.email = req.body.email || user.email;
    user.phone = req.body.phone || user.phone;
    // Update family details if provided
    if (req.body.familyDetails) {
      if (!user.familyDetails) user.familyDetails = {};
      if (req.body.familyDetails.gotra !== undefined) user.familyDetails.gotra = req.body.familyDetails.gotra;
      if (req.body.familyDetails.nakshatra !== undefined) user.familyDetails.nakshatra = req.body.familyDetails.nakshatra;
      if (req.body.familyDetails.rashi !== undefined) user.familyDetails.rashi = req.body.familyDetails.rashi;
    }
    await user.save();
    res.json(user);
  } catch (error) {
    console.error("Update devotee profile error:", error);
    res.status(500).json({ message: "Server error while updating profile" });
  }
};

// Get devotee's notifications
exports.getNotifications = async (req, res) => {
  try {
    const { limit = 50, unreadOnly = false } = req.query;
    const devoteeId = req.user.id;

    const query = { userId: devoteeId };
    if (unreadOnly === "true") {
      query.read = false;
    }

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    res.status(200).json(notifications);
  } catch (error) {
    console.error("Get devotee notifications error:", error);
    res.status(500).json({
      message: "Server error while fetching notifications",
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
      return res.status(404).json({ message: "Notification not found" });
    }

    res
      .status(200)
      .json({ message: "Notification marked as read", notification });
  } catch (error) {
    console.error("Mark devotee notification as read error:", error);
    res.status(500).json({
      message: "Server error while marking notification as read",
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

    res.status(200).json({ message: "All notifications marked as read" });
  } catch (error) {
    console.error("Mark all devotee notifications as read error:", error);
    res.status(500).json({
      message: "Server error while marking all notifications as read",
    });
  }
};

// --- Address Management ---

// Get user addresses
exports.getAddresses = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('addresses');
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.status(200).json(user.addresses || []);
  } catch (error) {
    console.error("Get addresses error:", error);
    res.status(500).json({ message: "Server error getting addresses" });
  }
};

// Add new address
exports.addAddress = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const newAddress = req.body;
    
    // If set as default, unset other defaults
    if (newAddress.isDefault) {
      user.addresses.forEach(addr => addr.isDefault = false);
    } 
    // If it's the first address, make it default automatically
    else if (user.addresses.length === 0) {
      newAddress.isDefault = true;
    }

    user.addresses.push(newAddress);
    await user.save();

    res.status(201).json(user.addresses);
  } catch (error) {
    console.error("Add address error:", error);
    res.status(500).json({ message: "Server error adding address" });
  }
};

// Update address
exports.updateAddress = async (req, res) => {
  try {
    const { addressId } = req.params;
    const updateData = req.body;
    
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const addressIndex = user.addresses.findIndex(addr => addr._id.toString() === addressId);
    if (addressIndex === -1) {
      return res.status(404).json({ message: "Address not found" });
    }

    // Handle default toggle logic
    if (updateData.isDefault) {
      user.addresses.forEach(addr => addr.isDefault = false);
    }

    // Update fields
    const address = user.addresses[addressIndex];
    Object.keys(updateData).forEach(key => {
        // Prevent updating _id
        if (key !== '_id') {
            address[key] = updateData[key];
        }
    });

    await user.save();
    res.status(200).json(user.addresses);
  } catch (error) {
    console.error("Update address error:", error);
    res.status(500).json({ message: "Server error updating address" });
  }
};

// Delete address
exports.deleteAddress = async (req, res) => {
  try {
    const { addressId } = req.params;
    const user = await User.findById(req.user.id);
    
    if (!user) {
        return res.status(404).json({ message: "User not found" });
    }

    user.addresses = user.addresses.filter(addr => addr._id.toString() !== addressId);
    
    // If we deleted the default address and others exist, make the first one default
    if (user.addresses.length > 0 && !user.addresses.some(addr => addr.isDefault)) {
        user.addresses[0].isDefault = true;
    }

    await user.save();
    res.status(200).json(user.addresses);
  } catch (error) {
    console.error("Delete address error:", error);
    res.status(500).json({ message: "Server error deleting address" });
  }
};

// --- Actions & Reviews ---

// Get pending actions (e.g., rate bookings)
exports.getPendingActions = async (req, res) => {
  try {
    const devoteeId = req.user.id;

    // 1. Find completed bookings for this devotee
    const completedBookings = await Booking.find({
      devoteeId: devoteeId,
      status: 'completed'
    })
    .populate("priestId", "name profilePicture")
    .select("_id ceremonyType date priestId")
    .sort({ date: -1 })
    .lean()
    .exec();

    if (completedBookings.length === 0) {
      return res.status(200).json([]);
    }

    // 2. Bulk query: find all reviews by this devotee for these bookings
    const bookingIds = completedBookings.map(b => b._id);
    const existingReviews = await Review.find({
      bookingId: { $in: bookingIds },
      reviewerId: devoteeId
    }).select("bookingId").lean();

    const reviewedBookingIds = new Set(existingReviews.map(r => r.bookingId.toString()));

    // 3. Filter out already-reviewed bookings
    const actions = completedBookings
      .filter(booking => !reviewedBookingIds.has(booking._id.toString()))
      .map(booking => ({
        _id: booking._id,
        type: 'rate_priest',
        title: 'Rate your Experience',
        description: `How was the ${booking.ceremonyType}?`,
        booking: {
          _id: booking._id,
          ceremonyType: booking.ceremonyType,
          date: booking.date,
          priestName: booking.priestId?.name || "Priest",
          priestId: booking.priestId?._id
        },
        date: booking.date
      }));

    res.status(200).json(actions);
  } catch (error) {
    console.error("Get pending actions error:", error);
    res.status(500).json({
      message: "Server error while fetching pending actions",
      error: error.message
    });
  }
};

// Book an instant ceremony
exports.bookInstantCeremony = async (req, res) => {
  try {
    const { ceremonyType, latitude, longitude, maxPrice, address, city } = req.body;
    const devoteeId = req.user.id;

    if (!latitude || !longitude) {
      return res.status(400).json({ message: "Location coordinates required for instant booking." });
    }

    // 1. Find matching priests using GeoJSON search
    const matchingPriests = await PriestProfile.find({
      isVerified: true,
      'currentAvailability.status': 'available',
      location: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [parseFloat(longitude), parseFloat(latitude)] // [lng, lat]
          },
          $maxDistance: 50000 // 50km
        }
      }
    }).populate('userId', 'name profilePicture');

    // 2. Filter by priest's custom radius and price
    const eligiblePriests = matchingPriests.filter(priest => {
      // Basic radius check is handled by $near. In future, we can check priest.serviceRadiusKm
      
      // Price Check
      const price = priest.priceList ? (priest.priceList.get(ceremonyType) || priest.priceList.get('default')) : 0;
      if (maxPrice && price > maxPrice) return false;
      if (!price) return false;
      
      return true;
    });

    if (eligiblePriests.length === 0) {
      return res.status(404).json({ message: "No priests available for instant booking in your area right now." });
    }

    // 3. Create a 'searching' booking
    const expiryTime = new Date();
    expiryTime.setMinutes(expiryTime.getMinutes() + 5);

    const booking = new Booking({
      devoteeId,
      ceremonyType,
      date: new Date(),
      startTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
      endTime: "07:00", // Default end time placeholder
      location: { 
        address, 
        city,
        coordinates: {
          type: 'Point',
          coordinates: [parseFloat(longitude), parseFloat(latitude)]
        }
      },
      status: 'searching',
      bookingType: 'instant',
      expiryTime,
      basePrice: eligiblePriests[0].priceList.get(ceremonyType) || eligiblePriests[0].priceList.get('default'),
      platformFee: Math.round((eligiblePriests[0].priceList.get(ceremonyType) || eligiblePriests[0].priceList.get('default')) * 0.05),
      totalAmount: Math.round((eligiblePriests[0].priceList.get(ceremonyType) || eligiblePriests[0].priceList.get('default')) * 1.05),
    });

    const savedBooking = await booking.save();

    // 4. Notify matching priests via Socket.io
    const io = req.app.get('io');
    const userSockets = req.app.get('userSockets');

    let notifiedCount = 0;
    eligiblePriests.forEach(priest => {
      const socketId = userSockets.get(priest.userId._id.toString());
      if (socketId) {
        io.to(socketId).emit('new_instant_request', {
          bookingId: savedBooking._id,
          ceremonyType,
          location: { address, city },
          price: savedBooking.totalAmount,
          expiryTime: savedBooking.expiryTime
        });
        notifiedCount++;
      }
    });

    console.log(`Instant booking initiated. Notified ${notifiedCount} priests.`);

    res.status(201).json(savedBooking);

  } catch (error) {
    console.error("Instant booking error:", error);
    res.status(500).json({ message: "Server error during instant booking initiation", error: error.message });
  }
};

