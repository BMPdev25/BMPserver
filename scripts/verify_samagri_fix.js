/**
 * Final verification of the 3-level ceremony lookup fallback
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Ceremony = require('../models/ceremony');

async function verify() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
    console.log('Connected\n');

    const rawBookings = await mongoose.connection.db.collection('bookings')
      .find({}).sort({ createdAt: -1 }).limit(10).toArray();

    const selectFields = 'name description history category subcategory duration ritualSteps requirements religiousTraditions images';
    let matchCount = 0;

    for (const b of rawBookings) {
      let ceremony = null;
      let ceremonyDetails = null;
      let strategy = 'none';

      // Strategy 1: ceremonyType string name
      if (b.ceremonyType) {
        const searchName = b.ceremonyType.trim();
        ceremony = await Ceremony.findOne({
          name: new RegExp(`^${searchName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
        }).select(selectFields).lean();
        if (ceremony) strategy = 'ceremonyType → ceremonies';
      }

      // Strategy 2: puja ObjectId → ceremonies
      if (!ceremony && b.puja) {
        try {
          ceremony = await Ceremony.findById(b.puja).select(selectFields).lean();
          if (ceremony) strategy = 'puja → ceremonies';
        } catch {}
      }

      // Strategy 3: puja ObjectId → pujas → cross-ref ceremonies
      if (!ceremony && !ceremonyDetails && b.puja) {
        const legacyPuja = await mongoose.connection.db.collection('pujas').findOne({ _id: new mongoose.Types.ObjectId(b.puja) });
        if (legacyPuja?.name) {
          ceremony = await Ceremony.findOne({
            name: new RegExp(`^${legacyPuja.name.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
          }).select(selectFields).lean();
          if (ceremony) {
            strategy = `puja → pujas ("${legacyPuja.name}") → ceremonies`;
          } else {
            // Construct from legacy
            const mats = legacyPuja.whatsIncluded || [];
            ceremonyDetails = {
              name: legacyPuja.name,
              materials: mats.map(i => typeof i === 'string' ? { name: i } : i),
            };
            strategy = `puja → pujas ("${legacyPuja.name}") → legacy fallback`;
          }
        }
      }

      if (ceremony) {
        ceremonyDetails = {
          name: ceremony.name,
          materials: ceremony.requirements?.materials || [],
          ritualSteps: ceremony.ritualSteps || [],
        };
      }

      const matCount = ceremonyDetails?.materials?.length || 0;
      const matched = !!ceremonyDetails;
      if (matched) matchCount++;
      console.log(`${matched ? '✅' : '❌'} ${b._id} | ${strategy} | ${matCount} materials`);
    }

    console.log(`\n${matchCount}/${rawBookings.length} bookings matched.`);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await mongoose.disconnect();
  }
}

verify();
