// middleware/authMiddleware.js
const admin = require('../config/firebase');
const User = require('../models/user');

// Protect routes - verify Firebase ID token
exports.protect = async (req, res, next) => {
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
      return res.status(401).json({ message: 'User profile not found. Please complete registration/sync.' });
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

// Middleware to restrict access to priest only
exports.priestOnly = (req, res, next) => {
  if (req.user && req.user.userType === 'priest') {
    next();
  } else {
    res.status(403).json({
      message: 'Access denied, priest role required',
    });
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
