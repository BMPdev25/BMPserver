const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load env
dotenv.config({ path: path.join(__dirname, '../.env') });

const Booking = require('../models/booking');
const Ceremony = require('../models/ceremony');

async function runDiagnostics() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to DB');

    // 1. Get a sample booking
    const booking = await Booking.findOne().sort({ createdAt: -1 });
    if (!booking) {
      console.log('No bookings found in database.');
      process.exit(0);
    }

    console.log('--- Sample Booking ---');
    console.log('ID:', booking._id);
    console.log('Ceremony Type (String):', booking.ceremonyType);

    // 2. Try the lookup logic from the controller
    const lookupName = booking.ceremonyType;
    const ceremony = await Ceremony.findOne({
      name: new RegExp(`^${lookupName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
    });

    if (ceremony) {
      console.log('--- Successfully matched Ceremony ---');
      console.log('Ceremony Name:', ceremony.name);
      console.log('Materials Count:', ceremony.requirements?.materials?.length || 0);
      console.log('Ritual Steps Count:', ceremony.ritualSteps?.length || 0);
    } else {
      console.log('--- FAILED to match Ceremony ---');
      console.log('No ceremony document found with name matching:', lookupName);
      
      // List all available ceremony names to see what we have
      const allCeremonies = await Ceremony.find().select('name');
      console.log('Available Ceremony names in DB:');
      allCeremonies.forEach(c => console.log(` - "${c.name}"`));
    }

    process.exit(0);
  } catch (err) {
    console.error('Diagnostic error:', err);
    process.exit(1);
  }
}

runDiagnostics();
