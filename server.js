// server/server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const socketIo = require('socket.io');
const helmet = require('helmet');
const compression = require('compression');
const admin = require('./config/firebase');
const User = require('./models/user');

// Import routes
const authRoutes = require('./routes/authRoutes');
const priestRoutes = require('./routes/priestRoutes');
const devoteeRoutes = require('./routes/devoteeRoutes');
const ratingRoutes = require('./routes/ratingRoutes');
const userRoutes = require('./routes/userRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const searchRoutes = require('./routes/searchRoutes');
const ceremonyRoutes = require('./routes/ceremonyRoutes');
const languageRoutes = require('./routes/languageRoutes');
const walletRoutes = require('./routes/walletRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const metadataRoutes = require('./routes/metadataRoutes');
const adminRoutes = require('./routes/adminRoutes');
const {
  scheduleReminders,
  schedulePushReminders,
  scheduleExpiredPaymentCleanup,
  scheduleStaleSearchingCleanup,
  scheduleInstantExpiryCleanup,
} = require('./jobs/cronJobs');

// Load environment variables
dotenv.config();

// Start cron jobs
if (process.env.NODE_ENV !== 'test') {
  scheduleReminders();
  schedulePushReminders();
  scheduleExpiredPaymentCleanup();
  scheduleStaleSearchingCleanup();
  scheduleInstantExpiryCleanup();
}

// Create Express app
const app = express();
const server = http.createServer(app);

const io = socketIo(server, {
  cors: {
    origin: process.env.CLIENT_URL || '*',
    methods: ['GET', 'POST'],
  },
});

// Map to store connected users and their socket IDs
const userSockets = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('register', async (token) => {
    if (!token) return;
    try {
      const decoded = await admin.auth().verifyIdToken(token);
      const user = await User.findOne({ firebaseUid: decoded.uid }).select('_id').lean();
      if (!user) return;
      const uid = user._id.toString();
      userSockets.set(uid, socket.id);
      socket.userId = uid;
      console.log(`[Socket] ${uid} registered with socket ${socket.id}`);
    } catch {
      // Invalid or expired token — refuse registration silently
    }
  });

  socket.on('disconnect', () => {
    if (socket.userId) {
      userSockets.delete(socket.userId);
      console.log(`[Socket] ${socket.userId} disconnected`);
    }
  });
});

// Make io and userSockets accessible in controllers (via req.app) and in
// services that have no request context (via globals — used by the instant
// booking broadcast).
app.set('io', io);
app.set('userSockets', userSockets);
global.io = io;
global.userSockets = userSockets;

// Security and performance middleware
app.use(helmet());
app.use(compression());

// Middleware
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    credentials: true,
  })
);

// Serve static files
app.use('/public', express.static('public'));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Register API routes
app.use('/api/auth', authRoutes);
app.use('/api/priest', priestRoutes); // Changed from /api/priests to /api/priest
app.use('/api/devotee', devoteeRoutes); // Changed from /api/devotees to /api/devotee
app.use('/api/ratings', ratingRoutes);
app.use('/api/users', userRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/ceremonies', ceremonyRoutes);
app.use('/api/languages', languageRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/metadata', metadataRoutes);
app.use('/api/admin', adminRoutes);

// Dev-Only Test Fixtures for Maestro (Protected internally by NODE_ENV)
app.use('/api/test', require('./routes/testFixtures'));

// Centralized Error Handler
const errorHandler = require('./middleware/errorHandler');
app.use(errorHandler);

// Connect to MongoDB and Start Server only if run directly
if (require.main === module) {
  mongoose
    .connect(process.env.MONGO_URI, { dbName: 'bmp' })
    .then(() => console.log('MongoDB connected to bmp'))
    .catch((err) => console.error('MongoDB connection error:', err));

  const PORT = process.env.PORT || 5000;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on 0.0.0.0:${PORT}`);
    console.log('Socket.IO enabled for real-time features');
  });

  const shutdown = (signal) => {
    console.log(`${signal} received — shutting down gracefully`);
    server.close(() => {
      mongoose.connection.close(false, () => {
        console.log('MongoDB connection closed');
        process.exit(0);
      });
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

module.exports = { app, server };
