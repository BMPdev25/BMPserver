const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load env
dotenv.config({ path: path.join(__dirname, '../.env') });

const Booking = require('../models/booking');
const Ceremony = require('../models/ceremony');
const PriestProfile = require('../models/priestProfile');

async function testApiData() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to DB');

    const bookingId = '69b2a4d7cc362c44850e0a44';
    const booking = await Booking.findById(bookingId)
      .populate('devoteeId', 'name phone email profilePicture rating')
      .populate('priestId', 'name phone email profilePicture');

    if (!booking) {
      console.log('Booking not found');
      process.exit(1);
    }

    // Look up ceremony details by name for structured data
    let ceremonyDetails = null;
    if (booking.ceremonyType) {
      const ceremony = await Ceremony.findOne({
        name: new RegExp(`^${booking.ceremonyType.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
      }).select('name description history category subcategory duration ritualSteps requirements religiousTraditions images').lean();

      if (ceremony) {
        ceremonyDetails = {
          _id: ceremony._id,
          name: ceremony.name,
          description: ceremony.description,
          history: ceremony.history || null,
          category: ceremony.category,
          subcategory: ceremony.subcategory,
          duration: ceremony.duration,
          ritualSteps: ceremony.ritualSteps || [],
          materials: ceremony.requirements?.materials || [],
          specialInstructions: ceremony.requirements?.specialInstructions || [],
          spaceRequirements: ceremony.requirements?.spaceRequirements || null,
          participants: ceremony.requirements?.participants || null,
          image: ceremony.images?.[0]?.url || null,
        };
      }
    }

    const bookingObj = booking.toObject();
    if (ceremonyDetails) {
      bookingObj.ceremonyDetails = ceremonyDetails;
    }

    console.log('--- FINAL BOOKING OBJECT ---');
    console.log(JSON.stringify(bookingObj, null, 2));

    process.exit(0);
  } catch (err) {
    console.error('Test error:', err);
    process.exit(1);
  }
}

testApiData();
