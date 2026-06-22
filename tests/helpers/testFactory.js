const User = require('../../models/user')
const PriestProfile = require('../../models/priestProfile')
const Booking = require('../../models/booking')
const Ceremony = require('../../models/ceremony')
const Wallet = require('../../models/wallet')
const Transaction = require('../../models/transaction')

let _seq = 0
const seq = () => ++_seq

const createTestDevotee = async (overrides = {}) => {
  const n = seq()
  const user = new User({
    name: `Test Devotee ${n}`,
    email: `devotee${n}@test.com`,
    phone: `+91900${String(n).padStart(7, '0')}`,
    firebaseUid: `fb_devotee_${n}`,
    userType: 'devotee',
    ...overrides,
  })
  await user.save()
  return user
}

const createTestPriest = async (overrides = {}) => {
  const n = seq()
  const user = new User({
    name: `Test Priest ${n}`,
    email: `priest${n}@test.com`,
    phone: `+91800${String(n).padStart(7, '0')}`,
    firebaseUid: `fb_priest_${n}`,
    userType: 'priest',
    ...(overrides.user || {}),
  })
  await user.save()

  const allDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
  const weeklySchedule = {}
  allDays.forEach((d) => (weeklySchedule[d] = ['06:00-22:00']))

  const profile = new PriestProfile({
    userId: user._id,
    isVerified: true,
    verificationStatus: 'approved',
    experience: 5,
    religiousTradition: 'Hindu',
    currentAvailability: { status: 'available' },
    availability: { weeklySchedule },
    ...(overrides.profile || {}),
  })
  await profile.save()

  return { user, profile }
}

const createTestCeremony = async (overrides = {}) => {
  const n = seq()
  const ceremony = new Ceremony({
    name: overrides.name || 'Ganesh Puja',
    description: 'A traditional Hindu puja ceremony',
    category: 'puja',
    subcategory: 'ganesh',
    duration: { typical: 60, minimum: 30, maximum: 120 },
    pricing: {
      basePrice: 2000,
      priceRange: { min: 1500, max: 3000 },
    },
    religiousTraditions: ['Hindu'],
    isActive: true,
    ...overrides,
  })
  await ceremony.save()
  return ceremony
}

// Creates a booking directly in DB (bypasses service validation)
const createTestBooking = async (devoteeId, priestId, overrides = {}) => {
  const future = new Date()
  future.setDate(future.getDate() + 7)

  const booking = new Booking({
    devoteeId,
    priestId,
    ceremonyType: 'Ganesh Puja',
    date: future,
    startTime: '10:00',
    endTime: '12:00',
    location: { address: '123 Test Street, Mumbai', city: 'Mumbai' },
    basePrice: 2000,
    platformFee: 100,
    totalAmount: 2100,
    status: 'confirmed',
    paymentDetails: { receiptNumber: `TEST_${Date.now()}_${seq()}` },
    statusHistory: [],
    ...overrides,
  })
  await booking.save()
  return booking
}

const createTestWallet = async (priestId, balanceOverrides = {}) => {
  const wallet = new Wallet({
    priestId,
    currentBalance: 0,
    totalCredited: 0,
    totalDebited: 0,
    ...balanceOverrides,
  })
  await wallet.save()
  return wallet
}

const createTestTransaction = async (priestId, walletId, bookingId, overrides = {}) => {
  const tx = new Transaction({
    priestId,
    walletId,
    bookingId,
    type: 'credit_for_booking',
    direction: 'inflow',
    amount: 2000,
    status: 'completed',
    description: 'Ganesh Puja ceremony',
    ...overrides,
  })
  await tx.save()
  return tx
}

// Returns a date N days from now as 'YYYY-MM-DD'
const futureDateStr = (days = 30) => {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

module.exports = {
  createTestDevotee,
  createTestPriest,
  createTestCeremony,
  createTestBooking,
  createTestWallet,
  createTestTransaction,
  futureDateStr,
}
