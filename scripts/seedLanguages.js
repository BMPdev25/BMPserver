const mongoose = require('mongoose');
const Language = require('../models/language');
require('dotenv').config();

const languages = [
  { rank: 1, name: 'Hindi', nativeName: 'हिन्दी', code: 'HI', speakersInMillions: 528 },
  { rank: 2, name: 'Bengali', nativeName: 'বাংলা', code: 'BN', speakersInMillions: 97 },
  { rank: 3, name: 'Marathi', nativeName: 'मराठी', code: 'MR', speakersInMillions: 83 },
  { rank: 4, name: 'Telugu', nativeName: 'తెలుగు', code: 'TE', speakersInMillions: 81 },
  { rank: 5, name: 'Tamil', nativeName: 'தமிழ்', code: 'TA', speakersInMillions: 69 },
  { rank: 6, name: 'Gujarati', nativeName: 'ગુજરાતી', code: 'GU', speakersInMillions: 56 },
  { rank: 7, name: 'Urdu', nativeName: 'اردو', code: 'UR', speakersInMillions: 51 },
  { rank: 8, name: 'Kannada', nativeName: 'ಕನ್ನಡ', code: 'KN', speakersInMillions: 44 },
  { rank: 9, name: 'Odia', nativeName: 'ଓଡ଼ିଆ', code: 'OR', speakersInMillions: 38 },
  { rank: 10, name: 'Malayalam', nativeName: 'മലയാളം', code: 'ML', speakersInMillions: 35 },
  { rank: 11, name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ', code: 'PA', speakersInMillions: 33 },
  { rank: 12, name: 'Assamese', nativeName: 'অসমীয়া', code: 'AS', speakersInMillions: 15 },
  { rank: 13, name: 'Maithili', nativeName: 'मैथिली', code: 'MAI', speakersInMillions: 13 },
  { rank: 14, name: 'Bhojpuri', nativeName: 'भोजपुरी', code: 'BHO', speakersInMillions: 51 },
  { rank: 15, name: 'Santali', nativeName: 'ᱥᱟᱱᱛᱟᱲᱤ', code: 'SAT', speakersInMillions: 7 },
  { rank: 16, name: 'Kashmiri', nativeName: 'कॉशुर', code: 'KS', speakersInMillions: 7 },
  { rank: 17, name: 'Nepali', nativeName: 'नेपाली', code: 'NE', speakersInMillions: 3 },
  { rank: 18, name: 'Sindhi', nativeName: 'سنڌي', code: 'SD', speakersInMillions: 3 },
  { rank: 19, name: 'Konkani', nativeName: 'कोंकणी', code: 'KOK', speakersInMillions: 2.5 },
  { rank: 20, name: 'Dogri', nativeName: 'डोगरी', code: 'DOI', speakersInMillions: 2 }
];

async function seedLanguages() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Clear existing languages
    await Language.deleteMany({});
    console.log('Cleared existing languages');

    // Insert new languages
    await Language.insertMany(languages);
    console.log(`Successfully seeded ${languages.length} languages`);

    // Display seeded languages
    const seededLanguages = await Language.find().sort({ rank: 1 });
    console.log('\nSeeded Languages:');
    seededLanguages.forEach(lang => {
      console.log(`${lang.rank}. ${lang.name} (${lang.nativeName}) - ${lang.speakersInMillions}M speakers`);
    });

    process.exit(0);
  } catch (error) {
    console.error('Error seeding languages:', error);
    process.exit(1);
  }
}

seedLanguages();
