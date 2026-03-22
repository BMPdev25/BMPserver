
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load env from root
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const Priest = require('../models/priestProfile'); // Fixed path
const User = require('../models/user');
const Booking = require('../models/booking');

const seedConflicts = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, { dbName: 'bmp' });
    console.log('Connected to MongoDB');

    // 1. Find or Create Pandit Sharma (User)
    let priestUser = await User.findOne({ name: 'Pandit Sharma' });
    
    if (!priestUser) {
        console.log('User "Pandit Sharma" not found. Creating him...');
        priestUser = await User.create({
            name: 'Pandit Sharma',
            email: 'pandit.sharma@example.com',
            password: 'password123', // In a real app this should be hashed, assuming dev/test env schema allows plain or handles hashing
            userType: 'priest',
            phone: '9876543210'
        });
    }
    console.log(`Found/Created Priest User: ${priestUser.name} (${priestUser._id})`);

    // 2. Find or Create PriestProfile
    let priestProfile = await Priest.findOne({ userId: priestUser._id });
    if (!priestProfile) {
        console.log('PriestProfile not found. Creating one...');
        priestProfile = await Priest.create({
            userId: priestUser._id,
            experience: 10,
            religiousTradition: 'Vedic',
            description: 'Experienced Pandit',
            isVerified: true,
            currentAvailability: { status: 'available' },
            availability: {
                timeZone: 'Asia/Kolkata',
                weeklySchedule: new Map([
                    ['monday', ['09:00-17:00']],
                    ['tuesday', ['09:00-17:00']],
                    ['wednesday', ['09:00-17:00']],
                    ['thursday', ['09:00-17:00']],
                    ['friday', ['09:00-17:00']],
                    ['saturday', ['09:00-17:00']],
                    ['sunday', ['09:00-17:00']]
                ])
            }
        });
    }
    console.log(`Found/Created Priest Profile: ${priestProfile._id}`);

    // 2. Find or Create Devotee (User)
    let devotee = await User.findOne({ userType: 'devotee' });
    if (!devotee) {
        console.log('No devotee found. Creating "Test Devotee"...');
        devotee = await User.create({
            name: 'Test Devotee',
            email: 'devotee@example.com',
            password: 'password123',
            userType: 'devotee',
            phone: '1234567890'
        });
    }
    console.log(`Found/Created Devotee: ${devotee.name} (${devotee._id})`);

    // 3. Create Confirmed Bookings for Today + 1, Today + 2
    const today = new Date();
    today.setHours(0,0,0,0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const dayAfter = new Date(today);
    dayAfter.setDate(dayAfter.getDate() + 2);

    const bookingsToCreate = [
      {
        date: tomorrow,
        time: '10:00', // 10 AM
        startTime: '10:00',
        endTime: '11:00',
        priestId: priestUser._id,
        devoteeId: devotee._id,
        status: 'confirmed',
        ceremonyType: 'Conflict Test Puja 1',
        location: { address: '123 Test St, Temple City', city: 'Varanasi' },
        price: 1100,
        basePrice: 1045, // 1100 * 0.95
        platformFee: 55, // 1100 * 0.05
        totalAmount: 1100
      },
      {
        date: dayAfter,
        time: '15:00', // 3 PM
        startTime: '15:00',
        endTime: '16:00',
        priestId: priestUser._id,
        devoteeId: devotee._id,
        status: 'confirmed',
        ceremonyType: 'Conflict Test Puja 2',
        location: { address: '456 Devotee Ln, Prayagraj', city: 'Prayagraj' },
        price: 2100,
        basePrice: 1995, // 2100 * 0.95
        platformFee: 105, // 2100 * 0.05
        totalAmount: 2100
      }
    ];

    for (const data of bookingsToCreate) {
      // Check if exists to avoid dupes
      const exists = await Booking.findOne({ 
          priestId: priestUser._id, 
          date: data.date, 
          time: data.time 
      });
      
      if (!exists) {
          await Booking.create(data);
          console.log(`Created booking for ${data.date.toDateString()} at ${data.time}`);
      } else {
          console.log(`Booking for ${data.date.toDateString()} already exists`);
      }
    }

    console.log('Seeding complete');
    process.exit(0);

  } catch (err) {
    console.error('Error seeding:', err);
    if (err.errors) console.error('Validation Errors:', JSON.stringify(err.errors, null, 2));
    process.exit(1);
  }
};

seedConflicts();
