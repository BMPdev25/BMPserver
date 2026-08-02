// Enable the OTP auth routes in tests. They are gated behind OTP_ENABLED at
// require-time in routes/authRoutes.js (disabled by default until MSG91 is
// configured); without this, /send-otp and /verify-otp 404 in the test env.
// Must be set before server.js is required by any test file.
process.env.OTP_ENABLED = 'true'

const { MongoMemoryServer } = require('mongodb-memory-server')
const mongoose = require('mongoose')

let mongoServer

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
