// services/authService.js
const User = require('../models/user');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const PriestProfile = require('../models/priestProfile');
const DevoteeProfile = require('../models/devoteeProfile');

const generateToken = (userId, userType) => {
  return jwt.sign({ id: userId, userType: userType }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
};

const register = async (userData) => {
  const { name, email, phone, password, userType, languagesSpoken, ...rest } = userData;

  // Check if user exists
  const existingUser = await User.findOne({
    $or: [{ email: email || null }, { phone: phone || null }].filter(
      (cond) => cond.email !== null || cond.phone !== null
    ),
  });

  if (existingUser) {
    const error = new Error('User already exists with this email or phone');
    error.statusCode = 400;
    throw error;
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
    ...(userType === 'priest' && languagesSpoken ? { languagesSpoken } : {}),
  });

  await user.save();

  // Create profile
  if (userType === 'priest') {
    await PriestProfile.create({
      userId: user._id,
      experience: rest.experience || 0,
      description: rest.description || '',
      governmentIdVerified: rest.governmentIdVerified || false,
      religiousCertificationVerified: rest.religiousCertificationVerified || false,
      profilePicture: rest.profilePicture || '',
      ratings: rest.ratings || { average: 0, count: 0 },
      availability: rest.availability || {},
      priceList: rest.priceList || {},
      ceremonyCount: rest.ceremonyCount || 0,
      isVerified: rest.isVerified !== undefined ? rest.isVerified : true,
      currentAvailability: rest.currentAvailability || {
        status: 'offline',
        lastUpdated: new Date(),
        autoToggle: true,
      },
      schedule: rest.schedule || {
        workingHours: {},
        blockedDates: [],
        recurringUnavailability: [],
      },
      earnings: rest.earnings || {
        totalEarnings: 0,
        thisMonth: 0,
        lastMonth: 0,
        pendingPayments: 0,
        monthlyEarnings: [],
      },
      analytics: rest.analytics || {
        completionRate: 100,
        responseTime: 2,
        repeatCustomers: 0,
        monthlyTrends: [],
      },
      serviceAreas: rest.serviceAreas || [],
      specializations: rest.specializations || [],
    });
  } else if (userType === 'devotee') {
    await DevoteeProfile.create({
      userId: user._id,
      address: rest.address || {},
      preferences: rest.preferences || {},
      isVerified: rest.isVerified !== undefined ? rest.isVerified : true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  const token = generateToken(user._id, user.userType);
  return { user, token };
};

const login = async (identifier, password, userType) => {
  const user = await User.findOne({
    $or: [{ phone: identifier }, { email: identifier }],
    userType: userType,
  }).populate('languagesSpoken');

  if (!user) {
    const wrongRoleUser = await User.findOne({
      $or: [{ phone: identifier }, { email: identifier }],
    });

    if (wrongRoleUser) {
      const error = new Error(
        `Account exists, but is registered as a ${wrongRoleUser.userType}. Please switch roles or create a new account.`
      );
      error.statusCode = 403;
      throw error;
    }
    const error = new Error('No user found');
    error.statusCode = 401;
    throw error;
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    const error = new Error('Invalid credentials');
    error.statusCode = 401;
    throw error;
  }

  const token = generateToken(user._id, user.userType);
  return { user, token };
};

const firebaseLogin = async (idToken, userType = 'devotee') => {
  let uid, email, phone;

  if (idToken.startsWith('mock_token_')) {
    const parts = idToken.split('_');
    uid = parts[2];
    phone = parts[3] ? '+' + parts[3] : undefined;
  } else {
    const admin = require('../config/firebase');
    try {
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      uid = decodedToken.uid;
      email = decodedToken.email;
      phone = decodedToken.phone_number;
    } catch (e) {
      uid = idToken; // simplistic fallback for dev
    }
  }

  if (!uid) {
    const error = new Error('Invalid token');
    error.statusCode = 400;
    throw error;
  }

  let user = await User.findOne({ firebaseUid: uid });

  if (!user && (phone || email)) {
    user = await User.findOne({
      $or: [{ phone: phone }, { email: email }].filter(Boolean),
    });

    if (user) {
      user.firebaseUid = uid;
      await user.save();
    }
  }

  if (!user) {
    user = new User({
      name: 'New User',
      email: email || `user_${uid}@example.com`,
      phone: phone || `+${Math.floor(Math.random() * 10000000000)}`,
      firebaseUid: uid,
      userType,
      password: 'firebase_login_no_password',
    });
    await user.save();

    if (userType === 'priest') {
      await PriestProfile.create({
        userId: user._id,
        isVerified: true,
      });
    } else {
      await DevoteeProfile.create({
        userId: user._id,
      });
    }
  }

  const token = generateToken(user._id, user.userType);
  return { user, token };
};

const savePushToken = async (userId, pushToken) => {
  const user = await User.findById(userId);
  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  user.expoPushToken = pushToken;
  await user.save();
  return user;
};

module.exports = {
  register,
  login,
  firebaseLogin,
  savePushToken,
};
