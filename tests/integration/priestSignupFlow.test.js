const request = require('supertest');
const { app } = require('../../server');
const Ceremony = require('../../models/ceremony');
const Language = require('../../models/language');
const mongoose = require('mongoose');

describe('Priest Signup & Profile Integration', () => {
    let token;
    let ceremonyId;
    let languageIds = [];

    // Seed data
    beforeEach(async () => {
        // Seed Ceremony
        const ceremony = await Ceremony.create({
            name: "Test Ceremony",
            description: "Test Desc",
            category: "puja",
            subcategory: "deity",
            duration: { typical: 60, minimum: 45, maximum: 90 },
            pricing: { basePrice: 1100, priceRange: { min: 1100, max: 2100 }, factors: [] },
            religiousTraditions: ["Hindu"],
            images: [{ url: "/img.png", alt: "Test", isPrimary: true }],
            requirements: { materials: [] }
        });
        ceremonyId = ceremony._id.toString();

        // Seed Languages
        const lang1 = await Language.create({ name: 'English', nativeName: 'English', code: 'EN', speakersInMillions: 1000, rank: 1 });
        const lang2 = await Language.create({ name: 'Hindi', nativeName: 'Hindi', code: 'HI', speakersInMillions: 500, rank: 3 });
        languageIds = [lang1._id.toString(), lang2._id.toString()];
    });

    test('Full Priest Onboarding Flow', async () => {
        // 1. REGISTER
        const registerRes = await request(app)
            .post('/api/auth/register')
            .send({
                name: "Integration Priest",
                email: "integration@test.com",
                phone: "9998887776",
                password: "password123",
                userType: "priest",
                languagesSpoken: languageIds 
            });
        
        if (registerRes.statusCode !== 201) {
            console.error("Register Error:", JSON.stringify(registerRes.body, null, 2));
        }
        expect(registerRes.statusCode).toBe(201);
        expect(registerRes.body).toHaveProperty('token');
        token = registerRes.body.token;

        // 2. FETCH CEREMONIES
        const ceremonyRes = await request(app)
            .get('/api/ceremonies');
            
        expect(ceremonyRes.statusCode).toBe(200);
        // Controller likely returns array directly or { ceremonies: [] }
        // Let's handle both or check controller findings
        const list = Array.isArray(ceremonyRes.body) ? ceremonyRes.body : (ceremonyRes.body.ceremonies || ceremonyRes.body.data);
        expect(list.length).toBeGreaterThan(0);
        
        // 3. UPDATE PROFILE DETAILS
        const updateRes = await request(app)
            .put('/api/priest/profile')
            .set('Authorization', `Bearer ${token}`)
            .send({
                experience: 10,
                description: "Experienced Vedic Priest",
                religiousTradition: "Vedic",
                location: { type: 'Point', coordinates: [77.59, 12.97] },
                 services: [{
                    ceremonyId: ceremonyId,
                    price: 1500,
                    durationMinutes: 60
                }]
            });

        if (updateRes.statusCode !== 200) {
            console.error("Update Error:", JSON.stringify(updateRes.body, null, 2));
        }
        expect(updateRes.statusCode).toBe(200);
        expect(updateRes.body.experience).toBe(10);
        
       // 4. VERIFY PROFILE
       const profileRes = await request(app)
           .get('/api/priest/profile')
           .set('Authorization', `Bearer ${token}`);
           
       expect(profileRes.statusCode).toBe(200);
       expect(profileRes.body.description).toBe("Experienced Vedic Priest"); 
    });
});
