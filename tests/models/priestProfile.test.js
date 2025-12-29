const mongoose = require('mongoose');
const PriestProfile = require('../../models/priestProfile');

describe('PriestProfile Model Test', () => {
  it('should create & save priest profile successfully', async () => {
    const profileData = {
      userId: new mongoose.Types.ObjectId(),
      experience: 5,
      religiousTradition: 'Vedic',
      serviceRadiusKm: 20
    };
    const validProfile = new PriestProfile(profileData);
    const savedProfile = await validProfile.save();
    
    expect(savedProfile._id).toBeDefined();
    expect(savedProfile.userId).toEqual(profileData.userId);
    expect(savedProfile.experience).toBe(5);
    expect(savedProfile.location.type).toBe('Point'); // Default
  });

  it('should validate verificationDocuments structure', async () => {
    const profileData = {
      userId: new mongoose.Types.ObjectId(),
      verificationDocuments: [{
        type: 'government_id',
        data: Buffer.from('test'),
        contentType: 'application/pdf',
        fileName: 'id.pdf'
      }]
    };
    const profile = new PriestProfile(profileData);
    const savedProfile = await profile.save();

    expect(savedProfile.verificationDocuments).toHaveLength(1);
    expect(savedProfile.verificationDocuments[0].type).toBe('government_id');
    expect(savedProfile.verificationDocuments[0].status).toBe('pending');
  });
});
