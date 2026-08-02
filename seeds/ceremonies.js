const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Ceremony = require('../models/ceremony');

dotenv.config();

const ceremonies = [
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
      ],
    },
    ritualSteps: [
      { stepNumber: 1, title: 'Sankalpam', description: 'Taking a solemn vow to perform the puja with devotion.', durationEstimate: 10 },
      { stepNumber: 2, title: 'Ganesh Vandana', description: 'Invoking Lord Ganesha to remove obstacles.', durationEstimate: 15 },
      { stepNumber: 3, title: 'Navagraha Shanti', description: 'Prayers to the nine planetary deities.', durationEstimate: 20 },
      { stepNumber: 4, title: 'Satyanarayan Katha', description: 'Recitation of the sacred story of Lord Satyanarayan.', durationEstimate: 45 },
      { stepNumber: 5, title: 'Aarti & Prasad', description: 'Concluding with Aarti and distribution of prasad.', durationEstimate: 15 },
    ],
    religiousTraditions: ['Hindu'],
    images: [{ url: 'https://example.com/satyanarayan.jpg', alt: 'Satyanarayan Puja', isPrimary: true }],
  },
  {
    name: 'Griha Pravesh',
    description: 'Housewarming ceremony performed before moving into a new house.',
    category: 'housewarming',
    subcategory: 'general',
    duration: { typical: 180, minimum: 120, maximum: 240 },
    pricing: { basePrice: 5100, priceRange: { min: 5100, max: 11000 } },
    requirements: {
      materials: [{ name: 'Coconut', quantity: '2' }],
    },
    ritualSteps: [
      { stepNumber: 1, title: 'Vastu Shanti', description: 'Purifying the space.', durationEstimate: 30 },
      { stepNumber: 2, title: 'Gau Puja', description: 'Worship of the cow.', durationEstimate: 15 },
      { stepNumber: 3, title: 'Boiling Milk', description: 'Boiling milk until it spills over, signifying abundance.', durationEstimate: 20 },
      { stepNumber: 4, title: 'Navagraha Havan', description: 'Sacred fire ritual.', durationEstimate: 60 },
      { stepNumber: 5, title: 'Aarti & Blessings', description: 'Final prayers and blessings.', durationEstimate: 15 },
    ],
    religiousTraditions: ['Hindu'],
    images: [{ url: 'https://example.com/grihapravesh.jpg', alt: 'Griha Pravesh', isPrimary: true }],
  },
  {
    name: 'Ganapati Homa',
    description: 'Homa performed to Lord Ganesha to remove obstacles.',
    category: 'puja',
    subcategory: 'homa',
    duration: { typical: 90, minimum: 60, maximum: 120 },
    pricing: { basePrice: 3100, priceRange: { min: 3100, max: 7100 } },
    requirements: {
      materials: [{ name: 'Modak', quantity: '21' }],
    },
    ritualSteps: [
      { stepNumber: 1, title: 'Sankalpam', description: 'Declaring the intention to perform the Ganapati Homa.', durationEstimate: 5 },
      { stepNumber: 2, title: 'Kalasha Sthapana', description: 'Invoking the sacred rivers into the Kalasha.', durationEstimate: 15 },
      { stepNumber: 3, title: 'Agni Pratishtapana', description: 'Igniting the sacred homa fire.', durationEstimate: 10 },
      { stepNumber: 4, title: 'Ahuti Offerings', description: 'Chanting the Ganapati Moola Mantra with fire offerings.', durationEstimate: 40 },
      { stepNumber: 5, title: 'Purnahuti & Aarti', description: 'Final comprehensive offering and Aarti.', durationEstimate: 15 },
    ],
    religiousTraditions: ['Hindu'],
    images: [{ url: 'https://example.com/ganapati.jpg', alt: 'Ganapati', isPrimary: true }],
  },
  {
    name: 'Ganapati Homam',
    description:
      'A Vedic fire ritual (havan) dedicated to Lord Ganesha for removing obstacles, ' +
      'bestowing success, and purifying the environment. Performed with chanting of ' +
      'Ganapati Atharvashirsha and systematic ahuti offerings.',
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
        'Participants should fast or eat a light meal before the homam. The ceremony space must be ventilated.',
    },
    ritualSteps: [
      { stepNumber: 1, title: 'Kunda Nirman', description: 'Preparing and purifying the havan kunda (fire pit).', durationEstimate: 10 },
      { stepNumber: 2, title: 'Sankalpam', description: 'Declaring the devotee\'s intention and seeking Lord Ganesha\'s presence.', durationEstimate: 10 },
      { stepNumber: 3, title: 'Ganapati Avahana', description: 'Inviting Lord Ganesha into the ceremony through mantra and mudra.', durationEstimate: 15 },
      { stepNumber: 4, title: 'Agni Sthapana', description: 'Lighting the sacred havan fire with Agni Mantra.', durationEstimate: 15 },
      { stepNumber: 5, title: 'Ahuti (108 offerings)', description: 'Making 108 ahuti offerings into the fire while chanting Ganapati Atharvashirsha.', durationEstimate: 45 },
      { stepNumber: 6, title: 'Purnahuti & Aarti', description: 'The final grand offering followed by Aarti and distribution of prasad.', durationEstimate: 15 },
    ],
    religiousTraditions: ['Hindu'],
    images: [{ url: 'https://example.com/ganapati-homam.jpg', alt: 'Ganapati Homam', isPrimary: true }],
    isActive: true,
  },
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
