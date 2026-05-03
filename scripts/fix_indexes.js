// scripts/fix_indexes.js
const mongoose = require('mongoose');
require('dotenv').config();

async function fixIndexes() {
  try {
    await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const collections = await mongoose.connection.db.listCollections().toArray();
    const bookingsExists = collections.some((c) => c.name === 'bookings');

    if (bookingsExists) {
      console.log('Checking indexes on "bookings" collection...');
      const indexes = await mongoose.connection.db.collection('bookings').indexes();
      console.log('Current indexes:', JSON.stringify(indexes, null, 2));

      const bookingIdIndex = indexes.find((idx) => idx.name === 'bookingId_1');
      if (bookingIdIndex) {
        console.log('Dropping bookingId_1 index...');
        await mongoose.connection.db.collection('bookings').dropIndex('bookingId_1');
        console.log('Index dropped successfully.');
      } else {
        console.log('No bookingId_1 index found.');
      }
    } else {
      console.log('Collection "bookings" does not exist.');
    }

    await mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

fixIndexes();
