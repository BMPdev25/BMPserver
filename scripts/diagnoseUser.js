// Diagnostic script to check user and profile data
const mongoose = require('mongoose');
const User = require('../models/user');
const PriestProfile = require('../models/priestProfile');
require('dotenv').config({ path: '../.env' });

async function diagnoseUser() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Get the most recent priest user
    const priests = await User.find({ userType: 'priest' })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('languagesSpoken');

    console.log('\n=== Recent Priest Users ===');
    priests.forEach((priest, index) => {
      console.log(`\n${index + 1}. ${priest.name} (${priest.email})`);
      console.log(`   ID: ${priest._id}`);
      console.log(`   Phone: ${priest.phone}`);
      console.log(`   Languages: ${priest.languagesSpoken?.map(l => l.name).join(', ') || 'None'}`);
      console.log(`   Created: ${priest.createdAt}`);
    });

    // Check profiles for these users
    console.log('\n=== Priest Profiles ===');
    for (const priest of priests) {
      const profile = await PriestProfile.findOne({ userId: priest._id });
      console.log(`\n${priest.name}:`);
      if (profile) {
        console.log(`   Profile exists: YES`);
        console.log(`   Experience: ${profile.experience} years`);
        console.log(`   Services: ${profile.services?.length || 0}`);
        console.log(`   Location set: ${profile.location?.coordinates[0] !== 0 ? 'YES' : 'NO'}`);
        console.log(`   Documents: ${profile.verificationDocuments?.length || 0}`);
        console.log(`   Description: ${profile.description ? 'YES' : 'NO'}`);
      } else {
        console.log(`   Profile exists: NO - NEEDS TO BE CREATED`);
      }
    }

    await mongoose.disconnect();
    console.log('\n✅ Diagnostic complete');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

diagnoseUser();
