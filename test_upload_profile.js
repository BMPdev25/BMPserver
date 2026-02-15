const fs = require('fs');

const API_URL = 'http://localhost:5000/api';

async function testUpload() {
  try {
    // 1. Login or Register
    const email = `test.upload.${Date.now()}@example.com`;
    const password = 'password123';
    
    // Register
    const registerRes = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Upload Tester',
        email,
        password,
        phone: `888${Date.now().toString().slice(-7)}`,
        userType: 'devotee'
      })
    });
    const registerData = await registerRes.json();
    const token = registerData.token;
    console.log('User registered/logged in. Token:', token ? 'YES' : 'NO');

    // 2. Upload Profile Picture
    const formData = new FormData();
    const fileContent = fs.readFileSync('test.jpg');
    const blob = new Blob([fileContent], { type: 'image/jpeg' });
    formData.append('profilePicture', blob, 'test.jpg');

    console.log('Uploading profile picture...');
    const uploadRes = await fetch(`${API_URL}/users/profile/picture`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: formData
    });

    const uploadText = await uploadRes.text();
    console.log('Upload status:', uploadRes.status);
    fs.writeFileSync('upload_error.html', uploadText);
    console.log('Error response saved to upload_error.html');

    try {
      const uploadData = JSON.parse(uploadText);
      console.log('Upload JSON response:', uploadData);
    } catch (e) {
      console.log('Response is not JSON');
    }

  } catch (error) {
    console.error('Test failed:', error);
  }
}

testUpload();
