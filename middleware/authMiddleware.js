// middleware/authMiddleware.js
const admin = require('../config/firebase');
const User = require('../models/user');

// Protect routes - verify Firebase ID token
exports.protect = async (req, res, next) => {
  // Test-only bypass: fetches the real user from DB so role cannot be forged via headers.
  if (process.env.NODE_ENV === 'test' && req.headers['x-test-user-id']) {
    try {
      const user = await User.findById(req.headers['x-test-user-id']).select('-password');
      if (!user) return res.status(401).json({ message: 'Test user not found' });
      req.user = user;
      return next();
    } catch {
      return res.status(401).json({ message: 'Invalid test user ID' });
    }
  }

  try {
    let token;

    // Check if token exists in header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        message: 'Not authorized, no token provided',
      });
    }

    // Verify Firebase token
    // Wrap in a try-catch to differentiate token expiration from db errors
    let decodedToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(token);
    } catch (firebaseError) {
      console.error('Firebase token verification error:', firebaseError.message);
      return res.status(401).json({ message: 'Not authorized, invalid or expired Firebase token' });
    }

    const firebaseUid = decodedToken.uid;

    // Get user from our MongoDB by firebaseUid
    const user = await User.findOne({ firebaseUid }).select('-password');

    if (!user) {
      // NOTE: We do not fail here if they are hitting the /sync route, so we attach firebaseUser.
      // But typically we enforce the user exists. Let's attach both so controllers can decide.
      req.firebaseUser = decodedToken;
      return res
        .status(401)
        .json({ message: 'User profile not found. Please complete registration/sync.' });
    }

    // Add user to request object
    req.user = user;
    req.firebaseUser = decodedToken;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ message: 'Internal server error during authentication' });
  }
};

// Middleware to restrict access to priests (any verification status).
// Use this for onboarding routes (profile setup, document upload, submit-verification).
exports.priestOnly = (req, res, next) => {
  if (req.user && req.user.userType === 'priest') {
    return next();
  }
  res.status(403).json({ message: 'Access denied, priest role required' });
};

// Middleware for priest routes that require admin verification (bookings, earnings, payouts).
exports.verifiedPriestOnly = async (req, res, next) => {
  if (!req.user || req.user.userType !== 'priest') {
    return res.status(403).json({ message: 'Access denied, priest role required' });
  }
  try {
    const PriestProfile = require('../models/priestProfile');
    const profile = await PriestProfile.findOne({ userId: req.user._id })
      .select('isVerified')
      .lean();
    if (!profile || !profile.isVerified) {
      return res.status(403).json({ message: 'Priest account is pending admin verification' });
    }
    next();
  } catch (err) {
    next(err);
  }
};

// Middleware to restrict access to devotee only
exports.devoteeOnly = (req, res, next) => {
  if (req.user && req.user.userType === 'devotee') {
    next();
  } else {
    res.status(403).json({
      message: 'Access denied, devotee role required',
    });
  }
};

// Middleware to restrict access to admin only
exports.adminOnly = (req, res, next) => {
  if (req.user && req.user.userType === 'admin') {
    next();
  } else {
    res.status(403).json({
      message: 'Access denied, admin role required',
    });
  }
};
