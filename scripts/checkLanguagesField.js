// Quick database check for languagesSpoken field
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');

async function checkLanguagesField() {
  try {
    const uri = process.env.MONGODB_URI || process.env.MONGO_URI; 
    console.log('Connecting to:', uri ? 'URI Found' : 'URI Missing');
    if (!uri) throw new Error('MONGODB_URI or MONGO_URI not found in env');

    await mongoose.connect(uri);
    console.log('✅ Connected to MongoDB\n');

    const User = require('../models/user');

    // Count users with and without languagesSpoken field
    const totalUsers = await User.countDocuments({});
    const withField = await User.countDocuments({ languagesSpoken: { $exists: true } });
    const withoutField = await User.countDocuments({ languagesSpoken: { $exists: false } });

    console.log('📊 Database Status:');
    console.log(`   Total users: ${totalUsers}`);
    console.log(`   With languagesSpoken field: ${withField}`);
    console.log(`   Without languagesSpoken field: ${withoutField}`);

    if (withoutField > 0) {
      console.log('\n⚠️  Migration NOT complete - some users missing languagesSpoken field');
    } else {
      console.log('\n✅ Migration complete - all users have languagesSpoken field');
    }

    // List all priests and their languages
    const priests = await User.find({ userType: 'priest' }).populate('languagesSpoken');
    console.log(`\n📋 Found ${priests.length} priests:`);
    
    priests.forEach(p => {
      console.log(`\nUser: ${p.name} (${p.email})`);
      console.log(`   Languages Field Exists: ${p.languagesSpoken !== undefined}`);
      
      if (Array.isArray(p.languagesSpoken)) {
        console.log(`   Count: ${p.languagesSpoken.length}`);
        const langs = p.languagesSpoken.map(l => {
            if (typeof l === 'object' && l.name) return `${l.name} (${l._id})`;
            return l.toString();
        });
        console.log(`   Values: ${JSON.stringify(langs)}`);
      } else {
        console.log(`   Value: ${p.languagesSpoken}`);
      }
    });

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkLanguagesField();
