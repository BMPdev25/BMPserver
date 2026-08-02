// scripts/test-s3.js — run with: node scripts/test-s3.js
require('dotenv').config()
const { uploadPublicFile, uploadPrivateFile, 
        getPresignedUrl, deletePublicFile } = require('../services/storageService')

async function test() {
  console.log('Testing S3 setup...\n')
  
  const testBuffer = Buffer.from('Hello Sacred Connect')
  
  // Test 1: Upload to public bucket
  console.log('1. Uploading to public bucket...')
  const publicUrl = await uploadPublicFile(
    testBuffer, 
    'test/test-file.txt', 
    'text/plain'
  )
  console.log('   ✅ Public URL:', publicUrl)
  
  // Test 2: Upload to private bucket
  console.log('2. Uploading to private bucket...')
  const privateKey = await uploadPrivateFile(
    testBuffer,
    'test/test-document.txt',
    'text/plain'
  )
  console.log('   ✅ Private key:', privateKey)
  
  // Test 3: Generate presigned URL
  console.log('3. Generating presigned URL...')
  const presignedUrl = await getPresignedUrl(privateKey, 60)
  console.log('   ✅ Presigned URL generated (expires in 60s)')
  console.log('   Open this URL in browser to verify:', presignedUrl)
  
  // Test 4: Delete test files
  console.log('4. Cleaning up test files...')
  await deletePublicFile('test/test-file.txt')
  console.log('   ✅ Test file deleted')
  
  console.log('\n✅ All S3 tests passed. Buckets are configured correctly.')
}

test().catch(err => {
  console.error('\n❌ S3 test failed:', err.message)
  console.error('Check your AWS credentials and bucket names in .env')
})