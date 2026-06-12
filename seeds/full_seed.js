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
    description:
      'A puja performed to seek the blessings of Lord Satyanarayan, a form of Lord Vishnu.',
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
        { name: 'Fruits', quantity: '5 types' },
      ],
    },
    religiousTraditions: ['Hindu'],
    images: [
      { url: 'http://192.168.29.44:5000/public/images/satyanarayan.jpg', alt: 'Satyanarayan Puja', isPrimary: true },
    ],
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
        { name: 'Ghee', quantity: '500g' },
      ],
    },
    religiousTraditions: ['Hindu'],
    images: [
      { url: 'http://192.168.29.44:5000/public/images/grihapravesh.jpg', alt: 'Griha Pravesh', isPrimary: true },
    ],
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
        { name: 'Durva grass', quantity: '1 bunch' },
      ],
    },
    religiousTraditions: ['Hindu'],
    images: [
      { url: 'http://192.168.29.44:5000/public/images/ganapati.jpg', alt: 'Ganapati', isPrimary: true },
    ],
  },
  {
    name: 'Ganapati Homam',
    description:
      'A Vedic fire ritual (havan) dedicated to Lord Ganesha for removing obstacles and bestowing success. ' +
      'Performed with chanting of Ganapati Atharvashirsha and systematic ahuti offerings.',
    category: 'homam',
    subcategory: 'ganapati',
    duration: { typical: 120, minimum: 90, maximum: 150 },
    pricing: { basePrice: 4100, priceRange: { min: 4100, max: 9100 } },
    requirements: {
      materials: [
        { name: 'Havan samagri (mixed herbs)', quantity: '500g' },
        { name: 'Ghee (clarified butter)', quantity: '250g' },
        { name: 'Durva grass', quantity: '1 bunch' },
        { name: 'Modak', quantity: '21' },
        { name: 'Red flowers', quantity: '1 garland' },
      ],
      specialInstructions:
        'Participants should fast or eat a light meal. The ceremony space must be ventilated.',
    },
    ritualSteps: [
      { stepNumber: 1, title: 'Kunda Nirman', description: 'Preparing and purifying the havan kunda.', durationEstimate: 10 },
      { stepNumber: 2, title: 'Sankalpam', description: "Declaring the devotee's intention.", durationEstimate: 10 },
      { stepNumber: 3, title: 'Ganapati Avahana', description: 'Inviting Lord Ganesha through mantra.', durationEstimate: 15 },
      { stepNumber: 4, title: 'Agni Sthapana', description: 'Lighting the sacred havan fire.', durationEstimate: 15 },
      { stepNumber: 5, title: 'Ahuti (108 offerings)', description: 'Making 108 ahuti offerings while chanting Ganapati Atharvashirsha.', durationEstimate: 45 },
      { stepNumber: 6, title: 'Purnahuti & Aarti', description: 'Final grand offering and Aarti.', durationEstimate: 15 },
    ],
    religiousTraditions: ['Hindu'],
    images: [
      { url: 'http://192.168.29.44:5000/public/images/ganapati-homam.jpg', alt: 'Ganapati Homam', isPrimary: true },
    ],
    isActive: true,
  },
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
    const satyanarayan = createdCeremonies.find((c) => c.name === 'Satyanarayan Puja');
    const grihaPravesh = createdCeremonies.find((c) => c.name === 'Griha Pravesh');
    const ganapatiHomam = createdCeremonies.find((c) => c.name === 'Ganapati Homam');

    // 2. CREATE USERS
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('password123', salt);
    const testPassword = await bcrypt.hash('123456', salt);

    // Devotee
    const devotee = await User.create({
      name: 'Rohan Gupta',
      email: 'devotee@example.com',
      password: hashedPassword,
      userType: 'devotee',
      phone: '9876543210',
    });

    // Test Users
    await User.create([
      { name: 'Sunny', email: 'sunny@bmp.com', password: testPassword, userType: 'devotee', phone: '9999999991' },
      { name: 'Anish', email: 'anish@bmp.com', password: testPassword, userType: 'devotee', phone: '9999999992' },
      { name: 'Anirudh', email: 'anirudh@bmp.com', password: testPassword, userType: 'devotee', phone: '9999999993' },
    ]);

    // Priest 1
    const priest1 = await User.create({
      name: 'Pandit Sharma',
      email: 'priest1@example.com',
      password: hashedPassword,
      userType: 'priest',
      phone: '9876543211',
    });

    // Priest 2
    const priest2 = await User.create({
      name: 'Acharya Mishra',
      email: 'priest2@example.com',
      password: hashedPassword,
      userType: 'priest',
      phone: '9876543212',
    });
    console.log('Users seeded');

    // 3. CREATE PRIEST PROFILES
    await PriestProfile.create({
      userId: priest1._id,
      experience: 15,
      religiousTradition: 'North Indian',
      description: 'Experienced Vedic Pandit performing all types of pujas and havans.',
      languages: ['Hindi', 'Sanskrit', 'English'],
      profilePicture: 'http://192.168.29.44:5000/public/images/priest1.jpg',
      location: { type: 'Point', coordinates: [78.35, 17.45] },
      services: [
        { ceremonyId: satyanarayan._id, price: 2500, durationMinutes: 120 },
        { ceremonyId: grihaPravesh._id, price: 5500, durationMinutes: 180 },
        { ceremonyId: ganapatiHomam._id, price: 4500, durationMinutes: 120 },
      ],
      isVerified: true,
      rating: { average: 4.8, count: 1 },
    });

    await PriestProfile.create({
      userId: priest2._id,
      experience: 25,
      religiousTradition: 'South Indian',
      description: 'Expert in South Indian traditions, Homas, and Havans.',
      languages: ['Telugu', 'Sanskrit', 'Hindi'],
      profilePicture: 'http://192.168.29.44:5000/public/images/priest2.jpg',
      location: { type: 'Point', coordinates: [78.4, 17.4] },
      services: [
        { ceremonyId: satyanarayan._id, price: 2200, durationMinutes: 110 },
        { ceremonyId: ganapatiHomam._id, price: 4200, durationMinutes: 120 },
      ],
      isVerified: true,
      rating: { average: 0, count: 0 },
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
        date: new Date(Date.now() + 86400000),
        startTime: '10:00',
        endTime: '12:00',
        status: 'confirmed',
        paymentStatus: 'completed',
        basePrice: 2000,
        platformFee: 500,
        totalAmount: 2500,
        location: {
          address: 'Devotee Home, Hyderabad',
          city: 'Hyderabad',
          coordinates: [78.35, 17.45],
        },
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
          userId: devotee._id.toString(),
          priestId: priest1._id.toString(),
          rating: 5,
          categories: { punctuality: 5, knowledge: 5, behavior: 5, overall: 5 },
          review: 'Pandit ji was very knowledgeable and punctual.',
          ceremonyType: satyanarayan.name,
          ceremonyDate: new Date().toISOString(),
          createdAt: new Date(),
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
