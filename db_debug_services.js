const mongoose = require('mongoose');

const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '.env') });

async function debugPriestServices() {
  const MONGO_URI = process.env.MONGO_URI;
  if (!MONGO_URI) {
    console.error('ERROR: MONGO_URI not found in .env file');
    process.exit(1);
  }
  
  try {
    await mongoose.connect(MONGO_URI, { dbName: 'bmp' });
    console.log('Connected to MongoDB');
    
    const PriestProfile = mongoose.model('PriestProfile', new mongoose.Schema({
        userId: mongoose.Schema.Types.ObjectId,
        services: [{
            ceremonyId: mongoose.Schema.Types.ObjectId,
            price: Number
        }]
    }));
    
    const Ceremony = mongoose.model('Ceremony', new mongoose.Schema({
        name: String,
        isActive: Boolean
    }));
    
    const User = mongoose.model('User', new mongoose.Schema({
        name: String
    }));

    const priests = await PriestProfile.find({}).lean();
    console.log(`Found ${priests.length} priest profiles.`);
    
    for (const priest of priests) {
        const user = await User.findById(priest.userId);
        console.log(`\nPriest: ${user ? user.name : 'Unknown'} [ID: ${priest._id}]`);
        
        if (priest.services && priest.services.length > 0) {
            for (const service of priest.services) {
                const ceremony = await Ceremony.findById(service.ceremonyId);
                console.log(` - Service: ${ceremony ? ceremony.name : 'MISSING/INVALID ID'} [CID: ${service.ceremonyId}] Price: ${service.price}`);
            }
        } else {
            console.log(' - No services found in services array.');
        }
    }
    
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

debugPriestServices();
