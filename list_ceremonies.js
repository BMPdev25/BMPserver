const axios = require('axios');

async function listCeremonies() {
  const url = `http://localhost:5000/api/ceremonies`;
  
  try {
    const response = await axios.get(url);
    const data = response.data;
    
    console.log('Ceremonies in Database:');
    if (Array.isArray(data)) {
      data.forEach((c, i) => {
        console.log(`${i + 1}. [${c._id}] ${c.name} (Active: ${c.isActive})`);
      });
    } else if (data.ceremonies) {
       data.ceremonies.forEach((c, i) => {
        console.log(`${i + 1}. [${c._id}] ${c.name} (Active: ${c.isActive})`);
      });
    } else {
        console.log('Unexpected response format:', JSON.stringify(data));
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

listCeremonies();
