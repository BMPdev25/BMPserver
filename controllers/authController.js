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
    const { identifier, password } = req.body;

    // Find user by phone OR email
    const user = await User.findOne({
      $or: [{ phone: identifier }, { email: identifier }]
    });

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

// Firebase Login
exports.firebaseLogin = async (req, res) => {
  try {
    const { idToken, userType = 'devotee' } = req.body;
    
    // Verify Firebase Token
    // In a real app with serviceAccountKey, we would use:
    // const decodedToken = await admin.auth().verifyIdToken(idToken);
    // const { uid, email, phone_number } = decodedToken;

    // FOR DEMO PURPOSES ONLY (Since we don't have real keys):
    // We will simulate verification by decoding the token (if it's a real JWT) or just trusting it for this dev phase
    // if the user provides a "mock_uid", we use that.
    
    // WARNING: THIS IS INSECURE AND FOR DEV ONLY
    // Replace with real admin.auth().verifyIdToken(idToken) when keys are available
    let uid, email, phone;
    
    // If it's a mock token from our frontend dev flow
    if (idToken.startsWith('mock_token_')) {
      const parts = idToken.split('_');
      uid = parts[2]; // mock_token_UID
      phone = parts[3] ? '+' + parts[3] : undefined;
    } else {
       // Try to verify with admin SDK if initialized
       const admin = require('../config/firebase');
       try {
         const decodedToken = await admin.auth().verifyIdToken(idToken);
         uid = decodedToken.uid;
         email = decodedToken.email;
         phone = decodedToken.phone_number;
       } catch (e) {
          console.log('Firebase verification failed (expected without keys):', e.message);
          // Fallback for dev: assume it's a valid UID if we can't verify
          // This allows you to test the flow without setting up the backend keys yet
          uid = idToken; // simplistic fallback
       }
    }

    if (!uid) {
      return res.status(400).json({ message: 'Invalid token' });
    }

    // Check if user exists with this Firebase UID
    let user = await User.findOne({ firebaseUid: uid });
    
    // If not, check by phone or email to link accounts
    if (!user && (phone || email)) {
       user = await User.findOne({ 
         $or: [
           { phone: phone }, 
           { email: email }
         ].filter(Boolean)
       });
       
       if (user) {
         // Link existing account
         user.firebaseUid = uid;
         await user.save();
       }
    }

    // If still no user, create a new one
    if (!user) {
       user = new User({
         name: 'New User', // Will be updated in profile
         email: email || `user_${uid}@example.com`,
         phone: phone || `+${Math.floor(Math.random() * 10000000000)}`, // Fallback
         firebaseUid: uid,
         userType,
         password: 'firebase_login_no_password', // Dummy, won't be used due to conditional requirement
       });
       await user.save();

       // Create profile based on type
        if (userType === 'priest') {
          const PriestProfile = require('../models/priestProfile');
          await PriestProfile.create({
            userId: user._id,
            isVerified: true
          });
        } else {
          const DevoteeProfile = require('../models/devoteeProfile');
          await DevoteeProfile.create({
            userId: user._id
          });
        }
    }

    // Generate App JWT
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
      token,
    });

  } catch (error) {
    console.error('Firebase login error:', error);
    res.status(500).json({ message: 'Server error during firebase login' });
  }
};

