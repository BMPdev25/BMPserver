// controllers/authController.js
const User = require('../models/user');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Register a new user
exports.register = async (req, res) => {
  try {
    const { name, email, phone, password, userType, } = req.body;
    console.log('Register request body:', req.body);
    // Check if user exists
    const existingUser = await User.findOne({
      $or: [{ email }, { phone }]
    });
    console.log('Existing user check:', existingUser);
    if (existingUser) {
      return res.status(400).json({
        message: 'User already exists with this email or phone'
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new user
    const user = new User({
      name,
      email,
      phone,
      password: hashedPassword,
      userType,
    });

    await user.save();

    // Store priest or devotee profile
    if (userType === 'priest') {
      const PriestProfile = require('../models/priestProfile');
      await PriestProfile.create({
        userId: user._id,
        experience: req.body.experience || 0,
        religiousTradition: req.body.religiousTradition || '',
        templesAffiliated: req.body.templesAffiliated || [],
        ceremonies: req.body.ceremonies || [],
        description: req.body.description || '',
        governmentIdVerified: req.body.governmentIdVerified || false,
        religiousCertificationVerified: req.body.religiousCertificationVerified || false,
        profilePicture: req.body.profilePicture || '',
        ratings: req.body.ratings || { average: 0, count: 0 },
        availability: req.body.availability || {},
        priceList: req.body.priceList || {},
        ceremonyCount: req.body.ceremonyCount || 0,
        isVerified: req.body.isVerified !== undefined ? req.body.isVerified : true,
        currentAvailability: req.body.currentAvailability || { status: 'offline', lastUpdated: new Date(), autoToggle: true },
        schedule: req.body.schedule || { workingHours: {}, blockedDates: [], recurringUnavailability: [] },
        earnings: req.body.earnings || { totalEarnings: 0, thisMonth: 0, lastMonth: 0, pendingPayments: 0, monthlyEarnings: [] },
        analytics: req.body.analytics || { completionRate: 100, responseTime: 2, repeatCustomers: 0, monthlyTrends: [] },
        serviceAreas: req.body.serviceAreas || [],
        specializations: req.body.specializations || []
      });
    } else if (userType === 'devotee') {
      const DevoteeProfile = require('../models/devoteeProfile');
      await DevoteeProfile.create({
        userId: user._id,
        address: req.body.address || {},
        preferences: req.body.preferences || {},
        history: req.body.history || [],
        isVerified: req.body.isVerified !== undefined ? req.body.isVerified : true,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }

    // Generate JWT
    const token = jwt.sign(
      { id: user._id, userType: user.userType },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      userType: user.userType,
      token,
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ message: 'Server error during registration' });
  }
};

// Login user
exports.login = async (req, res) => {
  try {
    const { phone, password } = req.body;

    // Find user by phone
    const user = await User.findOne({ phone });

    if (!user) {
      return res.status(401).json({ message: 'No user found' });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate JWT
    const token = jwt.sign(
      { id: user._id, userType: user.userType },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.status(200).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      userType: user.userType,
      profileCompleted: user.profileCompleted,
      token,
    });
  } catch (error) {
    console.error('Login error:', error);
    console.log(error)
    res.status(500).json({ message: 'Server error during login' });
  }
};

