// scripts/createAdmin.js
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const admin = require('../config/firebase');
const User = require('../models/user');

dotenv.config();

const createAdmin = async () => {
  const args = process.argv.slice(2);
  const email = args[0] || 'admin@bookmypujari.com';
  const password = args[1] || 'Admin@123';
  const name = args[2] || 'Super Admin';

  try {
    console.log(`Connecting to MongoDB...`);
    await mongoose.connect(process.env.MONGO_URI, { dbName: 'bmp' });
    console.log(`Connected to database.`);

    // Firebase Auth is the source of truth for admin login credentials.
    let firebaseUser;
    try {
      firebaseUser = await admin.auth().getUserByEmail(email);
      await admin.auth().updateUser(firebaseUser.uid, { password, displayName: name });
      console.log(`Firebase Auth user already existed for ${email}; password updated.`);
    } catch (err) {
      if (err.code === 'auth/user-not-found') {
        firebaseUser = await admin.auth().createUser({ email, password, displayName: name });
        console.log(`Firebase Auth user created for ${email}.`);
      } else {
        throw err;
      }
    }

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      console.log(`User with email ${email} already exists. Updating to admin and linking Firebase...`);
      existingUser.userType = 'admin';
      existingUser.name = name;
      existingUser.isActive = true;
      existingUser.isVerified = true;
      existingUser.firebaseUid = firebaseUser.uid;
      await existingUser.save();
      console.log(`Admin user updated successfully.`);
    } else {
      console.log(`Creating new admin user: ${email}...`);
      const newAdmin = new User({
        name,
        email,
        userType: 'admin',
        isActive: true,
        isVerified: true,
        firebaseUid: firebaseUser.uid,
      });
      await newAdmin.save();
      console.log(`Admin user created successfully.`);
    }
  } catch (error) {
    console.error('Error creating admin:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
    process.exit();
  }
};

createAdmin();
