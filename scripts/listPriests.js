
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load env from root
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const User = require('../models/user');

const listUsers = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI, { dbName: 'bmp' });
        console.log('Connected to MongoDB');

        const users = await User.find({});
        console.log('--- ALL USERS ---');
        users.forEach(u => console.log(`Name: "${u.name}", Role: ${u.role}, ID: ${u._id}`));
        console.log('-------------------');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

listUsers();
