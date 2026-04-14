const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const Category = require('../models/ceremonyCategory');
const Ceremony = require('../models/ceremony');

dotenv.config({ path: path.join(__dirname, '../.env') });

const categories = [
  { name: 'Weddings', slug: 'wedding', icon: 'heart-outline', color: '#FF6B6B', order: 1 },
  { name: 'Pujas', slug: 'puja', icon: 'flower-outline', color: '#FF9933', order: 2 },
  { name: 'Housewarming', slug: 'housewarming', icon: 'home-outline', color: '#4ECDC4', order: 3 },
  {
    name: 'Birth & Naming',
    slug: 'baby-naming',
    icon: 'happy-outline',
    color: '#45B7D1',
    order: 4,
  },
  { name: 'Festivals', slug: 'festival', icon: 'sparkles-outline', color: '#F9D423', order: 5 },
  {
    name: 'Special Occasions',
    slug: 'special-occasion',
    icon: 'star-outline',
    color: '#6C5CE7',
    order: 6,
  },
  {
    name: 'Daily Worship',
    slug: 'daily-worship',
    icon: 'sunny-outline',
    color: '#A8E6CF',
    order: 7,
  },
  {
    name: 'Thread Ceremony',
    slug: 'thread-ceremony',
    icon: 'ribbon-outline',
    color: '#FFD93D',
    order: 8,
  },
  { name: 'Funeral', slug: 'funeral', icon: 'cloud-outline', color: '#636E72', order: 9 },
  { name: 'Corporate', slug: 'corporate', icon: 'business-outline', color: '#0984E3', order: 10 },
];

const demoCeremonies = [
  {
    name: 'Satyanarayan Puja',
    description: 'Lord Vishnu blessings',
    category: 'puja',
    subcategory: 'General',
    duration: { typical: 120, minimum: 90, maximum: 180 },
    pricing: { basePrice: 2100, priceRange: { min: 2100, max: 5100 } },
    basePrice: 2100,
    images: [
      {
        url: 'https://images.unsplash.com/photo-1609234656388-0b5a1e3e8908?w=300',
        alt: 'Puja',
        isPrimary: true,
      },
    ],
    isActive: true,
  },
  {
    name: 'Griha Pravesh',
    description: 'New house entry',
    category: 'housewarming',
    subcategory: 'General',
    duration: { typical: 180, minimum: 120, maximum: 240 },
    pricing: { basePrice: 5100, priceRange: { min: 5100, max: 11000 } },
    images: [
      {
        url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=300',
        alt: 'House',
        isPrimary: true,
      },
    ],
    isActive: true,
  },
  {
    name: 'Ganapati Homa',
    description: 'Remove obstacles',
    category: 'puja',
    subcategory: 'General',
    duration: { typical: 90, minimum: 60, maximum: 120 },
    pricing: { basePrice: 3100, priceRange: { min: 3100, max: 7100 } },
    images: [
      {
        url: 'https://images.unsplash.com/photo-1567591370504-83a1d0a6a5fa?w=300',
        alt: 'Homa',
        isPrimary: true,
      },
    ],
    isActive: true,
  },
  {
    name: 'Wedding Ceremony',
    description: 'Sacred union',
    category: 'wedding',
    subcategory: 'Marriage',
    duration: { typical: 300, minimum: 240, maximum: 600 },
    pricing: { basePrice: 25000, priceRange: { min: 25000, max: 75000 } },
    images: [
      {
        url: 'https://images.unsplash.com/photo-1519741497674-611481863552?w=300',
        alt: 'Wedding',
        isPrimary: true,
      },
    ],
    isActive: true,
  },
];

const seedAll = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, { dbName: 'bmp' });
    console.log('Connected to MongoDB (bmp)');

    // Reset Categories
    await Category.deleteMany({});
    await Category.insertMany(categories);
    console.log('Categories seeded');

    // Reset Ceremonies
    await Ceremony.deleteMany({});
    await Ceremony.insertMany(demoCeremonies);
    console.log('Demo ceremonies seeded');

    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

seedAll();
