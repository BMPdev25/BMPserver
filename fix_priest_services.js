const mongoose = require('mongoose');

const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '.env') });

async function fixPriestServices() {
  const MONGO_URI = process.env.MONGO_URI;
  if (!MONGO_URI) {
    console.error('ERROR: MONGO_URI not found in .env file');
    process.exit(1);
  }
  
  try {
    await mongoose.connect(MONGO_URI, { dbName: 'bmp' });
    console.log('Connected to MongoDB');
    
    // Mapping of OLD (invalid) IDs to NEW (valid) names
    const mapping = {
      '6947dee15cbd57f36d6a1b8c': 'Satyanarayan Puja',
      '6947dee15cbd57f36d6a1b94': 'Griha Pravesh',
      '6947dee15cbd57f36d6a1b99': 'Wedding Ceremony',
      '6954f5bf574809f0c388a500': 'Ganapati Homa',
      '6954f5bf574809f0c388a503': 'Satyanarayan Puja' // Duplicate entry usually
    };

    const PriestProfile = mongoose.model('PriestProfile', new mongoose.Schema({
        services: [{
            ceremonyId: mongoose.Schema.Types.ObjectId,
            price: Number,
            durationMinutes: Number
        }]
    }));
    
    const Ceremony = mongoose.model('Ceremony', new mongoose.Schema({
        name: String,
        isActive: Boolean
    }));

    const allNewCeremonies = await Ceremony.find({ isActive: true });
    const nameToId = {};
    allNewCeremonies.forEach(c => {
        nameToId[c.name] = c._id;
    });

    console.log('Valid Ceremony IDs found:', JSON.stringify(nameToId));

    const priests = await PriestProfile.find({});
    console.log(`Processing ${priests.length} priest profiles...`);
    
    for (const priest of priests) {
        let updated = false;
        if (priest.services && priest.services.length > 0) {
            for (let i = 0; i < priest.services.length; i++) {
                const oldId = priest.services[i].ceremonyId.toString();
                const targetName = mapping[oldId];
                
                if (targetName && nameToId[targetName]) {
                    console.log(`Updating Priest ${priest._id}: service ${oldId} -> ${targetName} (${nameToId[targetName]})`);
                    priest.services[i].ceremonyId = nameToId[targetName];
                    updated = true;
                }
            }
        }
        
        if (updated) {
            await priest.save();
            console.log(`Saved changes for Priest ${priest._id}`);
        }
    }
    
    await mongoose.disconnect();
    console.log('Migration complete.');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

fixPriestServices();
