// controllers/authController.js
const User = require('../models/user');
const admin = require('../config/firebase');

// Synchronize Firebase User with MongoDB (Login & Signup unified)
exports.firebaseSync = async (req, res) => {
  try {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    } else {
      return res.status(401).json({ message: 'Not authorized, no token provided' });
    }

    // Decode and verify Firebase Token
    let decodedToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(token);
    } catch (firebaseError) {
      console.error('Firebase token verification error (Sync):', firebaseError.message);
      return res.status(401).json({ message: 'Not authorized, invalid or expired Firebase token' });
    }

    const { uid, email, phone_number } = decodedToken;

    // Fields passed during first registration (can be empty on subsequent logins)
    const { userType, name, phone, pushToken, languagesSpoken, experience, description } = req.body;

    // Find the user directly by Firebase UID
    let user = await User.findOne({ firebaseUid: uid });

    // Fallback logic for seamlessly linking existing app users who just moved to Firebase
    if (!user && (phone_number || email)) {
       user = await User.findOne({ 
         $or: [
           { phone: phone_number }, 
           { email: email }
         ].filter(Boolean)
       });
       
       if (user) {
         user.firebaseUid = uid;
         await user.save();
       }
    }

    // New Registration Flow
    if (!user) {
       // userType validation
       if (!userType) {
         return res.status(400).json({ message: 'userType is required for new registration (priest or devotee)' });
       }
       if (userType === 'priest' && (!languagesSpoken || !Array.isArray(languagesSpoken) || languagesSpoken.length === 0)) {
         return res.status(400).json({ message: 'Priests must select at least one language' });
       }

       user = new User({
         name: name || decodedToken.name || 'New User',
         email: email || undefined,
         phone: phone_number || phone || `+tmp${Date.now()}`,
         firebaseUid: uid,
         userType: userType,
         expoPushToken: pushToken || null,
         ...(userType === 'priest' && languagesSpoken ? { languagesSpoken } : {})
       });
       await user.save();

       // Handle Profiles
       if (userType === 'priest') {
          const PriestProfile = require('../models/priestProfile');
          await PriestProfile.create({ 
              userId: user._id, 
              isVerified: true, // Auto-verified for dev purposes; change to false for prod
              experience: experience || 0,
              description: description || ''
          });
       } else if (userType === 'devotee') {
          const DevoteeProfile = require('../models/devoteeProfile');
          await DevoteeProfile.create({ userId: user._id, isVerified: true });
       }
    } else {
        // Update any basic login info on subsequent logins (like pushTokens)
        let isModified = false;
        if (pushToken && user.expoPushToken !== pushToken) {
            user.expoPushToken = pushToken;
            isModified = true;
        }
        if (isModified) await user.save();
    }

    // Determine if profile is populated
    let profileCompleted = true;
    if (user.userType === 'priest') {
        const PriestProfile = require('../models/priestProfile');
        const profile = await PriestProfile.findOne({ userId: user._id });
        if (!profile || !profile.isVerified) {
            profileCompleted = false; // Adjust based on your actual completion criteria
        }
    }

    res.status(200).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      userType: user.userType,
      firebaseUid: user.firebaseUid,
      profileCompleted: profileCompleted
    });

  } catch (error) {
    console.error('Firebase sync error:', error);
    res.status(500).json({ message: 'Server error during firebase sync/login' });
  }
};

// Store Expo Push Token
exports.savePushToken = async (req, res) => {
  try {
    const userId = req.user._id;
    const { pushToken } = req.body;

    if (!pushToken) {
      return res.status(400).json({ message: 'Push token is required' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.expoPushToken = pushToken;
    await user.save();

    res.status(200).json({ message: 'Push token saved successfully' });
  } catch (error) {
    console.error('Save push token error:', error);
    res.status(500).json({ message: 'Server error saving push token', error: error.message });
  }
};

// ─── In-memory OTP store (replace with Redis/DB for production) ───────────────
// Structure: { [phone]: { otp, expiresAt, attempts } }
const otpStore = {};

const OTP_TTL_MS = 5 * 60 * 1000;   // 5 minutes
const MAX_ATTEMPTS = 5;

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Send OTP
exports.sendOtp = async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({ message: 'Phone number is required.' });
    }

    // Normalise: strip spaces/dashes, ensure E.164
    const normalised = phone.replace(/[\s\-]/g, '');
    const e164 = normalised.startsWith('+') ? normalised : `+91${normalised.replace(/^0+/, '')}`;

    if (!/^\+[1-9]\d{7,14}$/.test(e164)) {
      return res.status(400).json({ message: 'Invalid phone number format.' });
    }

    // Rate-limit: don't let a user spam OTP requests
    const existing = otpStore[e164];
    if (existing && Date.now() < existing.expiresAt - (OTP_TTL_MS - 60000)) {
      return res.status(429).json({ message: 'Please wait 1 minute before requesting a new OTP.' });
    }

    const otp = generateOtp();
    otpStore[e164] = { otp, expiresAt: Date.now() + OTP_TTL_MS, attempts: 0 };

    // ── Send SMS ──────────────────────────────────────────────────────────────
    // TODO: plug in your SMS provider here (Twilio, Fast2SMS, etc.)
    // For now, log OTP to console in development
    console.log(`\n📱 OTP for ${e164}: ${otp}\n`);
    // Example Twilio snippet:
    // await twilioClient.messages.create({ body: `Your BookMyPujari OTP: ${otp}`, from: TWILIO_FROM, to: e164 });
    // ─────────────────────────────────────────────────────────────────────────

    res.status(200).json({
      message: `OTP sent to ${e164}`,
      // Only send this in development — remove before production!
      ...(process.env.NODE_ENV === 'development' && { devOtp: otp }),
    });
  } catch (error) {
    console.error('Send OTP error:', error);
    res.status(500).json({ message: 'Failed to send OTP. Please try again.' });
  }
};

// Verify OTP → return Firebase custom token
exports.verifyOtp = async (req, res) => {
  try {
    const { phone, otp, userType } = req.body;

    if (!phone || !otp) {
      return res.status(400).json({ message: 'Phone number and OTP are required.' });
    }

    const normalised = phone.replace(/[\s\-]/g, '');
    const e164 = normalised.startsWith('+') ? normalised : `+91${normalised.replace(/^0+/, '')}`;

    const record = otpStore[e164];

    if (!record) {
      return res.status(400).json({ message: 'OTP not found. Please request a new one.' });
    }

    if (Date.now() > record.expiresAt) {
      delete otpStore[e164];
      return res.status(400).json({ message: 'OTP has expired. Please request a new one.' });
    }

    record.attempts += 1;
    if (record.attempts > MAX_ATTEMPTS) {
      delete otpStore[e164];
      return res.status(429).json({ message: 'Too many incorrect attempts. Please request a new OTP.' });
    }

    if (record.otp !== otp.trim()) {
      return res.status(400).json({ message: `Incorrect OTP. ${MAX_ATTEMPTS - record.attempts} attempt(s) remaining.` });
    }

    // OTP is correct — clean up
    delete otpStore[e164];

    // Find or create the user in MongoDB by phone number
    let user = await User.findOne({ phone: e164 });

    if (!user) {
      // New user — create a basic profile
      const type = userType || 'devotee';
      user = new User({
        name: 'New User',
        phone: e164,
        userType: type,
      });
      await user.save();

      // Create associated profile
      if (type === 'devotee') {
        const DevoteeProfile = require('../models/devoteeProfile');
        await DevoteeProfile.create({ userId: user._id, isVerified: true });
      } else if (type === 'priest') {
        const PriestProfile = require('../models/priestProfile');
        await PriestProfile.create({ userId: user._id, isVerified: false });
      }
    }

    // Create a Firebase custom token so the frontend can sign in via Firebase SDK
    const customToken = await admin.auth().createCustomToken(user._id.toString(), {
      phone: e164,
      userType: user.userType,
    });

    res.status(200).json({
      customToken,
      user: {
        _id: user._id,
        name: user.name,
        phone: user.phone,
        userType: user.userType,
        profileCompleted: !!user.name && user.name !== 'New User',
      },
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ message: 'OTP verification failed. Please try again.' });
  }
};
