const admin = require('firebase-admin');
const dotenv = require('dotenv');

dotenv.config();

// Initialize Firebase Admin with placeholders due to missing serviceAccountKey
// In a real setup, this would use a serviceAccountKey.json
try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    let accountStr = process.env.FIREBASE_SERVICE_ACCOUNT;
    // Strip surrounding single or double quotes if present
    if ((accountStr.startsWith("'") && accountStr.endsWith("'")) || (accountStr.startsWith('"') && accountStr.endsWith('"'))) {
      accountStr = accountStr.slice(1, -1);
    }
    const serviceAccount = JSON.parse(accountStr);
    // Crucial fix: dotenv sometimes escapes \n as literal string \\n. 
    // We must ensure the private key has actual newline characters to form a valid PEM.
    if (serviceAccount.private_key) {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    }
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
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
