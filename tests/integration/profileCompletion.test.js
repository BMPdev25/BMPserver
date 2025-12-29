const request = require('supertest');
const { app } = require('../../server');
const mongoose = require('mongoose');
const PriestProfile = require('../../models/priestProfile');
const User = require('../../models/user');
const Language = require('../../models/language');

describe('Profile Completion API', () => {
  let authToken;
  let priestUserId;
  let languageId;

  beforeAll(async () => {
    // Get a language for testing
    const language = await Language.findOne({ code: 'HI' });
    if (language) {
      languageId = language._id.toString();
    }

    // Create a test priest user
    const priestUser = new User({
      name: 'Test Priest',
      email: 'testpriest@profile.com',
      password: 'password123',
      phone: '9999999999',
      userType: 'priest',
      languagesSpoken: languageId ? [languageId] : []
    });
    await priestUser.save();
    priestUserId = priestUser._id;

    // Login to get auth token
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        identifier: 'testpriest@profile.com',
        password: 'password123'
      });
    
    authToken = loginRes.body.token;
  });

  afterAll(async () => {
    // Cleanup
    await User.deleteOne({ email: 'testpriest@profile.com' });
    await PriestProfile.deleteOne({ userId: priestUserId });
  });

  describe('GET /api/priest/profile-completion', () => {
    it('should auto-create profile and return completion data for new priest', async () => {
      const res = await request(app)
        .get('/api/priest/profile-completion')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('completionPercentage');
      expect(res.body).toHaveProperty('missingFields');
      expect(res.body).toHaveProperty('completedFields');
      expect(res.body).toHaveProperty('isVerified');
      expect(res.body).toHaveProperty('canAcceptRequests');

      // New priest should have basic info and languages completed (20%)
      expect(res.body.completionPercentage).toBeGreaterThanOrEqual(20);
      expect(res.body.completedFields).toContain('basicInfo');
      expect(res.body.completedFields).toContain('languages');
    });

    it('should return 401 without authentication', async () => {
      const res = await request(app)
        .get('/api/priest/profile-completion');

      expect(res.statusCode).toEqual(401);
    });

    it('should calculate correct completion percentage', async () => {
      // Update profile with more data
      const profile = await PriestProfile.findOne({ userId: priestUserId });
      profile.description = 'Test description with more than 20 characters';
      profile.experience = 5;
      await profile.save();

      const res = await request(app)
        .get('/api/priest/profile-completion')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(200);
      // Should now have basicInfo (10%) + languages (10%) + description (10%) + experience (10%) = 40%
      expect(res.body.completionPercentage).toBeGreaterThanOrEqual(40);
      expect(res.body.completedFields).toContain('description');
      expect(res.body.completedFields).toContain('experience');
    });

    it('should identify missing fields correctly', async () => {
      const res = await request(app)
        .get('/api/priest/profile-completion')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.missingFields).toBeInstanceOf(Array);
      
      // New profile should be missing these fields
      const expectedMissing = ['profilePicture', 'services', 'location', 'documents'];
      expectedMissing.forEach(field => {
        expect(res.body.missingFields).toContain(field);
      });
    });

    it('should return canAcceptRequests false for incomplete profile', async () => {
      const res = await request(app)
        .get('/api/priest/profile-completion')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.canAcceptRequests).toBe(false);
      expect(res.body.isVerified).toBe(false);
    });
  });

  describe('GET /api/priest/profile', () => {
    it('should auto-create profile for new priest', async () => {
      // Delete profile if exists
      await PriestProfile.deleteOne({ userId: priestUserId });

      const res = await request(app)
        .get('/api/priest/profile')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('userId');
      expect(res.body.userId.toString()).toEqual(priestUserId.toString());
      expect(res.body).toHaveProperty('experience');
      expect(res.body.experience).toEqual(0);
    });

    it('should return existing profile if it exists', async () => {
      const res = await request(app)
        .get('/api/priest/profile')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('userId');
    });

    it('should return 401 without authentication', async () => {
      const res = await request(app)
        .get('/api/priest/profile');

      expect(res.statusCode).toEqual(401);
    });
  });
});
