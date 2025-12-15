const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');

// Models
const User = require('../models/user');
const Ceremony = require('../models/ceremony');
const PriestProfile = require('../models/priestProfile');
const Booking = require('../models/booking');
const Rating = require('../models/rating');

dotenv.config();

const ceremoniesData = [
  {
    name: 'Satyanarayan Puja',
    description: 'A puja performed to seek the blessings of Lord Satyanarayan, a form of Lord Vishnu.',
    category: 'puja',
    subcategory: 'general',
    duration: { typical: 120, minimum: 90, maximum: 180 },
    pricing: { basePrice: 2100, priceRange: { min: 2100, max: 5100 } },
    requirements: {
      materials: [
        { name: 'Kumkum', quantity: '1 packet' },
        { name: 'Turmeric', quantity: '1 packet' },
        { name: 'Rice', quantity: '1 kg' },
        { name: 'Betel leaves', quantity: '20' },
        { name: 'Flowers', quantity: '2 garlands' },
        { name: 'Fruits', quantity: '5 types' }
      ]
    },
    religiousTraditions: ['Hindu'],
    images: [{ url: 'https://images.unsplash.com/photo-1605656114881-229202c61172?q=80&w=600&auto=format&fit=crop', alt: 'Satyanarayan Puja', isPrimary: true }]
  },
  {
    name: 'Griha Pravesh',
    description: 'Housewarming ceremony performed before moving into a new house.',
    category: 'housewarming',
    subcategory: 'general',
    duration: { typical: 180, minimum: 120, maximum: 240 },
    pricing: { basePrice: 5100, priceRange: { min: 5100, max: 11000 } },
    requirements: {
       materials: [
         { name: 'Coconut', quantity: '2' },
         { name: 'Mango leaves', quantity: '1 bunch' },
         { name: 'Ghee', quantity: '500g' }
       ]
    },
    religiousTraditions: ['Hindu'],
    images: [{ url: 'https://images.unsplash.com/photo-1545638555-9cebb8c3132d?q=80&w=600&auto=format&fit=crop', alt: 'Griha Pravesh', isPrimary: true }]
  },
  {
    name: 'Ganapati Homa',
    description: 'Homa performed to Lord Ganesha to remove obstacles and seek success.',
    category: 'puja',
    subcategory: 'homa',
    duration: { typical: 90, minimum: 60, maximum: 120 },
    pricing: { basePrice: 3100, priceRange: { min: 3100, max: 7100 } },
    requirements: {
       materials: [
         { name: 'Modak', quantity: '21' },
         { name: 'Durva grass', quantity: '1 bunch' }
       ]
    },
    religiousTraditions: ['Hindu'],
    images: [{ url: 'https://images.unsplash.com/photo-1563868694038-a89c3a32506e?q=80&w=600&auto=format&fit=crop', alt: 'Ganapati', isPrimary: true }]
  }
];

const seedDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB Connected');

    // CLEAR DB
    await User.deleteMany({});
    await Ceremony.deleteMany({});
    await PriestProfile.deleteMany({});
    await Booking.deleteMany({});
    await Rating.deleteMany({});
    console.log('Database cleared');

    // 1. CREATE CEREMONIES
    const createdCeremonies = await Ceremony.insertMany(ceremoniesData);
    console.log('Ceremonies seeded');
    const satyanarayan = createdCeremonies.find(c => c.name === 'Satyanarayan Puja');
    const grihaPravesh = createdCeremonies.find(c => c.name === 'Griha Pravesh');

    // 2. CREATE USERS
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('password123', salt);

    // Devotee
    const devotee = await User.create({
      name: 'Rohan Gupta',
      email: 'devotee@example.com',
      password: hashedPassword,
      userType: 'devotee',
      phone: '9876543210'
    });

    // Priest 1
    const priest1 = await User.create({
      name: 'Pandit Sharma',
      email: 'priest1@example.com',
      password: hashedPassword,
      userType: 'priest',
      phone: '9876543211'
    });

    // Priest 2
    const priest2 = await User.create({
      name: 'Acharya Mishra',
      email: 'priest2@example.com',
      password: hashedPassword,
      userType: 'priest',
      phone: '9876543212'
    });
    console.log('Users seeded');

    // 3. CREATE PRIEST PROFILES
    const priest1Profile = await PriestProfile.create({
      userId: priest1._id,
      experience: 15,
      religiousTradition: 'North Indian',
      description: 'Experienced Vedic Pandit performing all types of pujas.',
      languages: ['Hindi', 'Sanskrit', 'English'],
      profilePicture: 'https://images.unsplash.com/photo-1594950920630-9b3780330455?q=80&w=200&auto=format&fit=crop',
      location: {
        type: 'Point',
        coordinates: [78.35, 17.45] // Hyderabad
      },
      services: [
        { ceremonyId: satyanarayan._id, price: 2500, durationMinutes: 120 },
        { ceremonyId: grihaPravesh._id, price: 5500, durationMinutes: 180 }
      ],
      isVerified: true,
      rating: { average: 4.8, count: 1 }
    });

    const priest2Profile = await PriestProfile.create({
      userId: priest2._id,
      experience: 25,
      religiousTradition: 'South Indian',
      description: 'Expert in South Indian traditions and Homas.',
      languages: ['Telugu', 'Sanskrit', 'Hindi'],
      profilePicture: 'https://images.unsplash.com/photo-1518385289945-8c707d87bc7d?q=80&w=200&auto=format&fit=crop',
      location: {
        type: 'Point',
        coordinates: [78.40, 17.40] // Hyderabad slightly far
      },
      services: [
        { ceremonyId: satyanarayan._id, price: 2200, durationMinutes: 110 }
      ],
      isVerified: true,
      rating: { average: 0, count: 0 }
    });
    console.log('Priest Profiles seeded');

    // 4. CREATE BOOKINGS
    let booking1;
    try {
        booking1 = await Booking.create({
            devoteeId: devotee._id,
            priestId: priest1._id,
            ceremonyId: satyanarayan._id,
            ceremonyType: satyanarayan.name,
            date: new Date(Date.now() + 86400000), // Tomorrow
            startTime: '10:00',
            endTime: '12:00',
            status: 'confirmed',
            paymentStatus: 'completed', // 'paid' was invalid
            basePrice: 2000,
            platformFee: 500,
            totalAmount: 2500,
            location: {
                address: 'Devotee Home, Hyderabad',
                city: 'Hyderabad',
                coordinates: [78.35, 17.45]
            }
        });
        console.log('Booking seeded');
    } catch (e) {
        console.log('Skipping booking seed (model might differ):', e.message);
    }
    
    // 5. CREATE RATINGS
    try {
        if (booking1) {
            await Rating.create({
                bookingId: booking1._id.toString(),
                userId: devotee._id.toString(), // Schema says type: String
                priestId: priest1._id.toString(),
                rating: 5,
                categories: {
                    punctuality: 5,
                    knowledge: 5,
                    behavior: 5,
                    overall: 5
                },
                review: 'Pandit ji was very knowledgeable and punctual.',
                ceremonyType: satyanarayan.name,
                ceremonyDate: new Date().toISOString(),
                createdAt: new Date()
            });
            console.log('Rating seeded');
        }
    } catch (e) {
         console.log('Skipping rating seed:', e.message);
    }

    process.exit();
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
};

seedDB();
