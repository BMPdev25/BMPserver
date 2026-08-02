// controllers/adminAuthController.js
const User = require('../models/user');
const jwt = require('jsonwebtoken');

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const user = await User.findOne({ email });

    if (!user || user.userType !== 'admin') {
      return res.status(401).json({ success: false, message: 'Invalid credentials or not authorized' });
    }

    if (!user.isActive) {
      return res.status(403).json({ success: false, message: 'Your administrative account has been deactivated' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user._id, userType: user.userType },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(200).json({
      success: true,
      data: {
        token,
        admin: {
          _id: user._id,
          name: user.name,
          email: user.email,
          userType: user.userType,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.me = async (req, res, next) => {
  try {
    if (!req.user || req.user.userType !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    res.status(200).json({
      success: true,
      data: {
        _id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        userType: req.user.userType,
      },
    });
  } catch (error) {
    next(error);
  }
};
