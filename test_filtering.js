const axios = require('axios');

async function testFiltering() {
  const ceremony = 'Satyanarayan Puja';
  const url = `http://localhost:5000/api/devotee/priests?ceremony=${encodeURIComponent(ceremony)}`;
  
  console.log(`Testing filtering for ceremony: ${ceremony}`);
  console.log(`URL: ${url}`);
  
  try {
    const response = await axios.get(url);
    const data = response.data;
    
    console.log(`Total priests found: ${data.totalPriests}`);
    
    if (data.priests && data.priests.length > 0) {
      console.log('Results:');
      data.priests.forEach((priest, index) => {
        const hasCeremony = priest.services.some(s => s.name.toLowerCase().includes(ceremony.toLowerCase()));
        console.log(`${index + 1}. ${priest.name} - Match: ${hasCeremony}`);
        if (!hasCeremony) {
          console.log(`   Services: ${priest.services.map(s => s.name).join(', ')}`);
        }
      });
      
      const allMatch = data.priests.every(priest => 
        priest.services.some(s => s.name.toLowerCase().includes(ceremony.toLowerCase()))
      );
      
      if (allMatch) {
        console.log('\nSUCCESS: All returned priests offer the requested ceremony.');
      } else {
        console.log('\nFAILURE: Some returned priests DO NOT offer the requested ceremony.');
      }
    } else {
      console.log('No priests found for this ceremony.');
    }
  } catch (error) {
    console.error('Error during API call:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data));
    }
  }
}

testFiltering();
