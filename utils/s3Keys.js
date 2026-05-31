function priestProfilePicKey(userId) {
  return `profiles/priests/${userId}.jpg`;
}

function devoteeProfilePicKey(userId) {
  return `profiles/devotees/${userId}.jpg`;
}

function priestDocumentKey(userId, documentType, mimetype) {
  // Extension derived from mimetype so images and PDFs are stored correctly
  const ext = mimetype && mimetype.startsWith('image/') ? 'jpg' : 'pdf';
  return `documents/priests/${userId}/${documentType}.${ext}`;
}

function ceremonyImageKey(ceremonyId, index) {
  return `ceremonies/${ceremonyId}/image${index}.jpg`;
}

// Parse the key back from a full S3 or CloudFront URL
function keyFromPublicUrl(url) {
  const patterns = [
    /https?:\/\/[^/]+\.cloudfront\.net\/(.+)/,
    /https?:\/\/[^/]+\.s3\.[^/]+\.amazonaws\.com\/(.+)/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

module.exports = {
  priestProfilePicKey,
  devoteeProfilePicKey,
  priestDocumentKey,
  ceremonyImageKey,
  keyFromPublicUrl,
};
