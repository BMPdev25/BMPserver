// scripts/createAdmin.js
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
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

    const existingUser = await User.findOne({ email });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    if (existingUser) {
      console.log(`User with email ${email} already exists. Updating to admin and setting password...`);
      existingUser.password = hashedPassword;
      existingUser.userType = 'admin';
      existingUser.name = name;
      existingUser.isActive = true;
      existingUser.isVerified = true;
      await existingUser.save();
      console.log(`Admin user updated successfully.`);
    } else {
      console.log(`Creating new admin user: ${email}...`);
      const newAdmin = new User({
        name,
        email,
        password: hashedPassword,
        userType: 'admin',
        isActive: true,
        isVerified: true,
        // Since it's admin, they don't necessarily have a phone number, but let's give a dummy or leave blank
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
