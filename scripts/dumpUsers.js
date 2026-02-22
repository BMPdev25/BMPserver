const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
dotenv.config({ path: path.resolve(__dirname, '../.env') });
const User = require('../models/user');

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: 'bmp' });
  const users = await User.find({}).select('name email phone role userType').lean();
  const output = users.map(u => `${u.userType || u.role} | ${u.name} | email:${u.email} | phone:${u.phone}`).join('\n');
  fs.writeFileSync(path.resolve(__dirname, '../users_dump.txt'), output);
  console.log('Written to users_dump.txt');
  process.exit(0);
};
run().catch(e => { console.error(e); process.exit(1); });
