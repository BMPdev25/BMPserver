const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');

// Models (Adjust paths if necessary based on your folder structure)
const User = require('../models/user');
const Ceremony = require('../models/ceremony');
const PriestProfile = require('../models/priestProfile');
const Booking = require('../models/booking');
const Rating = require('../models/rating');
const DevoteeProfile = require('../models/devoteeProfile');

dotenv.config();

const seedData = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB Connected');

        // Check if ceremonies exist, if not, warn user to run full_seed.js first or handle it
        const ceremonyCount = await Ceremony.countDocuments();
        if (ceremonyCount === 0) {
            console.log('WARNING: No ceremonies found. Please run full_seed.js first or ensure ceremonies are populated.');
            // For now, we assume ceremonies exist as they are static master data
        }

        const ceremonies = await Ceremony.find({});
        if (ceremonies.length === 0) {
             throw new Error("No ceremonies found to link to priest profiles.");
        }
        
        const satyanarayan = ceremonies.find(c => c.name.includes('Satyanarayan')) || ceremonies[0];
        const grihaPravesh = ceremonies.find(c => c.name.includes('Griha')) || ceremonies[1];

        const salt = await bcrypt.genSalt(10);
        const password = await bcrypt.hash('password123', salt);

        // --- Create Devotees ---
        const devotees = [
            { name: 'Devotee One', email: 'devotee1@example.com', phone: '9000000001' },
            { name: 'Devotee Two', email: 'devotee2@example.com', phone: '9000000002' }
        ];

        for (const d of devotees) {
            let user = await User.findOne({ email: d.email });
            if (!user) {
                user = await User.create({
                    name: d.name,
                    email: d.email,
                    password: password,
                    phone: d.phone,
                    userType: 'devotee'
                });
                // Create Profile
                await DevoteeProfile.create({
                    userId: user._id,
                    preferences: { language: 'English' }
                });
                console.log(`Created Devotee: ${d.email}`);
            } else {
                console.log(`Devotee exists: ${d.email}`);
            }
        }

        // --- Create Priests ---
        const priests = [
            { 
                name: 'Pandit Arul', 
                email: 'priest1@example.com', 
                phone: '8000000001',
                tradition: 'South Indian',
                city: 'Hyderabad',
                services: [
                    { ceremonyId: satyanarayan._id, price: 2100, durationMinutes: 90 },
                    { ceremonyId: grihaPravesh._id, price: 5100, durationMinutes: 180 }
                ]
            },
            { 
                name: 'Acharya Amit', 
                email: 'priest2@example.com', 
                phone: '8000000002',
                tradition: 'North Indian',
                city: 'Delhi',
                services: [
                    { ceremonyId: satyanarayan._id, price: 2500, durationMinutes: 120 }
                ]
            }
        ];

        for (const p of priests) {
            let user = await User.findOne({ email: p.email });
            if (!user) {
                user = await User.create({
                    name: p.name,
                    email: p.email,
                    password: password,
                    phone: p.phone,
                    userType: 'priest'
                });
                
                // Create Priest Profile
                await PriestProfile.create({
                    userId: user._id,
                    experience: 10,
                    religiousTradition: p.tradition,
                    description: `Experienced ${p.tradition} priest.`,
                    services: p.services,
                    location: {
                        type: 'Point',
                        coordinates: p.city === 'Hyderabad' ? [78.4867, 17.3850] : [77.2090, 28.6139]
                    },
                    isVerified: true
                });
                console.log(`Created Priest: ${p.email}`);
            } else {
                console.log(`Priest exists: ${p.email}`);
            }
        }

        console.log('\n--- Seeding Complete ---');
        console.log('Credentials for all users: password123');
        process.exit(0);

    } catch (error) {
        console.error('Seeding Error:', error);
        process.exit(1);
    }
};

seedData();
