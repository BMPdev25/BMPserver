const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const cloudinary = require('cloudinary').v2;
const fs = require('fs');

console.log('--- ENV DEBUG ---');
console.log('Cloud Name:', process.env.CLOUDINARY_CLOUD_NAME ? 'Loaded' : 'MISSING');
console.log('API Key:', process.env.CLOUDINARY_API_KEY ? 'Loaded' : 'MISSING');
console.log('API Secret:', process.env.CLOUDINARY_API_SECRET ? 'Loaded' : 'MISSING');
console.log('Mongo URI:', process.env.MONGO_URI ? 'Loaded' : 'MISSING');
console.log('-----------------');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const ASSETS_DIR = path.join(__dirname, '../../sacred-connect/assets/images');
const PUBLIC_IMAGES_DIR = path.join(__dirname, '../public/images');

// Image mappings
const PRIEST_IMAGES = ['pandit1.jpg', 'pandit2.jpg'];
const CEREMONY_IMAGES = {
  'wedding.jpg': ['Wedding', 'Vivaha'],
  'baby-naming.jpg': ['Baby Naming', 'Namakaran'],
  'housewarming.png': ['Housewarming', 'Griha Pravesh'], // From assets
  'home-rituals.jpg': ['Satyanarayan Puja', 'Puja'], // From assets
  'funeral.jpg': ['Funeral', 'Antyesti'],
  
  // New images from public folder
  'ganapati.jpg': ['Ganapati', 'Ganesha'],
  'satyanarayan.jpg': ['Satyanarayan'],
  'grihapravesh.jpg': ['Griha Pravesh'], // Logic to prefer this over png if needed, or just add both
};

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB Connected');
  } catch (err) {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  }
};

const uploadImage = async (filename, folder) => {
  // Check assets folder first
  let filePath = path.join(ASSETS_DIR, filename);
  if (!fs.existsSync(filePath)) {
    // Check public images folder
    filePath = path.join(PUBLIC_IMAGES_DIR, filename);
    if (!fs.existsSync(filePath)) {
         console.warn(`File not found in assets or public: ${filename}`);
         return null;
    }
  }
  
  try {
    const result = await cloudinary.uploader.upload(filePath, {
      folder: `sacred-connect/${folder}`,
      use_filename: true,
      unique_filename: false,
    });
    console.log(`Uploaded ${filename} to ${result.secure_url}`);
    return result.secure_url;
  } catch (error) {
    console.error(`Error uploading ${filename}:`, error);
    return null;
  }
};

const migrate = async () => {
  await connectDB();

  // 1. Migrate Priest Images
  console.log('\n--- Migrating Priest Images ---');
  const priests = await PriestProfile.find({});
  console.log(`Found ${priests.length} priests.`);

  for (let i = 0; i < priests.length; i++) {
    const priest = priests[i];
    // Assign images round-robin style if we have fewer images than priests
    const imageFile = PRIEST_IMAGES[i % PRIEST_IMAGES.length];
    
    // Only update if no profile picture or it's a placeholder/local path
    // Also update if it's a localhost URL, as that's broken for remote devices
    if (!priest.profilePicture || 
        !priest.profilePicture.startsWith('http') || 
        priest.profilePicture.includes('localhost') || 
        priest.profilePicture.includes('127.0.0.1')) {
            
        const url = await uploadImage(imageFile, 'profile-pictures');
        if (url) {
            priest.profilePicture = url;
            await priest.save();
            console.log(`Updated priest ${priest._id} with ${imageFile}`);
            
            if (priest.userId) {
                await User.findByIdAndUpdate(priest.userId, { 
                    'profilePicture.url': url 
                });
            }
        }
    } else {
        console.log(`Priest ${priest._id} already has a valid image: ${priest.profilePicture}`);
    }
  }

  // 2. Migrate Ceremony Images
  console.log('\n--- Migrating Ceremony Images ---');
  for (const [filename, keywords] of Object.entries(CEREMONY_IMAGES)) {
    const url = await uploadImage(filename, 'ceremonies');
    if (!url) continue;

    for (const keyword of keywords) {
        // Find ceremonies matching the keyword (case-insensitive)
        const ceremonies = await Ceremony.find({ 
            name: { $regex: keyword, $options: 'i' } 
        });

        for (const ceremony of ceremonies) {
             // Check if image already exists to avoid duplicates
             const alreadyHasImage = ceremony.images.some(img => img.url === url);
             
             // Check if current image is localhost/broken
             const hasBrokenImage = ceremony.images.some(img => img.url.includes('localhost') || img.url.includes('example.com'));

             if (!alreadyHasImage) {
                 // If we found a broken image, remove it or update it?
                 // Simpler: Just push the new valid one and make it primary.
                 
                 const isPrimary = ceremony.images.length === 0 || hasBrokenImage;
                 
                 // If updating primary, unset others
                 if (isPrimary) {
                     ceremony.images.forEach(img => img.isPrimary = false);
                 }

                 ceremony.images.push({
                     url: url,
                     alt: ceremony.name,
                     isPrimary: isPrimary
                 });
                 await ceremony.save();
                 console.log(`Added image to ceremony: ${ceremony.name}`);
             } else {
                 console.log(`Ceremony ${ceremony.name} already has this image.`);
             }
        }
    }
  }

  console.log('\nMigration completed.');
  process.exit(0);
};

migrate();
