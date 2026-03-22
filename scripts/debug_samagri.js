/**
 * Diagnostic script: checks why samagri is not visible
 * Tests: 1) DB ceremony data, 2) Booking->Ceremony name match, 3) Materials presence
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Ceremony = require('../models/ceremony');
const Booking = require('../models/booking');

async function diagnose() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
    console.log('Connected to MongoDB\n');

    // 1. Check all ceremonies and their materials count
    console.log('=== STEP 1: All Ceremonies in DB ===');
    const ceremonies = await Ceremony.find({}).select('name isActive requirements.materials').lean();
    console.log(`Total ceremonies: ${ceremonies.length}`);
    ceremonies.forEach(c => {
      const matCount = c.requirements?.materials?.length || 0;
      console.log(`  [${c.isActive ? 'ACTIVE' : 'INACTIVE'}] "${c.name}" → ${matCount} materials`);
    });

    // 2. Check all bookings and their ceremonyType
    console.log('\n=== STEP 2: Recent Bookings ===');
    const bookings = await Booking.find({}).sort({ createdAt: -1 }).limit(10).select('ceremonyType status createdAt').lean();
    console.log(`Total recent bookings: ${bookings.length}`);
    bookings.forEach(b => {
      console.log(`  "${b.ceremonyType}" (${b.status}) - ${b._id}`);
    });

    // 3. Test ceremony lookup for each booking
    console.log('\n=== STEP 3: Ceremony Lookup Test ===');
    for (const b of bookings) {
      if (!b.ceremonyType) {
        console.log(`  Booking ${b._id}: NO ceremonyType set!`);
        continue;
      }
      const searchName = b.ceremonyType.trim();
      const ceremony = await Ceremony.findOne({
        name: new RegExp(`^${searchName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
      }).select('name requirements.materials ritualSteps history').lean();

      if (!ceremony) {
        console.log(`  ❌ "${b.ceremonyType}" → NO MATCH in Ceremony collection!`);
      } else {
        const matCount = ceremony.requirements?.materials?.length || 0;
        const stepCount = ceremony.ritualSteps?.length || 0;
        const hasHistory = !!ceremony.history;
        console.log(`  ✅ "${b.ceremonyType}" → MATCH "${ceremony.name}" | ${matCount} materials, ${stepCount} steps, history: ${hasHistory}`);
      }
    }

    // 4. Simulate the exact controller output for one booking
    console.log('\n=== STEP 4: Simulate Controller Output ===');
    if (bookings.length > 0) {
      const testBooking = bookings[0];
      const searchName = testBooking.ceremonyType?.trim();
      if (searchName) {
        const ceremony = await Ceremony.findOne({
          name: new RegExp(`^${searchName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
        }).select('name description history category subcategory duration ritualSteps requirements religiousTraditions images').lean();

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
            spaceRequirements: ceremony.requirements?.spaceRequirements || null,
            participants: ceremony.requirements?.participants || null,
            image: ceremony.images?.[0]?.url || null,
          };
          console.log(`  ceremonyDetails.materials length: ${ceremonyDetails.materials.length}`);
          console.log(`  ceremonyDetails.ritualSteps length: ${ceremonyDetails.ritualSteps.length}`);
          if (ceremonyDetails.materials.length > 0) {
            console.log(`  First material: ${JSON.stringify(ceremonyDetails.materials[0])}`);
          }
          console.log(`  Full ceremonyDetails keys: ${Object.keys(ceremonyDetails).join(', ')}`);
        } else {
          console.log(`  No ceremony found for "${searchName}"`);
        }
      }
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await mongoose.disconnect();
    console.log('\nDone.');
  }
}

diagnose();
