const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/user');
const PriestProfile = require('../models/priestProfile');
const Ceremony = require('../models/ceremony');

dotenv.config();

const seedPriests = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB Connected');

    // 1. Get Ceremonies
    const satyanarayan = await Ceremony.findOne({ name: 'Satyanarayan Puja' });
    const grihaPravesh = await Ceremony.findOne({ name: 'Griha Pravesh' });

    if (!satyanarayan || !grihaPravesh) {
      console.log('Ceremonies not found. Run seeds/ceremonies.js first.');
      process.exit(1);
    }

    // 2. Find or Create a User to be Priest
    // This assumes a user exists, or creates one. For safety, let's create a new dummy user.
    const priestEmail = 'priest_demo@example.com';
    let user = await User.findOne({ email: priestEmail });
    
    if (!user) {
      user = await User.create({
        name: 'Pandit Sharma',
        email: priestEmail,
        password: 'password123',
        userType: 'priest',
        phone: '9876543210'
      });
      console.log('Created dummy priest user');
    }

    // 3. Create Priest Profile
    await PriestProfile.deleteMany({ userId: user._id });

    const profile = new PriestProfile({
      userId: user._id,
      experience: 15,
      religiousTradition: 'North Indian',
      description: 'Experienced Vedic Pandit performing all types of pujas.',
      languages: ['Hindi', 'Sanskrit', 'English'],
      profilePicture: 'https://via.placeholder.com/150',
      location: {
        type: 'Point',
        coordinates: [78.35, 17.45] // Hyderabad approx
      },
      services: [
        {
          ceremonyId: satyanarayan._id,
          price: 2500,
          durationMinutes: 120
        },
        {
          ceremonyId: grihaPravesh._id,
          price: 5500,
          durationMinutes: 180
        }
      ],
      isVerified: true,
      rating: { average: 4.8, count: 25 }
    });

    await profile.save();
    console.log('Priest Profile seeded with services');

    process.exit();
  } catch (error) {
    console.error('Error seeding priest:', error);
    process.exit(1);
  }
};

seedPriests();
