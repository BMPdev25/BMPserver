const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(__dirname, '../.env') });
const User = require('../models/user');

const listAll = async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: 'bmp' });
  const users = await User.find({}).select('name email phone role userType').lean();
  console.log(
    JSON.stringify(
      users.map((u) => ({
        name: u.name,
        email: u.email,
        phone: u.phone,
        role: u.role,
        userType: u.userType,
        id: u._id,
      })),
      null,
      2
    )
  );
  process.exit(0);
};
listAll().catch((e) => {
  console.error(e);
  process.exit(1);
});
