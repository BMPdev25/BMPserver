const axios = require('axios');

async function listPriests() {
  const url = `http://localhost:5000/api/devotee/priests/all`;
  
  try {
    const response = await axios.get(url);
    const data = response.data;
    
    console.log(`Found ${data.total} priests.`);
    
    // The getAllPriests endpoint might not populate services.
    // Let's also check searchPriests with no filters.
    const searchUrl = `http://localhost:5000/api/devotee/priests`;
    const searchResponse = await axios.get(searchUrl);
    const searchData = searchResponse.data;
    
    console.log(`\nSearch results (no filters): ${searchData.totalPriests} priests.`);
    if (searchData.priests) {
      searchData.priests.forEach((p, i) => {
        console.log(`\n${i+1}. Priest: ${p.name} [ID: ${p._id}]`);
        console.log(`   Services: ${JSON.stringify(p.services)}`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

listPriests();
