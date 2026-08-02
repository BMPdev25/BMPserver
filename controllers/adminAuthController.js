// controllers/adminAuthController.js
const User = require('../models/user');
const admin = require('../config/firebase');

// Admin credentials are verified by Firebase (Identity Toolkit), not local bcrypt.
// The Admin SDK can't check a password itself — only the same REST endpoint the
// client Firebase SDKs use can — so we call it here to keep this a single
// server-side email+password request instead of pushing a Firebase SDK into the
// web-portal. The returned ID token is re-verified with the Admin SDK before we
// trust it, and is what's returned to the caller for subsequent requests (the
// existing protect() middleware already knows how to verify Firebase ID tokens).
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    if (!process.env.FIREBASE_WEB_API_KEY) {
      console.error('FIREBASE_WEB_API_KEY is not configured');
      return res.status(500).json({ success: false, message: 'Admin auth is not configured' });
    }

    let signInData;
    try {
      const firebaseRes = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${process.env.FIREBASE_WEB_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, returnSecureToken: true }),
        }
      );
      signInData = await firebaseRes.json();
      if (!firebaseRes.ok) {
        return res.status(401).json({ success: false, message: 'Invalid credentials' });
      }
    } catch (fetchErr) {
      console.error('Firebase sign-in request failed:', fetchErr);
      return res.status(503).json({ success: false, message: 'Authentication service unavailable' });
    }

    const decodedToken = await admin.auth().verifyIdToken(signInData.idToken);
    const user = await User.findOne({ firebaseUid: decodedToken.uid });

    if (!user || user.userType !== 'admin') {
      return res.status(401).json({ success: false, message: 'Invalid credentials or not authorized' });
    }

    if (!user.isActive) {
      return res.status(403).json({ success: false, message: 'Your administrative account has been deactivated' });
    }

    res.status(200).json({
      success: true,
      data: {
        token: signInData.idToken,
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
