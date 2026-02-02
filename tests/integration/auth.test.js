const request = require('supertest');
const { app } = require('../../server'); // Ensure server.js exports app
const mongoose = require('mongoose');
const Language = require('../../models/language');

describe('Auth API Integration', () => {
  let languageId;

  beforeAll(async () => {
    // Get a language ID for priest tests
    const language = await Language.findOne({ code: 'HI' });
    if (language) {
      languageId = language._id.toString();
    }
  });

  it('should register a new devotee user', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Integration Test User',
        email: 'integration@test.com',
        password: 'password123',
        phone: '9876543210',
        userType: 'devotee'
      });
    
    expect(res.statusCode).toEqual(201);
    expect(res.body).toHaveProperty('token');
    expect(res.body).toHaveProperty('_id');
    expect(res.body.email).toEqual('integration@test.com');
  });

  it('should register a new priest user with languages', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Priest Test User',
        email: 'priest@test.com',
        password: 'password123',
        phone: '9876543211',
        userType: 'priest',
        languagesSpoken: languageId ? [languageId] : []
      });
    
    expect(res.statusCode).toEqual(201);
    expect(res.body).toHaveProperty('token');
    expect(res.body).toHaveProperty('_id');
    expect(res.body.userType).toEqual('priest');
  });

  it('should fail to register priest without languages', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Priest No Lang',
        email: 'priestnolang@test.com',
        password: 'password123',
        phone: '9876543212',
        userType: 'priest',
        languagesSpoken: []
      });
    
    expect(res.statusCode).toEqual(400);
    expect(res.body.message).toContain('language');
  });

  it('should login an existing user', async () => {
    // First register
    await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Login User',
        email: 'login@test.com',
        password: 'password123',
        phone: '1122334455',
        userType: 'devotee'
      });

    // Then login
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        identifier: 'login@test.com',
        password: 'password123'
      });

    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('token');
  });
});
