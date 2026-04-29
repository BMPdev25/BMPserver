require('dotenv').config();
const mongoose = require('mongoose');
const PriestProfile = require('../models/priestProfile');
const { uploadToS3 } = require('../utils/s3');
const path = require('path');
const axios = require('axios');
const logger = console; // Simple logger

async function migrate() {
  try {
    // Connect to Database
    await mongoose.connect(process.env.MONGO_URI);
    logger.log('Connected to MongoDB');

    const profiles = await PriestProfile.find({});
    logger.log(`Found ${profiles.length} profiles to check`);

    let migratedCount = 0;

    for (const profile of profiles) {
      let changed = false;

      // 1. Migrate Profile Picture (if it's base64)
      if (profile.profilePicture && profile.profilePicture.startsWith('data:image')) {
        logger.log(`Migrating profile picture for user: ${profile.userId}`);
        const base64Data = profile.profilePicture.split(';base64,').pop();
        const mimeType = profile.profilePicture.split(';base64,')[0].split(':')[1];
        const buffer = Buffer.from(base64Data, 'base64');
        
        try {
          const result = await uploadToS3(
            buffer, 
            `profile_${profile.userId}.png`, 
            mimeType, 
            'profile_pictures'
          );
          profile.profilePicture = result.Location;
          changed = true;
        } catch (err) {
          logger.error(`Failed to upload profile picture for ${profile.userId}: ${err.message}`);
        }
      }

      // 2. Migrate Verification Documents (if they have Buffer data)
      // Note: We need to check the raw data because we changed the schema.
      // Mongoose might have trouble if we use the new schema on old data.
      // We'll use lean() or access the underlying document.
      
      const rawProfile = profile.toObject();
      if (rawProfile.verificationDocuments && rawProfile.verificationDocuments.length > 0) {
        for (let i = 0; i < profile.verificationDocuments.length; i++) {
          const doc = profile.verificationDocuments[i];
          // Check if it has Buffer data (old schema)
          // Since we changed the schema, Mongoose might not show 'data' anymore.
          // We check the underlying BSON.
          const rawDoc = rawProfile.verificationDocuments[i];
          
          if (rawDoc.data && Buffer.isBuffer(rawDoc.data)) {
            logger.log(`Migrating document ${rawDoc.type} for user: ${profile.userId}`);
            
            try {
              const result = await uploadToS3(
                rawDoc.data,
                rawDoc.fileName || `doc_${rawDoc.type}_${profile.userId}`,
                rawDoc.contentType || 'application/octet-stream',
                'documents'
              );
              
              // Update to new schema fields
              profile.verificationDocuments[i].url = result.Location;
              profile.verificationDocuments[i].s3Key = result.Key;
              // Remove old 'data' field (Mongoose might need $unset)
              profile.verificationDocuments[i].set('data', undefined);
              
              changed = true;
            } catch (err) {
              logger.error(`Failed to upload document for ${profile.userId}: ${err.message}`);
            }
          }
        }
      }

      if (changed) {
        await profile.save();
        migratedCount++;
        logger.log(`Successfully migrated profile for user: ${profile.userId}`);
      }
    }

    // 3. Migrate User Profile Pictures (from Cloudinary)
    const User = require('../models/user');
    const axios = require('axios');
    const users = await User.find({ 'profilePicture.url': { $regex: 'cloudinary' } });
    logger.log(`Found ${users.length} users with Cloudinary profile pictures`);

    for (const user of users) {
      try {
        logger.log(`Migrating Cloudinary profile picture for user: ${user.email}`);
        
        // Download from Cloudinary
        const response = await axios.get(user.profilePicture.url, { responseType: 'arraybuffer' });
        const buffer = Buffer.from(response.data, 'binary');
        const mimeType = response.headers['content-type'] || 'image/jpeg';
        const fileName = `user_${user._id}${path.extname(user.profilePicture.url) || '.jpg'}`;

        const result = await uploadToS3(buffer, fileName, mimeType, 'profile_pictures');

        user.profilePicture = {
          url: result.Location,
          publicId: result.Key,
          uploadedAt: new Date()
        };

        await user.save();
        logger.log(`Successfully migrated user profile picture for: ${user.email}`);
        migratedCount++;
      } catch (err) {
        logger.error(`Failed to migrate user ${user.email}: ${err.message}`);
      }
    }

    logger.log(`Migration complete. ${migratedCount} records updated.`);
    process.exit(0);
  } catch (err) {
    logger.error('Migration failed:', err);
    process.exit(1);
  }
}

migrate();
