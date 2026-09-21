process.env.NODE_ENV = 'test'

jest.mock('expo-server-sdk', () => ({
  Expo: class {
    static isExpoPushToken() { return false }
    chunkPushNotifications() { return [] }
    async sendPushNotificationsAsync() { return [] }
  },
}))

jest.mock('../config/firebase', () => ({
  auth: () => ({ verifyIdToken: jest.fn(), createCustomToken: jest.fn() }),
}))

// Document upload/retrieval go through the real S3 SDK client — mock the
// service layer so these tests stay hermetic and don't need AWS credentials.
jest.mock('../services/storageService', () => ({
  uploadPublicFile: jest.fn().mockResolvedValue('https://cdn.test/public/mock-key.jpg'),
  uploadPrivateFile: jest.fn().mockResolvedValue('private/mock-key.jpg'),
  getPresignedUrl: jest.fn().mockResolvedValue('https://cdn.test/presigned/mock-key.jpg?sig=abc'),
  deletePublicFile: jest.fn().mockResolvedValue(undefined),
  deletePrivateFile: jest.fn().mockResolvedValue(undefined),
}))

const request = require('supertest')
const { app } = require('../server')
const jwt = require('jsonwebtoken')
const User = require('../models/user')
const PriestProfile = require('../models/priestProfile')
const { createTestPriest } = require('./helpers/testFactory')

const authAs = (user, type) => ({
  'x-test-user-id': user._id.toString(),
  'x-test-user-type': type,
})

const adminToken = (admin) =>
  jwt.sign({ id: admin._id, userType: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1h' })

describe('POST /api/priest/documents — success path', () => {
  it('uploads a government_id document and stores the returned S3 key, not a raw URL', async () => {
    const { user } = await createTestPriest()

    const res = await request(app)
      .post('/api/priest/documents')
      .set(authAs(user, 'priest'))
      .field('documentType', 'government_id')
      .attach('document', Buffer.from('fake-id-bytes'), { filename: 'id.jpg', contentType: 'image/jpeg' })

    expect(res.status).toBe(200)

    const profile = await PriestProfile.findOne({ userId: user._id })
    const doc = profile.verificationDocuments.find((d) => d.type === 'government_id')
    expect(doc).toBeDefined()
    expect(doc.url).toBe('private/mock-key.jpg')
  })

  it('uploads a profile_picture to the public bucket and sets profilePicture on the profile', async () => {
    const { user } = await createTestPriest()

    const res = await request(app)
      .post('/api/priest/documents')
      .set(authAs(user, 'priest'))
      .field('documentType', 'profile_picture')
      .attach('document', Buffer.from('fake-photo-bytes'), { filename: 'photo.jpg', contentType: 'image/jpeg' })

    expect(res.status).toBe(200)

    const profile = await PriestProfile.findOne({ userId: user._id })
    expect(profile.profilePicture).toBe('https://cdn.test/public/mock-key.jpg')
  })

  it('rejects an unrecognized documentType with 400', async () => {
    const { user } = await createTestPriest()

    const res = await request(app)
      .post('/api/priest/documents')
      .set(authAs(user, 'priest'))
      .field('documentType', 'passport_selfie_of_a_cat')
      .attach('document', Buffer.from('x'), { filename: 'x.jpg', contentType: 'image/jpeg' })

    expect(res.status).toBe(400)
  })
})

describe('GET /api/priest/documents/:documentType', () => {
  it('returns a presigned URL for an uploaded document', async () => {
    const { user } = await createTestPriest()
    await PriestProfile.findOneAndUpdate(
      { userId: user._id },
      { $push: { verificationDocuments: { type: 'government_id', url: 'private/existing-key.jpg', status: 'pending' } } }
    )

    const res = await request(app)
      .get('/api/priest/documents/government_id')
      .set(authAs(user, 'priest'))

    expect(res.status).toBe(200)
    expect(res.body.data.url).toBe('https://cdn.test/presigned/mock-key.jpg?sig=abc')
  })

  it('returns 404 when the document type was never uploaded', async () => {
    const { user } = await createTestPriest()

    const res = await request(app)
      .get('/api/priest/documents/religious_certificate')
      .set(authAs(user, 'priest'))

    expect(res.status).toBe(404)
  })
})

describe('POST /api/priest/submit-verification — requires all three documents', () => {
  const aService = () => ({
    ceremonyId: new (require('mongoose').Types.ObjectId)(),
    price: 1000,
    durationMinutes: 60,
  })

  it('rejects submission when only government_id is uploaded, listing what is missing', async () => {
    const { user } = await createTestPriest({ profile: { services: [aService()] } })
    await PriestProfile.findOneAndUpdate(
      { userId: user._id },
      { $push: { verificationDocuments: { type: 'government_id', url: 'private/id.jpg', status: 'pending' } } }
    )

    const res = await request(app)
      .post('/api/priest/submit-verification')
      .set(authAs(user, 'priest'))
      .send({})

    expect(res.status).toBe(400)
    expect(res.body.missingDocuments).toEqual(
      expect.arrayContaining(['profile_picture', 'religious_certificate'])
    )
  })

  it('accepts submission once profile_picture, government_id, and religious_certificate are all present', async () => {
    const { user } = await createTestPriest({ profile: { services: [aService()] } })
    await PriestProfile.findOneAndUpdate(
      { userId: user._id },
      {
        profilePicture: 'https://cdn.test/pic.jpg',
        $push: {
          verificationDocuments: {
            $each: [
              { type: 'government_id', url: 'private/id.jpg', status: 'pending' },
              { type: 'religious_certificate', url: 'private/cert.jpg', status: 'pending' },
            ],
          },
        },
      }
    )

    const res = await request(app)
      .post('/api/priest/submit-verification')
      .set(authAs(user, 'priest'))
      .send({})

    expect(res.status).toBe(200)
    const profile = await PriestProfile.findOne({ userId: user._id })
    expect(profile.verificationStatus).toBe('pending')
  })
})

describe('Admin verification endpoints', () => {
  let admin, priestUser

  beforeEach(async () => {
    admin = await User.create({
      name: 'System Admin',
      email: `admin_${Date.now()}@test.com`,
      firebaseUid: `admin-fb-${Date.now()}`,
      userType: 'admin',
      isActive: true,
      isVerified: true,
    })
    const { user } = await createTestPriest()
    priestUser = user
    await PriestProfile.findOneAndUpdate(
      { userId: priestUser._id },
      {
        verificationStatus: 'pending',
        $push: {
          verificationDocuments: { type: 'government_id', url: 'private/id.jpg', status: 'pending' },
        },
      }
    )
  })

  it('lists pending verifications', async () => {
    const res = await request(app)
      .get('/api/admin/verifications/pending')
      .set('Authorization', `Bearer ${adminToken(admin)}`)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.some((p) => p.userId?._id === priestUser._id.toString())).toBe(true)
  })

  it('reviews (approves) a single document', async () => {
    const res = await request(app)
      .put(`/api/admin/verifications/${priestUser._id}/documents/government_id`)
      .set('Authorization', `Bearer ${adminToken(admin)}`)
      .send({ status: 'verified' })

    expect(res.status).toBe(200)
    const profile = await PriestProfile.findOne({ userId: priestUser._id })
    expect(profile.verificationDocuments.find((d) => d.type === 'government_id').status).toBe('verified')
  })

  it('rejects an invalid document review status', async () => {
    const res = await request(app)
      .put(`/api/admin/verifications/${priestUser._id}/documents/government_id`)
      .set('Authorization', `Bearer ${adminToken(admin)}`)
      .send({ status: 'not-a-real-status' })

    expect(res.status).toBe(400)
  })

  it('approves the priest, flips isVerified on the User, and syncs the profile', async () => {
    const res = await request(app)
      .put(`/api/admin/verifications/${priestUser._id}/status`)
      .set('Authorization', `Bearer ${adminToken(admin)}`)
      .send({ status: 'approved' })

    expect(res.status).toBe(200)
    expect(res.body.data.verificationStatus).toBe('approved')

    const updatedUser = await User.findById(priestUser._id)
    expect(updatedUser.isVerified).toBe(true)

    const profile = await PriestProfile.findOne({ userId: priestUser._id })
    expect(profile.isVerified).toBe(true)
  })

  it('rejects the priest with a reason and does not mark them verified', async () => {
    const res = await request(app)
      .put(`/api/admin/verifications/${priestUser._id}/status`)
      .set('Authorization', `Bearer ${adminToken(admin)}`)
      .send({ status: 'rejected', rejectionReason: 'Documents unreadable' })

    expect(res.status).toBe(200)
    const profile = await PriestProfile.findOne({ userId: priestUser._id })
    expect(profile.verificationStatus).toBe('rejected')
    expect(profile.isVerified).toBe(false)
    expect(profile.rejectionReason).toBe('Documents unreadable')
  })

  it('denies verification endpoints to a non-admin JWT', async () => {
    const token = jwt.sign({ id: priestUser._id, userType: 'priest' }, process.env.JWT_SECRET, { expiresIn: '1h' })

    const res = await request(app)
      .get('/api/admin/verifications/pending')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(403)
  })
})
