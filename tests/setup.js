const { MongoMemoryServer } = require('mongodb-memory-server')
const mongoose = require('mongoose')

let mongoServer

// ── Hooks used by setupFilesAfterFramework ────────────────────────────
beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create()
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
    mongoServer = await MongoMemoryServer.create()
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
