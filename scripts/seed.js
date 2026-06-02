require('dotenv').config()
const mongoose = require('mongoose')
const admin = require('../config/firebase')

const User = require('../models/user')
const PriestProfile = require('../models/priestProfile')
const Booking = require('../models/booking')
const Transaction = require('../models/transaction')
const Wallet = require('../models/wallet')
const Rating = require('../models/rating')
const Notification = require('../models/notification')
const Ceremony = require('../models/ceremony')
const CeremonyCategory = require('../models/ceremonyCategory')
const DevoteeProfile = require('../models/devoteeProfile')
const Language = require('../models/language')
const Banner = require('../models/banner')
const CompanyRevenue = require('../models/companyRevenue')
const Panchang = require('../models/panchang')
const Review = require('../models/review')

// ─── Category enum mapping ───────────────────────────────────────────────────
const CATEGORY_MAP = {
  Puja: 'puja',
  Housewarming: 'housewarming',
  Homa: 'special-occasion',
  Lifecycle: 'special-occasion',
  Ancestral: 'special-occasion',
  Wedding: 'wedding',
}

// ─── Ceremony catalog ────────────────────────────────────────────────────────
const CEREMONIES_RAW = [
  {
    name: 'Satyanarayan Puja',
    category: 'Puja',
    subcategory: 'Vishnu Pujas',
    description:
      'A devotional worship dedicated to Lord Vishnu in his form of Satyanarayan. Performed for blessings, prosperity, and fulfillment of wishes.',
    durationHours: 2,
    durationMinutes: 0,
    basePrice: 2100,
    languages: ['Telugu', 'Sanskrit', 'Hindi'],
    religiousTraditions: ['Hindu', 'Vaishnava'],
  },
  {
    name: 'Griha Pravesh Puja',
    category: 'Housewarming',
    subcategory: 'Home Ceremonies',
    description:
      'Sacred ceremony performed before entering a new home. Purifies the space and invites divine blessings for the family.',
    durationHours: 3,
    durationMinutes: 0,
    basePrice: 5100,
    languages: ['Telugu', 'Sanskrit'],
    religiousTraditions: ['Hindu'],
  },
  {
    name: 'Ganesh Puja',
    category: 'Puja',
    subcategory: 'Ganesh Pujas',
    description:
      'Worship of Lord Ganesha, remover of obstacles. Performed before starting any new venture, event, or important life occasion.',
    durationHours: 1,
    durationMinutes: 30,
    basePrice: 1500,
    languages: ['Telugu', 'Sanskrit', 'Hindi'],
    religiousTraditions: ['Hindu', 'Shaiva'],
  },
  {
    name: 'Lakshmi Puja',
    category: 'Puja',
    subcategory: 'Devi Pujas',
    description:
      'Devotional worship of Goddess Lakshmi for wealth, prosperity, and abundance. Commonly performed on Fridays.',
    durationHours: 1,
    durationMinutes: 30,
    basePrice: 1800,
    languages: ['Telugu', 'Sanskrit'],
    religiousTraditions: ['Hindu', 'Shakta'],
  },
  {
    name: 'Ganapati Homa',
    category: 'Homa',
    subcategory: 'Fire Rituals',
    description:
      'Sacred fire ritual dedicated to Lord Ganesha. Removes obstacles and ensures success in new beginnings.',
    durationHours: 2,
    durationMinutes: 0,
    basePrice: 3100,
    languages: ['Telugu', 'Sanskrit'],
    religiousTraditions: ['Hindu', 'Shaiva'],
  },
  {
    name: 'Navagraha Homa',
    category: 'Homa',
    subcategory: 'Planetary Rituals',
    description:
      "Fire ritual to appease the nine planetary deities and reduce malefic effects in one's horoscope.",
    durationHours: 3,
    durationMinutes: 0,
    basePrice: 4500,
    languages: ['Telugu', 'Sanskrit'],
    religiousTraditions: ['Hindu', 'Vedic'],
  },
  {
    name: 'Namkaran Puja',
    category: 'Lifecycle',
    subcategory: 'Birth Ceremonies',
    description:
      'Traditional naming ceremony for a newborn baby. Performed on the 11th or 12th day after birth.',
    durationHours: 1,
    durationMinutes: 30,
    basePrice: 2100,
    languages: ['Telugu', 'Sanskrit', 'Hindi'],
    religiousTraditions: ['Hindu'],
  },
  {
    name: 'Upanayanam',
    category: 'Lifecycle',
    subcategory: 'Coming of Age',
    description:
      'Sacred thread ceremony for boys. Marks the beginning of formal Vedic education and spiritual life.',
    durationHours: 4,
    durationMinutes: 0,
    basePrice: 7500,
    languages: ['Telugu', 'Sanskrit'],
    religiousTraditions: ['Hindu', 'Vedic'],
  },
  {
    name: 'Shradh Ceremony',
    category: 'Ancestral',
    subcategory: 'Ancestral Rites',
    description:
      'Rituals performed to honour and offer respect to deceased ancestors. Ensures their peaceful journey and family prosperity.',
    durationHours: 3,
    durationMinutes: 0,
    basePrice: 3500,
    languages: ['Telugu', 'Sanskrit'],
    religiousTraditions: ['Hindu', 'Vedic'],
  },
  {
    name: 'Wedding Ceremony',
    category: 'Wedding',
    subcategory: 'Vedic Weddings',
    description:
      'Complete Vedic wedding ceremony including Saptapadi (seven vows), Mangalsutra and all traditional rituals.',
    durationHours: 6,
    durationMinutes: 0,
    basePrice: 15000,
    languages: ['Telugu', 'Sanskrit', 'Hindi'],
    religiousTraditions: ['Hindu', 'Vedic'],
  },
]

// ─── Priest definitions ───────────────────────────────────────────────────────
const PRIESTS = [
  {
    name: 'Pandit Ramesh Sharma',
    email: 'priest1@sacredconnect.test',
    password: 'Test@1234',
    phone: '9876543201',
    tradition: 'Telugu Brahmin',
    experience: 15,
    languages: ['Telugu', 'Hindi', 'Sanskrit'],
    bio: 'Specialising in house ceremonies and Vastu pujas for 15 years. Have performed over 500 Griha Pravesh ceremonies across Hyderabad.',
    rating: 4.8,
    reviewCount: 124,
    isOnline: true,
    address: 'Jubilee Hills, Hyderabad',
    pincode: '500033',
    coordinates: [78.4074, 17.4326],
    services: [
      { name: 'Griha Pravesh Puja', price: 5100 },
      { name: 'Satyanarayan Puja', price: 2100 },
      { name: 'Ganesh Puja', price: 1500 },
    ],
  },
  {
    name: 'Pandit Suresh Iyer',
    email: 'priest2@sacredconnect.test',
    password: 'Test@1234',
    phone: '9876543202',
    tradition: 'Tamil Iyer',
    experience: 25,
    languages: ['Tamil', 'Telugu', 'Sanskrit', 'Hindi'],
    bio: 'A highly experienced Tamil Iyer pandit with 25 years of practice. Expert in Vedic wedding rituals and all major ceremonies.',
    rating: 4.9,
    reviewCount: 312,
    isOnline: true,
    address: 'Banjara Hills, Hyderabad',
    pincode: '500034',
    coordinates: [78.4411, 17.4156],
    services: [
      { name: 'Wedding Ceremony', price: 15000 },
      { name: 'Upanayanam', price: 7500 },
      { name: 'Satyanarayan Puja', price: 2500 },
      { name: 'Navagraha Homa', price: 4500 },
    ],
  },
  {
    name: 'Pandit Vikram Joshi',
    email: 'priest3@sacredconnect.test',
    password: 'Test@1234',
    phone: '9876543203',
    tradition: 'North Indian Pandit',
    experience: 10,
    languages: ['Hindi', 'Sanskrit', 'English'],
    bio: 'A versatile North Indian pandit fluent in English, serving both traditional and modern families with equal dedication.',
    rating: 4.5,
    reviewCount: 89,
    isOnline: true,
    address: 'Madhapur, Hyderabad',
    pincode: '500081',
    coordinates: [78.3900, 17.4502],
    services: [
      { name: 'Ganapati Homa', price: 3100 },
      { name: 'Satyanarayan Puja', price: 2100 },
      { name: 'Lakshmi Puja', price: 1800 },
      { name: 'Griha Pravesh Puja', price: 5500 },
    ],
  },
  {
    name: 'Pandit Anand Shastri',
    email: 'priest4@sacredconnect.test',
    password: 'Test@1234',
    phone: '9876543204',
    tradition: 'Smartha Brahmin',
    experience: 22,
    languages: ['Telugu', 'Sanskrit'],
    bio: 'A Sanskrit scholar specialising in ancestral rites, Shradh, and complex Vedic rituals. Trained at Tirupati Veda Pathshala.',
    rating: 4.7,
    reviewCount: 198,
    isOnline: false,
    address: 'Gachibowli, Hyderabad',
    pincode: '500032',
    coordinates: [78.3490, 17.4400],
    services: [
      { name: 'Shradh Ceremony', price: 3500 },
      { name: 'Navagraha Homa', price: 4500 },
      { name: 'Ganapati Homa', price: 3100 },
      { name: 'Upanayanam', price: 8000 },
    ],
  },
  {
    name: 'Pandit Krishna Murthy',
    email: 'priest5@sacredconnect.test',
    password: 'Test@1234',
    phone: '9876543205',
    tradition: 'Telugu Brahmin',
    experience: 5,
    languages: ['Telugu', 'Sanskrit'],
    bio: 'A young and energetic pandit bringing authenticity and punctuality to every ceremony. Specialises in weekday and office pujas.',
    rating: 4.3,
    reviewCount: 41,
    isOnline: true,
    address: 'Kondapur, Hyderabad',
    pincode: '500084',
    coordinates: [78.3600, 17.4600],
    services: [
      { name: 'Ganesh Puja', price: 1500 },
      { name: 'Lakshmi Puja', price: 1800 },
      { name: 'Satyanarayan Puja', price: 2100 },
    ],
  },
  {
    name: 'Pandit Babu Rao Vedantam',
    email: 'priest6@sacredconnect.test',
    password: 'Test@1234',
    phone: '9876543206',
    tradition: 'Vaidiki Brahmin',
    experience: 32,
    languages: ['Telugu', 'Sanskrit', 'Hindi'],
    bio: 'One of the most sought-after pandits in Hyderabad with 32 years of experience. Has officiated ceremonies for thousands of families.',
    rating: 4.9,
    reviewCount: 456,
    isOnline: true,
    address: 'Secunderabad, Hyderabad',
    pincode: '500003',
    coordinates: [78.4983, 17.4399],
    services: [
      { name: 'Namkaran Puja', price: 2100 },
      { name: 'Upanayanam', price: 7500 },
      { name: 'Wedding Ceremony', price: 18000 },
      { name: 'Shradh Ceremony', price: 3500 },
      { name: 'Satyanarayan Puja', price: 2100 },
    ],
  },
  {
    name: 'Pandit Shiva Kumar Rao',
    email: 'priest7@sacredconnect.test',
    password: 'Test@1234',
    phone: '9876543207',
    tradition: 'Lingayat Pandit',
    experience: 12,
    languages: ['Telugu', 'Kannada', 'Hindi', 'Sanskrit'],
    bio: 'Multilingual pandit serving Telugu and Kannada families across Hyderabad. Comfortable with both traditional and simplified ceremony formats.',
    rating: 4.6,
    reviewCount: 143,
    isOnline: true,
    address: 'Hitech City, Hyderabad',
    pincode: '500081',
    coordinates: [78.3810, 17.4477],
    services: [
      { name: 'Ganesh Puja', price: 1500 },
      { name: 'Griha Pravesh Puja', price: 5100 },
      { name: 'Ganapati Homa', price: 3100 },
      { name: 'Lakshmi Puja', price: 1800 },
    ],
  },
  {
    name: 'Pandit Rajesh Verma',
    email: 'priest8@sacredconnect.test',
    password: 'Test@1234',
    phone: '9876543208',
    tradition: 'North Indian Brahmin',
    experience: 18,
    languages: ['Hindi', 'Sanskrit', 'English'],
    bio: 'Specialist in North Indian wedding traditions and engagement ceremonies. Serves both Hindu and Jain wedding rituals.',
    rating: 4.7,
    reviewCount: 167,
    isOnline: false,
    address: 'Begumpet, Hyderabad',
    pincode: '500016',
    coordinates: [78.4718, 17.4399],
    services: [
      { name: 'Wedding Ceremony', price: 16000 },
      { name: 'Satyanarayan Puja', price: 2500 },
      { name: 'Navagraha Homa', price: 5000 },
      { name: 'Namkaran Puja', price: 2100 },
    ],
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function clearDatabase() {
  console.log('Clearing all collections...')
  const collections = mongoose.connection.collections
  for (const key in collections) {
    await collections[key].deleteMany({})
    console.log(`  Cleared: ${key}`)
  }
  console.log('All collections cleared.\n')
}

async function clearFirebaseUsers() {
  try {
    const listResult = await admin.auth().listUsers()
    const uids = listResult.users.map(u => u.uid)
    if (uids.length > 0) {
      await admin.auth().deleteUsers(uids)
      console.log(`Deleted ${uids.length} Firebase users.\n`)
    } else {
      console.log('No existing Firebase users to delete.\n')
    }
  } catch (err) {
    console.warn('Firebase user clear failed:', err.message)
  }
}

// Uses raw insertOne to store languagesSpoken as plain strings,
// bypassing Mongoose's ObjectId cast for that field.
async function insertUser(data) {
  const now = new Date()
  const doc = {
    name: data.name,
    email: data.email,
    phone: data.phone,
    firebaseUid: data.firebaseUid,
    userType: data.userType,
    isVerified: data.isVerified || false,
    isActive: true,
    isTestRecord: true,
    languagesSpoken: data.languagesSpoken || [],
    createdAt: now,
    updatedAt: now,
    security: {
      loginAttempts: 0,
      accountLocked: false,
      lockedUntil: null,
      lastPasswordChange: null,
      twoFactorEnabled: false,
      refreshTokens: [],
    },
    notifications: {
      email: { bookingUpdates: true, promotions: false, reminders: true },
      push: { bookingUpdates: true, promotions: false, reminders: true },
    },
    addresses: data.addresses || [],
    rating: { average: 0, count: 0, breakdown: {} },
    profilePicture: { url: null, uploadedAt: null },
    familyDetails: { gotra: '', nakshatra: '', rashi: '' },
    dateOfBirth: null,
    devoteeReliability: {
      score: 100,
      cancellationCount: 0,
      lateCancellationCount: 0,
      completedCount: 0,
    },
  }
  const result = await User.collection.insertOne(doc)
  // Return a minimal object shaped like a Mongoose doc
  return { _id: result.insertedId, ...doc }
}

async function createFirebaseUser(data) {
  try {
    return await admin.auth().createUser({
      email: data.email,
      password: data.password,
      displayName: data.name,
    })
  } catch (err) {
    if (err.code === 'auth/email-already-exists') {
      return admin.auth().getUserByEmail(data.email)
    }
    throw err
  }
}

async function createPriest(data, ceremonyMap) {
  const firebaseUser = await createFirebaseUser(data)

  const user = await insertUser({
    firebaseUid: firebaseUser.uid,
    name: data.name,
    email: data.email,
    phone: data.phone,
    userType: 'priest',
    languagesSpoken: data.languages,
    isVerified: true,
  })

  const validServices = data.services
    .filter(s => ceremonyMap[s.name])
    .map(s => {
      const c = ceremonyMap[s.name]
      return {
        ceremonyId: c._id,
        price: s.price,
        durationMinutes: c.duration.typical,
        isActive: true,
        requirements: [],
        customSteps: [],
      }
    })

  const profile = await PriestProfile.create({
    userId: user._id,
    description: data.bio,
    experience: data.experience,
    religiousTradition: data.tradition,
    isVerified: true,
    verificationStatus: 'approved',
    onboardingCompleted: true,
    currentAvailability: {
      status: data.isOnline ? 'available' : 'offline',
    },
    location: {
      type: 'Point',
      coordinates: data.coordinates,
    },
    address: {
      street: data.address,
      town: 'Hyderabad',
      state: 'Telangana',
      country: 'India',
      pincode: data.pincode,
      fullAddress: `${data.address}, Hyderabad - ${data.pincode}`,
    },
    services: validServices,
    availability: {
      weeklySchedule: new Map([
        ['monday', ['06:00', '20:00']],
        ['tuesday', ['06:00', '20:00']],
        ['wednesday', ['06:00', '20:00']],
        ['thursday', ['06:00', '20:00']],
        ['friday', ['06:00', '20:00']],
        ['saturday', ['06:00', '20:00']],
        ['sunday', ['07:00', '17:00']],
      ]),
      dateOverrides: [],
    },
    ratings: {
      average: data.rating,
      count: data.reviewCount,
    },
    ceremonyCount: data.reviewCount,
    earnings: {
      totalEarnings: data.reviewCount * data.services[0].price,
      thisMonth: 0,
      pendingPayments: 0,
    },
  })

  return { user, profile }
}

async function createDevotee() {
  const firebaseUser = await createFirebaseUser({
    email: 'devotee@sacredconnect.test',
    password: 'Test@1234',
    name: 'Test Devotee',
  })

  await insertUser({
    firebaseUid: firebaseUser.uid,
    name: 'Test Devotee',
    email: 'devotee@sacredconnect.test',
    phone: '9876543200',
    userType: 'devotee',
    languagesSpoken: ['Telugu', 'English'],
    addresses: [
      {
        type: 'Home',
        houseNo: 'Flat 4B',
        street: 'Palm Heights, Jubilee Hills',
        city: 'Hyderabad',
        state: 'Telangana',
        pincode: '500033',
        isDefault: true,
      },
    ],
  })

  console.log('Test devotee created.')
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  await mongoose.connect(process.env.MONGODB_URI)
  console.log('Connected to MongoDB\n')

  await clearFirebaseUsers()
  await clearDatabase()

  // Seed ceremonies
  console.log('Creating ceremony catalog...')
  const ceremonyDocs = CEREMONIES_RAW.map(c => {
    const totalMinutes = c.durationHours * 60 + c.durationMinutes
    const price = c.basePrice
    return {
      name: c.name,
      description: c.description,
      category: CATEGORY_MAP[c.category],
      subcategory: c.subcategory,
      duration: {
        typical: totalMinutes,
        minimum: Math.max(30, totalMinutes - 30),
        maximum: totalMinutes + 60,
      },
      pricing: {
        basePrice: price,
        priceRange: {
          min: Math.round(price * 0.9),
          max: Math.round(price * 1.5),
        },
        factors: [],
      },
      languages: c.languages,
      religiousTraditions: c.religiousTraditions,
      requirements: {
        materials: [],
        participants: { required: 1, maximum: null },
        specialInstructions: [],
      },
      ritualSteps: [],
      tags: [],
      keywords: [],
      searchTerms: [],
      images: [],
      videos: [],
      regions: ['Telangana', 'Andhra Pradesh'],
      seasonality: {
        preferredMonths: [],
        avoidMonths: [],
        preferredDays: [],
        preferredTimes: [],
      },
      statistics: {
        bookingCount: 0,
        averageRating: 0,
        reviewCount: 0,
        popularityScore: 0,
        monthlyTrend: [],
      },
      isActive: true,
      isFeatured: false,
      isPopular: false,
    }
  })

  const savedCeremonies = await Ceremony.insertMany(ceremonyDocs)
  const ceremonyMap = {}
  savedCeremonies.forEach(c => {
    ceremonyMap[c.name] = c
  })
  console.log(`Created ${savedCeremonies.length} ceremonies\n`)

  // Create devotee
  console.log('Creating test devotee...')
  await createDevotee()
  console.log()

  // Create priests
  console.log('Creating priests...')
  const created = []
  for (const priestData of PRIESTS) {
    const validServices = priestData.services.filter(s => ceremonyMap[s.name])
    if (validServices.length === 0) {
      console.warn(`  Skipping ${priestData.name} — no valid services`)
      continue
    }
    priestData.services = validServices

    await createPriest(priestData, ceremonyMap)
    created.push({ name: priestData.name, email: priestData.email })
    console.log(`  ✓ ${priestData.name}`)
  }

  // Print credentials
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('SEED COMPLETE — TEST CREDENTIALS')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('\nTEST DEVOTEE:')
  console.log('  Email:    devotee@sacredconnect.test')
  console.log('  Password: Test@1234')
  console.log('\nTEST PRIESTS (all use password: Test@1234):')
  created.forEach(p => {
    console.log(`  ${p.name.padEnd(30)} ${p.email}`)
  })
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  await mongoose.disconnect()
  process.exit(0)
}

main().catch(err => {
  console.error('Seed failed:', err)
  process.exit(1)
})
