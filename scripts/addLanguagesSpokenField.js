// Direct MongoDB migration to add languagesSpoken field
require('dotenv').config();
const { MongoClient } = require('mongodb');

const addLanguagesSpokenField = async () => {
  const client = new MongoClient(process.env.MONGODB_URI);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db();
    const usersCollection = db.collection('users');

    // Update all users who don't have languagesSpoken field
    const result = await usersCollection.updateMany(
      { languagesSpoken: { $exists: false } },
      { $set: { languagesSpoken: [] } }
    );

    console.log(`\nMigration complete!`);
    console.log(`Modified: ${result.modifiedCount} users`);
    console.log(`Matched: ${result.matchedCount} users`);

    // Verify the update
    const samplePriest = await usersCollection.findOne({ userType: 'priest' });
    console.log('\nSample priest user:');
    console.log(`- Name: ${samplePriest?.name}`);
    console.log(`- Email: ${samplePriest?.email}`);
    console.log(`- Has languagesSpoken: ${samplePriest?.languagesSpoken !== undefined}`);
    console.log(`- languagesSpoken value: ${JSON.stringify(samplePriest?.languagesSpoken)}`);

    // Count total users with languagesSpoken field
    const totalWithField = await usersCollection.countDocuments({ languagesSpoken: { $exists: true } });
    const totalUsers = await usersCollection.countDocuments({});
    console.log(`\nTotal users: ${totalUsers}`);
    console.log(`Users with languagesSpoken field: ${totalWithField}`);

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('\nDatabase connection closed');
  }
};

addLanguagesSpokenField();
