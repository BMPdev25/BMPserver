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
const metadataRoutes = require('./routes/metadataRoutes');
const { scheduleReminders } = require('./jobs/cronJobs');

// Load environment variables
dotenv.config();

// Start cron jobs
scheduleReminders();

// Create Express app
const app = express();
const server = http.createServer(app);

const io = socketIo(server, {
  cors: {
    origin: process.env.CLIENT_URL || "*",
    methods: ["GET", "POST"]
  }
});

// Map to store connected users and their socket IDs
const userSockets = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('register', (userId) => {
    if (userId) {
      userSockets.set(userId.toString(), socket.id);
      socket.userId = userId.toString();
      console.log(`User ${userId} registered with socket ${socket.id}`);
    }
  });

  socket.on('disconnect', () => {
    if (socket.userId) {
      userSockets.delete(socket.userId);
      console.log(`User ${socket.userId} disconnected`);
    }
  });
});

// Make io and userSockets accessible in controllers
app.set('io', io);
app.set('userSockets', userSockets);

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
app.use('/api/metadata', metadataRoutes);

// Dev-Only Test Fixtures for Maestro (Protected internally by NODE_ENV)
app.use('/api/test', require('./routes/testFixtures'));

// Connect to MongoDB and Start Server only if run directly
if (require.main === module) {
  mongoose.connect(process.env.MONGO_URI, { dbName: 'bmp' })
    .then(() => console.log('MongoDB connected to bmp'))
    .catch(err => console.error('MongoDB connection error:', err));

  const PORT = process.env.PORT || 5000;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on 0.0.0.0:${PORT}`);
    console.log('Socket.IO enabled for real-time features');
  });
}

module.exports = { app, server };

