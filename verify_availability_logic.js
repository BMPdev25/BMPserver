const mongoose = require('mongoose');
const axios = require('axios');

async function verifyFiltering() {
  const MONGO_URI = "mongodb+srv://bmpoffice24x7_db_user:Mktdy7ClTGmh4voO@cluster0.5nhycy3.mongodb.net/";
  const API_URL = "http://localhost:5000/api/devotee/priests";
  const PRIEST_ID = "6947dee15cbd57f36d6a1bb2"; // Pandit Sharma

  try {
    await mongoose.connect(MONGO_URI, { dbName: 'bmp' });
    console.log('Connected to MongoDB');

    const PriestProfile = mongoose.model('PriestProfile', new mongoose.Schema({
      currentAvailability: {
        status: String
      }
    }));

    // 1. Initial Check
    let res = await axios.get(API_URL);
    console.log(`Initial: ${res.data.totalPriests} priests found.`);
    const initialNames = res.data.priests.map(p => p.name);
    console.log('Initial Priests:', initialNames.join(', '));

    // 2. Set to offline
    console.log(`\nSetting Priest ${PRIEST_ID} (Pandit Sharma) to 'offline'...`);
    await PriestProfile.findByIdAndUpdate(PRIEST_ID, { 'currentAvailability.status': 'offline' });

    // 3. Verify they disappeared
    res = await axios.get(API_URL);
    console.log(`After setting offline: ${res.data.totalPriests} priests found.`);
    const afterOfflineNames = res.data.priests.map(p => p.name);
    console.log('Current Priests:', afterOfflineNames.join(', '));

    if (!afterOfflineNames.includes('Pandit Sharma')) {
      console.log('SUCCESS: Pandit Sharma is no longer in the list.');
    } else {
      console.log('FAILURE: Pandit Sharma is still in the list.');
    }

    // 4. Restore to available
    console.log(`\nRestoring Priest ${PRIEST_ID} (Pandit Sharma) to 'available'...`);
    await PriestProfile.findByIdAndUpdate(PRIEST_ID, { 'currentAvailability.status': 'available' });

    // 5. Final check
    res = await axios.get(API_URL);
    console.log(`After restoring: ${res.data.totalPriests} priests found.`);

    await mongoose.disconnect();
    console.log('\nVerification complete.');

  } catch (error) {
    console.error('Error:', error.message);
  }
}

verifyFiltering();
