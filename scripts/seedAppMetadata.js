const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Banner = require('../models/banner');
const Panchang = require('../models/panchang');
const CeremonyCategory = require('../models/ceremonyCategory');

dotenv.config();

const seedData = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, { dbName: 'bmp' });
    console.log('Connected to MongoDB');

    // 2. Upsert Banners (keyed on title — skips if already present)
    const banners = [
      {
        title: 'Ganesh Chaturthi Special',
        subtitle: '10% Off on all Ganesh Pujas',
        color: '#FF9933',
        isActive: true,
        order: 1,
      },
      {
        title: 'Navratri Celebrations',
        subtitle: 'Book Durga Puja early',
        color: '#C62828',
        isActive: true,
        order: 2,
      },
      {
        title: 'New Priest Onboarded',
        subtitle: 'Pandit Sharma now available',
        color: '#2E7D32',
        isActive: true,
        order: 3,
      },
    ];
    for (const banner of banners) {
      await Banner.updateOne({ title: banner.title }, { $setOnInsert: banner }, { upsert: true });
    }
    console.log('Banners seeded');

    // 3. Upsert Panchang (keyed on date — skips if already present)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const panchangData = [
      {
        date: today,
        title: 'Today is Ekadashi',
        subtitle: 'Auspicious for Vishnu Puja & Fasting',
        nakshatra: 'Rohini',
        tithi: 'Ekadashi',
        auspiciousFor: ['Vishnu Puja', 'Fasting', 'Charity'],
      },
      {
        date: tomorrow,
        title: 'Dwadashi Tithi',
        subtitle: 'Good for starting new ventures',
        nakshatra: 'Mrigashirsha',
        tithi: 'Dwadashi',
        auspiciousFor: ['New Business', 'Travel'],
      },
    ];
    for (const entry of panchangData) {
      await Panchang.updateOne({ date: entry.date }, { $setOnInsert: entry }, { upsert: true });
    }
    console.log('Panchang seeded');

    // 4. Upsert Ceremony Categories (keyed on slug — skips if already present)
    const categories = [
      {
        name: 'Havans',
        slug: 'havans',
        icon: 'flame-outline',
        color: '#FF6B35',
        order: 1,
      },
      {
        name: 'Festivals',
        slug: 'festivals',
        icon: 'sparkles-outline',
        color: '#E91E63',
        order: 2,
      },
      {
        name: 'Pujas',
        slug: 'pujas',
        icon: 'flower-outline',
        color: '#FF9933',
        order: 3,
      },
      {
        name: 'Ancestors',
        slug: 'ancestors',
        icon: 'people-outline',
        color: '#7B1FA2',
        order: 4,
      },
    ];
    for (const cat of categories) {
      await CeremonyCategory.updateOne({ slug: cat.slug }, { $setOnInsert: cat }, { upsert: true });
    }
    console.log('Ceremony Categories seeded');

    console.log('All metadata seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding metadata:', error);
    process.exit(1);
  }
};

seedData();
