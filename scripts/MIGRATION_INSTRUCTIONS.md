# Manual Database Migration for languagesSpoken Field

## Option 1: Using MongoDB Shell (mongosh)

```bash
# Connect to your MongoDB
mongosh "your_mongodb_connection_string"

# Switch to your database
use your_database_name

# Add languagesSpoken field to all users who don't have it
db.users.updateMany(
  { languagesSpoken: { $exists: false } },
  { $set: { languagesSpoken: [] } }
)

# Verify the update
db.users.findOne({ userType: "priest" })
```

## Option 2: Using MongoDB Compass

1. Open MongoDB Compass
2. Connect to your database
3. Navigate to the `users` collection
4. Click on "Aggregations" tab
5. Add this pipeline:
```json
[
  {
    "$match": {
      "languagesSpoken": { "$exists": false }
    }
  },
  {
    "$set": {
      "languagesSpoken": []
    }
  },
  {
    "$merge": {
      "into": "users",
      "whenMatched": "replace"
    }
  }
]
```
6. Click "Run"

## Option 3: Simple Node Script (if mongodb package is installed)

```javascript
// Run this in BMPserver directory: node quickMigration.js
const { MongoClient } = require('mongodb');

async function migrate() {
  const uri = process.env.MONGODB_URI || 'your_connection_string_here';
  const client = await MongoClient.connect(uri);
  const db = client.db();
  
  const result = await db.collection('users').updateMany(
    { languagesSpoken: { $exists: false } },
    { $set: { languagesSpoken: [] } }
  );
  
  console.log(`Updated ${result.modifiedCount} users`);
  await client.close();
}

migrate().catch(console.error);
```

## Verification

After running the migration, verify with:

```bash
# In mongosh
db.users.find({ userType: "priest" }).limit(1)
```

You should see `languagesSpoken: []` in the output.

## What This Does

- Adds an empty `languagesSpoken` array to all existing users
- New users will automatically get this field from the schema
- Priests can then update their languages via ProfileSetup
