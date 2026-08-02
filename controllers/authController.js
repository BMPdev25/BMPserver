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
    const {
      userType: rawUserType,
      name,
      phone: bodyPhone,
      pushToken,
      languagesSpoken,
      experience,
      description,
    } = req.body;
    const ALLOWED_USER_TYPES = ['devotee', 'priest'];
    const userType = ALLOWED_USER_TYPES.includes(rawUserType) ? rawUserType : null;

    // Find the user directly by Firebase UID
    let user = await User.findOne({ firebaseUid: uid });

    // Fallback: link existing account to Firebase UID if phone/email matches.
    // Only allowed when the account has no Firebase UID yet — prevents account takeover.
    // Use the phone from either firebase or the request body
    const searchPhone = phone_number || phone;
    
    if (!user && (searchPhone || email)) {
      const orClauses = [];
      if (searchPhone) orClauses.push({ phone: searchPhone });
      if (email) orClauses.push({ email });

      user = orClauses.length ? await User.findOne({ $or: orClauses }) : null;

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

    // Role conflict: an existing account (found either directly via this
    // Firebase UID, or linked above via matching email/phone) belongs to a
    // different userType than the one being registered for. Without this
    // check the caller would be silently logged into their existing role
    // instead of being told to use a different email (account-takeover-
    // adjacent UX bug: a devotee attempting a priest signup with the same
    // email would land back in the devotee account).
    if (user && userType && user.userType !== userType) {
      const ROLE_LABELS = { devotee: 'devotee', priest: 'pandit' };
      return res.status(409).json({
        success: false,
        message: `This email is already registered as a ${ROLE_LABELS[user.userType]}. Please use a different email to register as a ${ROLE_LABELS[userType]}.`,
        code: 'ROLE_CONFLICT',
      });
    }

    // New Registration Flow
    if (!user) {
      // userType validation — return 404 so the client knows to redirect to registration
      if (!userType) {
        return res.status(404).json({ message: 'No account found. Please register to continue.' });
      }
      // Omit email/phone entirely when absent — Mongoose casts `undefined` to
      // `null` when the key is present in the constructor object, which trips
      // the unique sparse index on a second phoneless/emailless signup.
      user = new User({
        name: name || decodedToken.name || 'New User',
        firebaseUid: uid,
        userType: userType,
        expoPushToken: pushToken || null,
        languagesSpoken: Array.isArray(languagesSpoken) ? languagesSpoken : [],
        ...(email ? { email } : {}),
        ...(phone_number ? { phone: phone_number } : bodyPhone ? { phone: bodyPhone } : {}),
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
          description: description || '',
          // Denormalize languages so the priest is searchable immediately
          languagesSpoken: Array.isArray(languagesSpoken) ? languagesSpoken : [],
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

    // Determine profile completion and verification state.
    // profileCompleted = onboarding wizard done (NOT admin approval).
    // verificationStatus and isVerified are priest-only fields.
    let profileCompleted = false;
    let verificationStatus = null;
    let isVerified = false;

    if (user.userType === 'devotee') {
      profileCompleted = !!user.name && user.name !== 'New User';
    } else if (user.userType === 'priest') {
      const PriestProfile = require('../models/priestProfile');
      const profile = await PriestProfile.findOne({ userId: user._id })
        .select('onboardingCompleted isVerified verificationStatus')
        .lean();

      if (!profile) {
        console.warn(`[authSync] No PriestProfile found for priest userId=${user._id} — creating`);
        await PriestProfile.create({
          userId: user._id,
          isVerified: false,
          verificationStatus: 'incomplete',
          onboardingCompleted: false,
          services: [],
          location: { type: 'Point', coordinates: [0, 0] },
          ratings: { average: 0, count: 0 },
          earnings: { totalEarnings: 0, thisMonth: 0, pendingPayments: 0 },
          currentAvailability: { status: 'offline' },
        });
        profileCompleted = false;
        verificationStatus = 'incomplete';
        isVerified = false;
      } else {
        profileCompleted = profile.onboardingCompleted === true;
        verificationStatus = profile.verificationStatus || 'incomplete';
        isVerified = profile.isVerified === true;
      }
    }

    res.status(200).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      userType: user.userType,
      profilePicture: user.profilePicture || null,
      notifications: user.notifications || null,
      profileCompleted,
      verificationStatus,
      isVerified,
    });
  } catch (error) {
    console.error('Firebase sync error:', error);
    res.status(500).json({ 
      message: 'Server error during firebase sync/login', 
      error: error.message,
      stack: error.stack
    });
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
    const normalised = phone.replace(/[\s-]/g, '');
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
    }

    const otp = generateOtp();

    // Send SMS before writing to DB — if SMS fails the old record is untouched and
    // the user can retry immediately without hitting the 60-second rate-limit.
    const smsService = require('../services/smsService');
    await smsService.sendOtp(e164, otp);

    // SMS succeeded — swap the record atomically
    if (recent) await OtpRecord.deleteOne({ phone: e164 });
    await OtpRecord.create({ phone: e164, otp, attempts: 0 });

    if (process.env.NODE_ENV === 'development') {
      console.log(`[DEV] OTP for ${e164}: ${otp}`);
    }
    res.status(200).json({ message: `OTP sent to ${e164}` });
  } catch (error) {
    console.error('Send OTP error:', error);
    res.status(500).json({ message: 'Failed to send OTP. Please try again.' });
  }
};

// Verify OTP → return Firebase custom token
exports.verifyOtp = async (req, res) => {
  try {
    const {
      phone,
      otp,
      userType: rawUserType,
      name,
      languagesSpoken,
      experience,
      description,
    } = req.body;
    const ALLOWED_USER_TYPES = ['devotee', 'priest'];

    if (rawUserType && !ALLOWED_USER_TYPES.includes(rawUserType)) {
      return res.status(400).json({ message: 'Invalid userType. Must be "devotee" or "priest".' });
    }
    const userType = rawUserType || null;

    if (!phone || !otp) {
      return res.status(400).json({ message: 'Phone number and OTP are required.' });
    }

    const normalised = phone.replace(/[\s-]/g, '');
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
      // Atomic increment — prevents race condition where parallel wrong guesses
      // each read the same attempt count and advance it by only 1.
      const updated = await OtpRecord.findOneAndUpdate(
        { phone: e164, _id: record._id },
        { $inc: { attempts: 1 } },
        { new: true }
      );

      if (!updated || updated.attempts >= MAX_ATTEMPTS) {
        await OtpRecord.deleteOne({ phone: e164 });
        return res
          .status(429)
          .json({ message: 'Too many incorrect attempts. Please request a new OTP.' });
      }

      const remaining = MAX_ATTEMPTS - updated.attempts;
      return res.status(400).json({
        message: `Incorrect OTP. ${remaining} attempt(s) remaining.`,
      });
    }

    // Find or create the user in MongoDB by phone number
    // OTP record is deleted AFTER createCustomToken so a Firebase failure does
    // not leave a user who can no longer re-verify their phone.
    let user = await User.findOne({ phone: e164 });

    // Same role-conflict guard as firebaseSync: registering with a userType
    // that doesn't match the existing account for this phone number would
    // otherwise silently mint a token for the wrong role.
    if (user && userType && user.userType !== userType) {
      const ROLE_LABELS = { devotee: 'devotee', priest: 'pandit' };
      return res.status(409).json({
        success: false,
        message: `This phone number is already registered as a ${ROLE_LABELS[user.userType]}. Please use a different phone number to register as a ${ROLE_LABELS[userType]}.`,
        code: 'ROLE_CONFLICT',
      });
    }

    if (!user) {
      if (!userType) {
        return res.status(400).json({
          message: 'userType is required for new registration. Must be "devotee" or "priest".',
        });
      }
      const type = userType;
      user = new User({
        name: name || 'New User',
        phone: e164,
        userType: type,
        // Optional at registration (collected during onboarding for priests), but
        // persisted when the client does provide it so search stays in sync.
        languagesSpoken: Array.isArray(languagesSpoken) ? languagesSpoken : [],
      });
      // Set firebaseUid before the first save: the schema requires `password`
      // unless firebaseUid is present, and OTP users have no password. _id is
      // assigned at instantiation, so it is safe to use here.
      user.firebaseUid = user._id.toString();
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
          experience: experience || 0,
          description: description || '',
          // Denormalize languages so the priest is searchable immediately
          languagesSpoken: Array.isArray(languagesSpoken) ? languagesSpoken : [],
        });
      }
    }

    // Persist firebaseUid BEFORE minting the token so the user is never orphaned if
    // createCustomToken throws. Use the existing firebaseUid (e.g. from Google sign-in)
    // when available so protect() can still resolve the user via its stored lookup key.
    if (!user.firebaseUid) {
      user.firebaseUid = user._id.toString();
      await user.save();
    }
    const tokenUid = user.firebaseUid;

    const customToken = await admin.auth().createCustomToken(tokenUid, {
      phone: e164,
      userType: user.userType,
    });

    // Token minted successfully — safe to consume the OTP now.
    await OtpRecord.deleteOne({ phone: e164 });

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
