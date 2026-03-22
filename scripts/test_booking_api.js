const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load env
dotenv.config({ path: path.join(__dirname, '../.env') });

const Booking = require('../models/booking');
const Ceremony = require('../models/ceremony');
const PriestProfile = require('../models/priestProfile');

// Mock req/res
const req = {
  params: { bookingId: '69b2a4d7cc362c44850e0a44' }, // Use the ID from diagnostics
  user: { id: '694ed6e8e886499b88da725b' } // A valid devotee ID
};

const res = {
  json: (data) => {
    console.log('--- API RESPONSE ---');
    console.log(JSON.stringify(data, null, 2));
    process.exit(0);
  },
  status: (code) => ({
    json: (data) => {
      console.log(`--- API ERROR ${code} ---`);
      console.log(JSON.stringify(data, null, 2));
      process.exit(1);
    }
  })
};

// Import the controller function directly
const bookingController = require('../controllers/bookingController');

async function testApi() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to DB');

    // Run the controller function
    await bookingController.getBookingDetails(req, res);

  } catch (err) {
    console.error('Test error:', err);
    process.exit(1);
  }
}

testApi();
