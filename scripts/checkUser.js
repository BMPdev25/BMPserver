
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load env
dotenv.config();

const userSchema = new mongoose.Schema({
  email: { type: String, required: true },
  password: { type: String }
});

const User = mongoose.model('User', userSchema);

const checkUser = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI, { dbName: 'bmp' });
        
        const user = await User.findOne({ email: 'devotee1@example.com' });
        
        if (user) {
            console.log('--- PASSWORD START ---');
            console.log(user.password);
            console.log('--- PASSWORD END ---');
        } else {
            console.log('User not found');
        }
        
    } catch (e) {
        console.error('Error:', e);
    } finally {
        await mongoose.disconnect();
        process.exit();
    }
};

checkUser();
