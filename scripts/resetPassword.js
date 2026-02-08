/**
 * Password Reset Script for Sacred Connect
 * 
 * Usage: node scripts/resetPassword.js <email> <new_password>
 * Example: node scripts/resetPassword.js devotee@example.com newpassword123
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');

dotenv.config();

const User = require('../models/user');

const resetPassword = async () => {
  const email = process.argv[2];
  const newPassword = process.argv[3];

  if (!email || !newPassword) {
    console.log('Usage: node scripts/resetPassword.js <email> <new_password>');
    console.log('Example: node scripts/resetPassword.js devotee@example.com newpassword123');
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB Connected');

    const user = await User.findOne({ email });
    
    if (!user) {
      console.log(`❌ No user found with email: ${email}`);
      console.log('\nAvailable test users:');
      console.log('  - devotee@example.com (password123)');
      console.log('  - priest1@example.com (password123)');
      console.log('  - priest2@example.com (password123)');
      console.log('  - sunny@bmp.com (123456)');
      console.log('  - anish@bmp.com (123456)');
      console.log('  - anirudh@bmp.com (123456)');
      process.exit(1);
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    
    user.password = hashedPassword;
    await user.save();

    console.log(`✅ Password reset successfully for: ${email}`);
    console.log(`   New password: ${newPassword}`);
    console.log(`   User type: ${user.userType}`);
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
};

resetPassword();
