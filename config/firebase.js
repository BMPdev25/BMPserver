const admin = require('firebase-admin');
const dotenv = require('dotenv');

dotenv.config();

// Initialize Firebase Admin with placeholders due to missing serviceAccountKey
// In a real setup, this would use a serviceAccountKey.json
try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log('Firebase Admin initialized successfully');
  } else {
    console.log('Firebase Admin not initialized: Missing FIREBASE_SERVICE_ACCOUNT env var');
    // For development without keys, we might mock verifyIdToken if needed, 
    // but typically we just warn.
  }
} catch (error) {
  console.error('Firebase Admin initialization error:', error);
}

module.exports = admin;
