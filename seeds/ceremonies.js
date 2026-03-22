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
    ritualSteps: [
      { stepNumber: 1, title: 'Sankalpam', description: 'Taking a solemn vow to perform the puja with devotion.', durationEstimate: 10 },
      { stepNumber: 2, title: 'Ganesh Vandana', description: 'Invoking Lord Ganesha to remove obstacles and bless the ceremony.', durationEstimate: 15 },
      { stepNumber: 3, title: 'Navagraha Shanti', description: 'Prayers offered to the nine planetary deities for peace.', durationEstimate: 20 },
      { stepNumber: 4, title: 'Satyanarayan Katha', description: 'Recitation of the sacred story of Lord Satyanarayan.', durationEstimate: 45 },
      { stepNumber: 5, title: 'Aarti & Prasad', description: 'Concluding the puja with Aarti and distribution of blessed food.', durationEstimate: 15 }
    ],
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
    ritualSteps: [
      { stepNumber: 1, title: 'Vastu Shanti', description: 'Purifying the space and appeasing the Vastu Purusha (God of structures).', durationEstimate: 30 },
      { stepNumber: 2, title: 'Gau Puja', description: 'Worship of the cow, symbolizing auspiciousness and wealth.', durationEstimate: 15 },
      { stepNumber: 3, title: 'Boiling Milk', description: 'Boiling milk until it spills over, signifying abundance and prosperity.', durationEstimate: 20 },
      { stepNumber: 4, title: 'Navagraha Havan', description: 'Sacred fire ritual to appease the nine planetary deities.', durationEstimate: 60 },
      { stepNumber: 5, title: 'Aarti & Blessings', description: 'Final prayers and seeking blessings from elders and deities.', durationEstimate: 15 }
    ],
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
    ritualSteps: [
      { stepNumber: 1, title: 'Sankalpam', description: 'Declaring the intention to perform the Ganapati Homa.', durationEstimate: 5 },
      { stepNumber: 2, title: 'Kalasha Sthapana', description: 'Invoking the sacred rivers and deities into the Kalasha (water pot).', durationEstimate: 15 },
      { stepNumber: 3, title: 'Agni Pratishtapana', description: 'Igniting the sacred homa fire.', durationEstimate: 10 },
      { stepNumber: 4, title: 'Ahuti Offerings', description: 'Chanting the Ganapati Moola Mantra while making offerings into the fire.', durationEstimate: 40 },
      { stepNumber: 5, title: 'Purnahuti & Aarti', description: 'The final comprehensive offering and concluding Aarti.', durationEstimate: 15 }
    ],
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
