const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const publicBucket = () => process.env.AWS_S3_PUBLIC_BUCKET;
const privateBucket = () => process.env.AWS_S3_PRIVATE_BUCKET;

function publicUrl(key) {
  const cf = process.env.AWS_CLOUDFRONT_URL;
  if (cf) return `${cf.replace(/\/$/, '')}/${key}`;
  return `https://${publicBucket()}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
}

function s3Error(operation, key, cause) {
  const err = new Error(
    `S3 ${operation} failed for key "${key}": ${cause.message}`
  );
  err.statusCode = 500;
  err.cause = cause;
  return err;
}

async function uploadPublicFile(buffer, key, mimetype) {
  try {
    await s3.send(new PutObjectCommand({
      Bucket: publicBucket(),
      Key: key,
      Body: buffer,
      ContentType: mimetype,
    }));
    return publicUrl(key);
  } catch (err) {
    throw s3Error('upload', key, err);
  }
}

async function uploadPrivateFile(buffer, key, mimetype) {
  try {
    await s3.send(new PutObjectCommand({
      Bucket: privateBucket(),
      Key: key,
      Body: buffer,
      ContentType: mimetype,
    }));
    return key;
  } catch (err) {
    throw s3Error('upload', key, err);
  }
}

async function getPresignedUrl(key, expiresInSeconds = 3600) {
  try {
    const command = new GetObjectCommand({ Bucket: privateBucket(), Key: key });
    return getSignedUrl(s3, command, { expiresIn: expiresInSeconds });
  } catch (err) {
    throw s3Error('presign', key, err);
  }
}

async function deletePublicFile(key) {
  await s3.send(new DeleteObjectCommand({
    Bucket: publicBucket(),
    Key: key,
  }));
}

async function deletePrivateFile(key) {
  await s3.send(new DeleteObjectCommand({
    Bucket: privateBucket(),
    Key: key,
  }));
}

module.exports = {
  uploadPublicFile,
  uploadPrivateFile,
  getPresignedUrl,
  deletePublicFile,
  deletePrivateFile,
};
