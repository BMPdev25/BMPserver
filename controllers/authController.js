// controllers/authController.js
const authService = require('../services/authService');

// Register a new user
exports.register = async (req, res, next) => {
  try {
    const { name, email, phone, password, userType, languagesSpoken } = req.body;

    // Basic validation to prevent 500 errors from empty frontend states
    if (!name || (!email && !phone) || !password || !userType) {
      return res.status(400).json({
        message: 'Name, password, userType, and either email or phone are required.',
      });
    }

    // Validate languagesSpoken for priests
    if (userType === 'priest') {
      if (!languagesSpoken || !Array.isArray(languagesSpoken) || languagesSpoken.length === 0) {
        return res.status(400).json({
          message: 'Priests must select at least one language',
        });
      }
    }

    const { user, token } = await authService.register(req.body);

    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      userType: user.userType,
      profileCompleted: false, // Explicitly false for new users
      token,
    });
  } catch (error) {
    next(error);
  }
};

// Login user
exports.login = async (req, res, next) => {
  try {
    const { identifier, password, userType } = req.body;

    if (!identifier || !password || !userType) {
      return res.status(400).json({ message: 'Identifier, password, and userType are required' });
    }

    const { user, token } = await authService.login(identifier, password, userType);

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
    next(error);
  }
};

// Firebase Login
exports.firebaseLogin = async (req, res, next) => {
  try {
    const { idToken, userType = 'devotee' } = req.body;

    if (!idToken) {
      return res.status(400).json({ message: 'Firebase ID token is required' });
    }

    const { user, token } = await authService.firebaseLogin(idToken, userType);

    res.status(200).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      userType: user.userType,
      token,
    });
  } catch (error) {
    next(error);
  }
};

// Store Expo Push Token
exports.savePushToken = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { pushToken } = req.body;

    if (!pushToken) {
      return res.status(400).json({ message: 'Push token is required' });
    }

    await authService.savePushToken(userId, pushToken);

    res.status(200).json({ message: 'Push token saved successfully' });
  } catch (error) {
    next(error);
  }
};
