// controllers/authController.js
const User = require('../models/user');
const OtpRecord = require('../models/otp');
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

    // Fallback: link existing account to Firebase UID if phone/email matches.
    // Only allowed when the account has no Firebase UID yet — prevents account takeover.
    if (!user && (phone_number || email)) {
      user = await User.findOne({
        $or: [
          { phone: phone_number },
          { email: email },
        ].filter(Boolean),
      });

      if (user) {
        if (user.firebaseUid && user.firebaseUid !== uid) {
          // Account already belongs to a different Firebase UID — reject to prevent takeover
          return res.status(409).json({
            success: false,
            message: 'An account with this phone or email already exists. Please log in.',
            code: 'ACCOUNT_EXISTS',
          });
        }
        if (!user.firebaseUid) {
          user.firebaseUid = uid;
          await user.save();
        }
      }
    }

    // New Registration Flow
    if (!user) {
       // userType validation — return 404 so the client knows to redirect to registration
       if (!userType) {
         return res.status(404).json({ message: 'No account found. Please register to continue.' });
       }
       user = new User({
         name: name || decodedToken.name || 'New User',
         email: email || undefined,
         phone: phone_number || phone || null,
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
              isVerified: false,
              verificationStatus: 'incomplete',
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
    let profileCompleted = !!user.name && user.name !== 'New User';
    if (user.userType === 'priest' && profileCompleted) {
        const PriestProfile = require('../models/priestProfile');
        const profile = await PriestProfile.findOne({ userId: user._id });
        if (!profile || !profile.isVerified) {
            profileCompleted = false;
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
exports.savePushToken = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { pushToken } = req.body;

    if (!pushToken) {
      return res.status(400).json({ message: 'Push token is required' });
    }

    await User.findByIdAndUpdate(userId, { expoPushToken: pushToken });

    res.status(200).json({ message: 'Push token saved successfully' });
  } catch (error) {
    next(error);
  }
};

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

    // Rate-limit: block if an OTP was created within the last 60 seconds
    const recent = await OtpRecord.findOne({ phone: e164 });
    if (recent) {
      const secondsSince = (Date.now() - recent.createdAt.getTime()) / 1000;
      if (secondsSince < 60) {
        return res.status(429).json({
          message: `Please wait ${Math.ceil(60 - secondsSince)} seconds before requesting another OTP.`,
        });
      }
      await OtpRecord.deleteOne({ phone: e164 });
    }

    const otp = generateOtp();
    await OtpRecord.create({ phone: e164, otp, attempts: 0 });

    // TODO: plug in your SMS provider here (Twilio, Fast2SMS, etc.)
    console.log(`\nOTP for ${e164}: ${otp}\n`);

    res.status(200).json({
      message: `OTP sent to ${e164}`,
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

    const record = await OtpRecord.findOne({ phone: e164 });

    if (!record) {
      return res.status(400).json({ message: 'OTP not found. Please request a new one.' });
    }

    // MongoDB TTL handles expiry, but double-check in case TTL sweep is delayed
    const ageSeconds = (Date.now() - record.createdAt.getTime()) / 1000;
    if (ageSeconds > 600) {
      await OtpRecord.deleteOne({ phone: e164 });
      return res.status(400).json({ message: 'OTP has expired. Please request a new one.' });
    }

    if (record.otp !== otp.trim()) {
      record.attempts += 1;
      await record.save();

      if (record.attempts >= MAX_ATTEMPTS) {
        await OtpRecord.deleteOne({ phone: e164 });
        return res.status(429).json({ message: 'Too many incorrect attempts. Please request a new OTP.' });
      }

      const remaining = MAX_ATTEMPTS - record.attempts;
      return res.status(400).json({
        message: `Incorrect OTP. ${remaining} attempt(s) remaining.`,
      });
    }

    // OTP is correct — clean up
    await OtpRecord.deleteOne({ phone: e164 });

    // Find or create the user in MongoDB by phone number
    let user = await User.findOne({ phone: e164 });

    if (!user) {
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
        await PriestProfile.create({
          userId: user._id,
          isVerified: false,
          verificationStatus: 'incomplete',
        });
      }
    }

    // Create a Firebase custom token so the frontend can sign in via Firebase SDK.
    // Use user._id as the Firebase uid so protect() can find the user by firebaseUid.
    const customToken = await admin.auth().createCustomToken(user._id.toString(), {
      phone: e164,
      userType: user.userType,
    });

    // Store the Firebase uid on the user record so protect() can resolve it
    if (!user.firebaseUid) {
      user.firebaseUid = user._id.toString();
      await user.save();
    }

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
