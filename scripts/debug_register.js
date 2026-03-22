const mongoose = require('mongoose');
const request = require('supertest');
const { app, server } = require('../server');

async function debugRegister() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bmp_test', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  const res = await request(app)
    .post('/api/auth/register')
    .send({
      name: 'Lifecycle Priest',
      email: 'test_priest_lifecycle@example.com',
      phone: '9998887771', 
      password: 'password123',
      userType: 'priest'
    });

  console.log('Status Code:', res.statusCode);
  console.log('Response Body:', JSON.stringify(res.body, null, 2));

  server.close();
  await mongoose.connection.close();
  process.exit(0);
}

debugRegister().catch(console.error);
