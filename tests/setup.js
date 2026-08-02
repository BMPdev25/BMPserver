// Load test-only credentials (fake Razorpay keys, RAZORPAY_LIVE=false, etc.)
// before anything else. This runs once per test file via setupFilesAfterEnv,
// ahead of the test file's own top-level code, so real values from the
// gitignored root .env (live Razorpay keys, RAZORPAY_LIVE=true) never leak
// into the suite — dotenv.config() calls later (e.g. in server.js) only fill
// in keys that aren't already set, and override:true here guarantees these
// test values win over anything already in the shell environment too.
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.test'), override: true })

// Enable the OTP auth routes in tests. They are gated behind OTP_ENABLED at
// require-time in routes/authRoutes.js (disabled by default until MSG91 is
// configured); without this, /send-otp and /verify-otp 404 in the test env.
// Must be set before server.js is required by any test file.
process.env.OTP_ENABLED = 'true'

const { MongoMemoryReplSet } = require('mongodb-memory-server')
const mongoose = require('mongoose')

let mongoServer

// A single-node replica set (not a plain standalone MongoMemoryServer) is
// required so mongoose.startSession()/session.withTransaction() actually
// work — bookingService's booking-completion ledger write (wallet credit +
// Transaction + CompanyRevenue + priestProfile update) is wrapped in a real
// multi-document transaction, which standalone mongod rejects outright.
const createMemoryServer = () =>
  MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } })

// ── Hooks used by setupFilesAfterFramework ────────────────────────────
beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create({ replSet: { count: 1 } })
  const uri = mongoServer.getUri()
  await mongoose.connect(uri)
})

afterAll(async () => {
  await mongoose.disconnect()
  if (mongoServer) await mongoServer.stop()
})

afterEach(async () => {
  const collections = mongoose.connection.collections
  for (const key in collections) {
    await collections[key].deleteMany({})
  }
})

// ── Legacy exports for old test files ────────────────────────────────
module.exports.connect = async () => {
  if (mongoose.connection.readyState === 0) {
    mongoServer = await MongoMemoryServer.create({ replSet: { count: 1 } })
    const uri = mongoServer.getUri()
    await mongoose.connect(uri)
  }
}

module.exports.closeDatabase = async () => {
  await mongoose.connection.dropDatabase()
  await mongoose.connection.close()
  if (mongoServer) await mongoServer.stop()
}

module.exports.clearDatabase = async () => {
  const collections = mongoose.connection.collections
  for (const key in collections) {
    await collections[key].deleteMany()
  }
}
