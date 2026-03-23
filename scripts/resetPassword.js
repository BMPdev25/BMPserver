const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const updatePassword = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, { dbName: 'bmp' });
    console.log('Connected to DB');

    // List all priests
    const priests = await mongoose.connection
      .collection('users')
      .find({ userType: 'priest' }, { projection: { name: 1, email: 1, phone: 1 } })
      .toArray();
    console.log('=== PRIEST ACCOUNTS ===');
    priests.forEach((p) =>
      console.log(`Name: ${p.name} | Email: ${p.email} | Phone: ${p.phone} | ID: ${p._id}`)
    );
    console.log('=======================');

    if (priests.length === 0) {
      console.log('No priest accounts found!');
      return;
    }

    // Reset password for the first priest found
    const targetPriest = priests[0];
    const salt = await bcrypt.genSalt(10);
    const newPassword = 'password123';
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    const res = await mongoose.connection
      .collection('users')
      .updateOne({ _id: targetPriest._id }, { $set: { password: hashedPassword } });

    console.log(
      `\nPassword reset for: ${targetPriest.name} (${targetPriest.email || targetPriest.phone})`
    );
    console.log('New password: password123');
    console.log('Update result:', res);
  } catch (e) {
    console.error(e);
  } finally {
    await mongoose.disconnect();
    process.exit();
  }
};
updatePassword();
