const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Ceremony = require('../models/ceremony');

dotenv.config();

const ceremonies = [
  {
    name: 'Satyanarayan Puja',
    description: 'A puja performed to seek the blessings of Lord Satyanarayan, a form of Lord Vishnu.',
    category: 'puja',
    subcategory: 'general',
    duration: {
      typical: 120,
      minimum: 90,
      maximum: 180
    },
    pricing: {
      basePrice: 2100,
      priceRange: { min: 2100, max: 5100 }
    },
    requirements: {
      materials: [
        { name: 'Kumkum', quantity: '1 packet' },
        { name: 'Turmeric', quantity: '1 packet' },
        { name: 'Rice', quantity: '1 kg' },
        { name: 'Betel leaves', quantity: '20' }
      ]
    },
    religiousTraditions: ['Hindu'],
    images: [{ url: 'https://example.com/satyanarayan.jpg', alt: 'Satyanarayan Puja', isPrimary: true }]
  },
  {
    name: 'Griha Pravesh',
    description: 'Housewarming ceremony performed before moving into a new house.',
    category: 'housewarming',
    subcategory: 'general',
    duration: {
      typical: 180,
      minimum: 120,
      maximum: 240
    },
    pricing: {
      basePrice: 5100,
      priceRange: { min: 5100, max: 11000 }
    },
    requirements: {
       materials: [{ name: 'Coconut', quantity: '2' }]
    },
    religiousTraditions: ['Hindu'],
    images: [{ url: 'https://example.com/grihapravesh.jpg', alt: 'Griha Pravesh', isPrimary: true }]
  },
  {
    name: 'Ganapati Homa',
    description: 'Homa performed to Lord Ganesha to remove obstacles.',
    category: 'puja',
    subcategory: 'homa',
    duration: {
      typical: 90,
      minimum: 60,
      maximum: 120
    },
    pricing: {
      basePrice: 3100,
      priceRange: { min: 3100, max: 7100 }
    },
    requirements: {
       materials: [{ name: 'Modak', quantity: '21' }]
    },
    religiousTraditions: ['Hindu'],
    images: [{ url: 'https://example.com/ganapati.jpg', alt: 'Ganapati', isPrimary: true }]
  }
];

const seedCeremonies = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB Connected');

    await Ceremony.deleteMany({});
    console.log('Ceremonies cleared');

    await Ceremony.insertMany(ceremonies);
    console.log('Ceremonies seeded');

    process.exit();
  } catch (error) {
    console.error('Error seeding ceremonies:', error);
    process.exit(1);
  }
};

seedCeremonies();
