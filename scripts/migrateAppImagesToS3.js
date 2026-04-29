require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const Ceremony = require('../models/ceremony');
const Banner = require('../models/banner');
const { uploadToS3 } = require('../utils/s3');

const PUBLIC_IMAGES_DIR = path.join(__dirname, '../public/images');

async function migrateImages() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // 1. Map local files to S3 URLs
    const fileToS3Map = new Map();

    async function walkAndUpload(dir, s3Folder = 'app_images') {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
          await walkAndUpload(filePath, `${s3Folder}/${file}`);
        } else {
          // It's a file, upload it
          const buffer = fs.readFileSync(filePath);
          const mimeType = getMimeType(file);
          
          console.log(`Uploading ${file}...`);
          try {
            const result = await uploadToS3(buffer, file, mimeType, s3Folder);
            // Store the relative path from public/images for mapping
            const relativePath = path.relative(PUBLIC_IMAGES_DIR, filePath).replace(/\\/g, '/');
            fileToS3Map.set(`/public/images/${relativePath}`, result.Location);
            console.log(`Uploaded ${file} to ${result.Location}`);
          } catch (err) {
            console.error(`Failed to upload ${file}:`, err.message);
          }
        }
      }
    }

    console.log('--- Starting S3 Uploads ---');
    if (fs.existsSync(PUBLIC_IMAGES_DIR)) {
      await walkAndUpload(PUBLIC_IMAGES_DIR, 'public_assets');
    } else {
      console.warn('public/images directory not found!');
    }

    console.log('--- Updating Database Records ---');

    // 2. Update Ceremonies
    const ceremonies = await Ceremony.find({});
    for (const ceremony of ceremonies) {
      let updated = false;
      for (let i = 0; i < ceremony.images.length; i++) {
        const currentUrl = ceremony.images[i].url;
        // Check if it's a local path or a placeholder we recognize
        const mappedUrl = fileToS3Map.get(currentUrl) || findBestMatch(currentUrl, fileToS3Map);
        
        if (mappedUrl) {
          ceremony.images[i].url = mappedUrl;
          updated = true;
        }
      }
      if (updated) {
        await ceremony.save();
        console.log(`Updated images for ceremony: ${ceremony.name}`);
      }
    }

    // 3. Update Banners
    const banners = await Banner.find({});
    for (const banner of banners) {
      if (banner.imageUrl) {
        const mappedUrl = fileToS3Map.get(banner.imageUrl) || findBestMatch(banner.imageUrl, fileToS3Map);
        if (mappedUrl) {
          banner.imageUrl = mappedUrl;
          await banner.save();
          console.log(`Updated image for banner: ${banner.title}`);
        }
      }
    }

    console.log('Migration complete!');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

function getMimeType(filename) {
  const ext = path.extname(filename).toLowerCase();
  const mimes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp'
  };
  return mimes[ext] || 'application/octet-stream';
}

function findBestMatch(url, map) {
  // If URL is something like https://example.com/satyanarayan.jpg
  // we try to match the filename 'satyanarayan.jpg' against our map
  if (!url) return null;
  const filename = path.basename(url);
  for (const [localPath, s3Url] of map.entries()) {
    if (localPath.endsWith(filename)) return s3Url;
  }
  return null;
}

migrateImages();
