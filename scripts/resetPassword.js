
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const updatePassword = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI, { dbName: 'bmp' });
        console.log('Connected to DB');
        
        const salt = await bcrypt.genSalt(10);
        const password = 'password123';
        const hashedPassword = await bcrypt.hash(password, salt);
        
        const res = await mongoose.connection.collection('users').updateOne(
            { email: 'devotee1@example.com' },
            { $set: { password: hashedPassword } }
        );
        
        console.log('Update result:', res);
        
    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
        process.exit();
    }
};
updatePassword();
