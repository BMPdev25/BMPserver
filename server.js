// server/server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const socketIo = require('socket.io');
const helmet = require('helmet');
const compression = require('compression');

// Import routes
const authRoutes = require('./routes/authRoutes');
const priestRoutes = require('./routes/priestRoutes');
const devoteeRoutes = require('./routes/devoteeRoutes');
const ratingRoutes = require('./routes/ratingRoutes');
const userRoutes = require('./routes/userRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const searchRoutes = require('./routes/searchRoutes');
const ceremonyRoutes = require("./routes/ceremonyRoutes");
const languageRoutes = require('./routes/languageRoutes');
const walletRoutes = require('./routes/walletRoutes');
const reviewRoutes = require('./routes/reviewRoutes');

// Load environment variables
dotenv.config();

// Create Express app
const app = express();
const server = http.createServer(app);

// Initialize Socket.IO for real-time features
const io = socketIo(server, {
  cors: {
    origin: process.env.CLIENT_URL || "*",
    methods: ["GET", "POST"]
  }
});

// Security and performance middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP for development
}));
app.use(compression());

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cors({
  origin: '*',
  credentials: true,
}));

// Serve static files
app.use('/public', express.static('public'));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Register API routes
app.use('/api/auth', authRoutes);
app.use('/api/priest', priestRoutes);  // Changed from /api/priests to /api/priest
app.use('/api/devotee', devoteeRoutes);  // Changed from /api/devotees to /api/devotee
app.use('/api/ratings', ratingRoutes);
app.use('/api/users', userRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/ceremonies', ceremonyRoutes);
app.use('/api/languages', languageRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/reviews', reviewRoutes);

// Connect to MongoDB and Start Server only if run directly
if (require.main === module) {
  mongoose.connect(process.env.MONGO_URI, { dbName: 'bmp' })
    .then(() => console.log('MongoDB connected to bmp'))
    .catch(err => console.error('MongoDB connection error:', err));

  const PORT = process.env.PORT || 5000;
  // const HOST = '0.0.0.0'; 
  server.listen(PORT, () => {
    console.log(`Server running on localhost:${PORT}`);
    console.log('Socket.IO enabled for real-time features');
  });
}

module.exports = { app, server };

