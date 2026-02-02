// middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const User = require('../models/user');

// Protect routes - verify token
exports.protect = async (req, res, next) => {
  try {
    let token;

    // Check if token exists in header
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        message: 'Not authorized, no token provided'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get user from token
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    // Add user to request object
    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({ message: 'Not authorized, token failed' });
  }
};

// Middleware to restrict access to priest only
exports.priestOnly = (req, res, next) => {
  if (req.user && req.user.userType === 'priest') {
    next();
  } else {
    res.status(403).json({
      message: 'Access denied, priest role required'
    });
  }
};

// Middleware to restrict access to devotee only
exports.devoteeOnly = (req, res, next) => {
  if (req.user && req.user.userType === 'devotee') {
    next();
  } else {
    res.status(403).json({
      message: 'Access denied, devotee role required'
    });
  }
};