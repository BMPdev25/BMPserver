const AWS = require('aws-sdk');
const path = require('path');

// Configure AWS
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});

const s3 = new AWS.S3();
const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME;

/**
 * Uploads a file to S3
 * @param {Buffer} fileBuffer - The file content
 * @param {string} fileName - Original file name
 * @param {string} mimeType - File MIME type
 * @param {string} folder - Folder in S3 (e.g., 'profile_pictures', 'documents')
 * @returns {Promise<Object>} - S3 upload result (includes Location and Key)
 */
exports.uploadToS3 = async (fileBuffer, fileName, mimeType, folder = 'misc') => {
  const extension = path.extname(fileName);
  const key = `${folder}/${Date.now()}_${Math.floor(Math.random() * 1000)}${extension}`;

  const params = {
    Bucket: BUCKET_NAME,
    Key: key,
    Body: fileBuffer,
    ContentType: mimeType,
    ACL: 'public-read' // Make it public so we can use the URL directly. 
    // If you want private, change to 'private' and use signed URLs.
  };

  return s3.upload(params).promise();
};

/**
 * Deletes a file from S3
 * @param {string} key - S3 object key
 */
exports.deleteFromS3 = async (key) => {
  if (!key) return;
  
  const params = {
    Bucket: BUCKET_NAME,
    Key: key
  };

  return s3.deleteObject(params).promise();
};

/**
 * Generates a signed URL for a private S3 object
 * @param {string} key - S3 object key
 * @param {number} expires - Expiration time in seconds
 */
exports.getSignedUrl = (key, expires = 3600) => {
  if (!key) return null;
  
  const params = {
    Bucket: BUCKET_NAME,
    Key: key,
    Expires: expires
  };

  return s3.getSignedUrl('getObject', params);
};
