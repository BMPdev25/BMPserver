# Database Migration Guides

This folder contains instructions for performing manual or automated migrations on the BMPserver database.

## Migration: Adding `languagesSpoken` Field to Users

This migration ensures all existing user documents have the `languagesSpoken` array initialized.

### Option 1: MongoDB Shell (mongosh)
```bash
# Connect and switch to database
use bmp

# Initialize field for all users
db.users.updateMany(
  { languagesSpoken: { $exists: false } },
  { $set: { languagesSpoken: [] } }
)
```

### Option 2: Node.js Script
Run a simple script to perform the update:
```javascript
const { MongoClient } = require('mongodb');

async function migrate() {
  const uri = process.env.MONGODB_URI;
  const client = await MongoClient.connect(uri);
  const db = client.db();

  const result = await db
    .collection('users')
    .updateMany({ languagesSpoken: { $exists: false } }, { $set: { languagesSpoken: [] } });

  console.log(`Updated ${result.modifiedCount} users`);
  await client.close();
}
```

### Verification
Verify the update by checking a priest user:
```bash
db.users.findOne({ userType: "priest" })
```
Expected output: `languagesSpoken: []`
