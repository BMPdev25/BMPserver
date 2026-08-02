// tests/helpers/factory.js
//
// Factory helpers for the integration suite under tests/integration/
// (booking-lifecycle, instant-booking, cancellation-refund,
// security-invariants, rating-bookkeeping, response-envelopes).
//
// Distinct from tests/helpers/testFactory.js (used by the older integration
// tests) — this file matches the exact signatures the new suite expects,
// including a real Ceremony + priced service on every verified priest.

const User = require('../../models/user');
const PriestProfile = require('../../models/priestProfile');
const Ceremony = require('../../models/ceremony');
const Booking = require('../../models/booking');

let _seq = 0;
const seq = () => ++_seq;

const ALL_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const fullWeekAvailability = () => {
  const weeklySchedule = {};
  ALL_DAYS.forEach((d) => (weeklySchedule[d] = ['06:00-22:00']));
  return { weeklySchedule, timeZone: 'Asia/Kolkata' };
};

/** Saved User with userType:'devotee'. */
const createDevotee = async (overrides = {}) => {
  const n = seq();
  const user = new User({
    name: `Test Devotee ${n}`,
    email: `devotee${n}@test.com`,
    phone: `+91900${String(n).padStart(7, '0')}`,
    firebaseUid: `fb_devotee_${n}`,
    userType: 'devotee',
    ...overrides,
  });
  await user.save();
  return user;
};

/** Saved Ceremony with pricing.basePrice. */
const createCeremony = async (overrides = {}) => {
  const n = seq();
  const ceremony = new Ceremony({
    name: overrides.name || `Test Ceremony ${n}`,
    description: 'A traditional Hindu ceremony used for integration tests',
    category: 'puja',
    subcategory: 'general',
    duration: { typical: 60, minimum: 30, maximum: 120 },
    pricing: {
      basePrice: 2000,
      priceRange: { min: 1500, max: 3000 },
    },
    religiousTraditions: ['Hindu'],
    isActive: true,
    ...overrides,
  });
  await ceremony.save();
  return ceremony;
};

/**
 * Saved User (userType:'priest') + PriestProfile that is fully verified and
 * onboarded, with one active service (real Ceremony + real price).
 *
 * overrides: { user: {...}, profile: {...}, ceremony: <Ceremony doc>, price: Number }
 * Returns { user, profile, ceremony, service }.
 */
const createVerifiedPriest = async (overrides = {}) => {
  const n = seq();
  const { user: userOverrides = {}, profile: profileOverrides = {}, ceremony: existingCeremony, price } = overrides;

  const user = new User({
    name: `Test Priest ${n}`,
    email: `priest${n}@test.com`,
    phone: `+91800${String(n).padStart(7, '0')}`,
    firebaseUid: `fb_priest_${n}`,
    userType: 'priest',
    languagesSpoken: ['Telugu', 'English'],
    ...userOverrides,
  });
  await user.save();

  const ceremony = existingCeremony || (await createCeremony());
  const servicePrice = price ?? 2000;

  const services =
    profileOverrides.services ||
    [
      {
        ceremonyId: ceremony._id,
        price: servicePrice,
        durationMinutes: 60,
      },
    ];

  const profile = new PriestProfile({
    userId: user._id,
    isVerified: true,
    verificationStatus: 'approved',
    onboardingCompleted: true,
    experience: 5,
    religiousTradition: 'Hindu',
    languagesSpoken: user.languagesSpoken,
    currentAvailability: { status: 'available' },
    availability: fullWeekAvailability(),
    ...profileOverrides,
    services,
  });
  await profile.save();

  return { user, profile, ceremony, service: services[0] };
};

/**
 * Saved Booking with the fields required for the given status. Bypasses
 * bookingService validation — writes directly via the model, same as the
 * app would once a booking has reached that state.
 *
 * priestId may be null/undefined only when status === 'searching' (the
 * Booking schema itself only requires priestId for non-searching statuses).
 */
const createBooking = async (devoteeId, priestId, status = 'pending', overrides = {}) => {
  const n = seq();
  const future = new Date();
  future.setDate(future.getDate() + 5);

  const defaults = {
    devoteeId,
    priestId: status === 'searching' ? priestId || null : priestId,
    ceremonyType: 'Test Ceremony',
    bookingType: 'scheduled',
    date: future,
    startTime: '10:00',
    endTime: '11:00',
    location: { address: '123 Test Street, Mumbai', city: 'Mumbai' },
    status,
    basePrice: 2000,
    platformFee: 100,
    totalAmount: 2100,
    paymentStatus: 'pending',
    paymentDetails: { receiptNumber: `TEST_${Date.now()}_${n}` },
    statusHistory: [
      {
        status,
        timestamp: new Date(),
        reason: `Test fixture created directly at status '${status}'`,
      },
    ],
  };

  const booking = new Booking({ ...defaults, ...overrides });
  await booking.save();
  return booking;
};

/** Header shape authMiddleware's NODE_ENV==='test' bypass reads (x-test-user-id
 * is the only header it actually trusts — it re-fetches the real user from
 * the DB so role can't be forged; x-test-user-type is included for parity
 * with the shape other suites use but is not read by the middleware). */
const authHeaders = (user) => ({
  'x-test-user-id': user._id.toString(),
  'x-test-user-type': user.userType,
});

module.exports = {
  createDevotee,
  createVerifiedPriest,
  createCeremony,
  createBooking,
  authHeaders,
};
