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
    const { userType, name, pushToken, languagesSpoken, experience, description } = req.body;

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
         phone: phone_number || `+tmp${Date.now()}`,
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
exports.savePushToken = async (req, res, next) => {
  try {
    const userId = req.user._id; // from our middleware
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
