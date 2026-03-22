const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const Booking = require('../models/booking');
const Ceremony = require('../models/ceremony');

async function testProcess() {
  try {
    console.log('--- Phase 1: DB Connection ---');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    console.log('\n--- Phase 2: Ceremony Data Integrity Check ---');
    const allCeremonies = await Ceremony.find();
    console.log(`Found ${allCeremonies.length} ceremonies in master list.`);
    
    const missingSamagri = allCeremonies.filter(c => !c.requirements?.materials || c.requirements.materials.length === 0);
    if (missingSamagri.length > 0) {
      console.warn(`WARNING: ${missingSamagri.length} ceremonies are missing samagri lists:`, missingSamagri.map(c => c.name));
    } else {
      console.log('✅ All ceremonies have samagri lists.');
    }

    console.log('\n--- Phase 3: Booking Lookup Simulation ---');
    const sampleBooking = await Booking.findOne({ ceremonyType: { $exists: true } }).sort({ createdAt: -1 });
    if (!sampleBooking) {
      console.error('❌ No bookings found to test with.');
      process.exit(1);
    }

    console.log(`Testing with Booking ID: ${sampleBooking._id}`);
    console.log(`Ceremony Type in Booking: "${sampleBooking.ceremonyType}"`);

    const searchName = sampleBooking.ceremonyType.trim();
    const ceremony = await Ceremony.findOne({
      name: new RegExp(`^${searchName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
    }).lean();

    if (ceremony) {
      console.log(`✅ MATCH FOUND: "${ceremony.name}"`);
      console.log(` - Materials: ${ceremony.requirements?.materials?.length || 0} items`);
      console.log(` - Ritual Steps: ${ceremony.ritualSteps?.length || 0} steps`);
      console.log(` - History: ${ceremony.history ? 'Present' : 'Missing'}`);
    } else {
      console.error(`❌ FAILED: No ceremony found matching "${searchName}"`);
      console.log('Checking for similar names...');
      const similar = await Ceremony.find({ name: new RegExp(searchName.substring(0, 5), 'i') }).limit(3);
      if (similar.length > 0) {
        console.log('Found similar ceremonies in DB:', similar.map(s => `"${s.name}"`));
      }
    }

    console.log('\n--- Phase 4: Controller Output Simulation ---');
    // Simulate the exact mapping we do in bookingController.js
    if (ceremony) {
        const ceremonyDetails = {
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
            image: ceremony.images?.[0]?.url || null,
        };
        console.log('✅ ceremonyDetails object created successfully.');
        console.log('First material item:', ceremonyDetails.materials[0]);
    }

    console.log('\nVerification Complete.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Diagnostic error:', err);
    process.exit(1);
  }
}

testProcess();
