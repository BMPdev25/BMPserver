const mongoose = require('mongoose');
const User = require('../models/user');
const Booking = require('../models/booking');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const createBookings = async () => {
  try {
    const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if(!uri) throw new Error("Missing MONGO_URI in env");
    await mongoose.connect(uri);
    console.log('Connected to MongoDB');

    // Find ALL priests
    const priests = await User.find({ userType: 'priest' });
    if (priests.length === 0) throw new Error('No priests found.');
    console.log(`Found ${priests.length} priests. Creating bookings for all.`);

    // Find a client
    let client = await User.findOne({ userType: 'devotee' });
    if (!client) {
         // Fallback to any user who is not the first priest
         client = await User.findOne({ _id: { $ne: priests[0]._id } });
    }
    if (!client) throw new Error('No client user found.');
    console.log('Client used:', client.name);

    for (const priest of priests) {
        console.log(`Processing Priest: ${priest.name} (${priest._id})`);

        // 1. Create Pending Booking (Tomorrow)
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(10, 0, 0, 0);
        
        const existingPending = await Booking.findOne({ 
            priestId: priest._id, 
            status: 'pending',
            date: { $gte: new Date() } 
        });

        if (!existingPending) {
            const pendingBooking = new Booking({
                devoteeId: client._id,
                priestId: priest._id,
                ceremonyType: 'Satyanarayan Puja',
                date: tomorrow,
                startTime: '10:00',
                endTime: '12:00',
                location: {
                    address: '123 Test St, Test City',
                    city: 'Test City',
                    coordinates: [77.5946, 12.9716]
                },
                status: 'pending',
                basePrice: 2100,
                platformFee: 100,
                totalAmount: 2200,
                paymentStatus: 'completed'
            });
            await pendingBooking.save();
            console.log(`  - Created Pending Booking for Tomorrow`);
        } else {
            console.log(`  - Pending booking already exists.`);
        }

        // 2. Create Up Next (Day After Tomorrow) - Confirmed
        const dayAfter = new Date();
        dayAfter.setDate(dayAfter.getDate() + 2);
        dayAfter.setHours(9, 0, 0, 0);

        const existingNext = await Booking.findOne({
            priestId: priest._id,
            status: 'confirmed',
            date: { $gt: tomorrow }
        });

        if (!existingNext) {
            const confirmedBooking = new Booking({
                devoteeId: client._id,
                priestId: priest._id,
                ceremonyType: 'Griha Pravesh',
                date: dayAfter,
                startTime: '08:00',
                endTime: '11:00',
                location: {
                    address: '456 Future Ave, Test City',
                    city: 'Test City',
                    coordinates: [77.6, 12.98]
                },
                status: 'confirmed',
                basePrice: 5100,
                platformFee: 200,
                totalAmount: 5300,
                paymentStatus: 'completed'
            });
            await confirmedBooking.save();
            console.log(`  - Created "Up Next" Confirmed Booking`);
        } else {
            console.log(`  - Up Next booking already exists.`);
        }
        
        // 3. Create Today Booking 
        const existingToday = await Booking.findOne({
            priestId: priest._id,
            date: { 
                $gte: new Date(new Date().setHours(0,0,0,0)),
                $lt: new Date(new Date().setHours(23,59,59,999))
            }
        });

        if(!existingToday) {
            const todayBooking = new Booking({
                devoteeId: client._id,
                priestId: priest._id,
                ceremonyType: 'Evening Aarti',
                date: new Date(), 
                startTime: '18:00',
                endTime: '19:00',
                location: {
                    address: 'Home Temple',
                    city: 'Test City'
                },
                status: 'confirmed',
                basePrice: 501,
                platformFee: 0,
                totalAmount: 501,
                paymentStatus: 'completed'
            });
            await todayBooking.save();
            console.log(`  - Created Today Booking`);
        } else {
            console.log(`  - Today booking already exists.`);
        }
    }
    
    process.exit(0);
  } catch (err) {
      console.error('Error creating bookings:', err);
      process.exit(1);
  }
};

createBookings();
