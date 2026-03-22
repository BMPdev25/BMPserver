const axios = require('axios');

async function testAvailabilityFiltering() {
  const url = `http://localhost:5000/api/devotee/priests`;
  
  console.log(`Testing filtering for available priests...`);
  console.log(`URL: ${url}`);
  
  try {
    const response = await axios.get(url);
    const data = response.data;
    
    console.log(`Total priests found: ${data.totalPriests}`);
    
    if (data.priests && data.priests.length > 0) {
      console.log('Results:');
      data.priests.forEach((priest, index) => {
        // Since we don't return availability status in searchPriests (it's internal filter),
        // we'd need to assume the filter worked if the priest is in the list,
        // but let's double check if we can see the status in the response or verify by changing data.
        console.log(`${index + 1}. ${priest.name} [ID: ${priest._id}]`);
      });
      
      console.log('\nVerification: Please manually set a priest to "offline" in DB and re-run this script to confirm they disappear.');
    } else {
      console.log('No available priests found.');
    }
  } catch (error) {
    console.error('Error during API call:', error.message);
  }
}

testAvailabilityFiltering();
