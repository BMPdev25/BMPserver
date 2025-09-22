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
  origin: process.env.CLIENT_URL || true,
  credentials: true,
}));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Server is running', 
    timestamp: new Date().toISOString() 
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/priest', priestRoutes);
app.use('/api/devotee', devoteeRoutes);
app.use('/api/ratings', ratingRoutes);
app.use('/api/user', userRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/search', searchRoutes);

// Socket.IO real-time features
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  // Join user to their personal room for notifications
  socket.on('join', (userId) => {
    socket.join(`user_${userId}`);
    console.log(`User ${userId} joined their room`);
  });
  
  // Handle priest availability updates
  socket.on('priest_availability_update', (data) => {
    const { priestId, status } = data;
    socket.broadcast.emit('priest_availability_changed', { priestId, status });
  });
  
  // Handle booking status updates
  socket.on('booking_status_update', (data) => {
    const { bookingId, status, devoteeId, priestId } = data;
    
    // Notify both devotee and priest
    io.to(`user_${devoteeId}`).emit('booking_updated', { bookingId, status });
    io.to(`user_${priestId}`).emit('booking_updated', { bookingId, status });
  });
  
  // Handle real-time earnings updates
  socket.on('earnings_update', (data) => {
    const { priestId, amount, bookingId } = data;
    io.to(`user_${priestId}`).emit('earnings_updated', { amount, bookingId });
  });
  
  // Handle payment confirmations
  socket.on('payment_confirmed', (data) => {
    const { bookingId, devoteeId, priestId } = data;
    io.to(`user_${devoteeId}`).emit('payment_success', { bookingId });
    io.to(`user_${priestId}`).emit('payment_received', { bookingId });
  });
  
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Make io available to other modules
app.set('socketio', io);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    message: 'Something went wrong on the server'
  });
});

// Start server
const PORT = process.env.PORT || 5000;
const HOST = '0.0.0.0'; // Listen on all network interfaces for emulator access
server.listen(PORT, () => {
  console.log(`Server running on localhost:${PORT}`);
  console.log('Socket.IO enabled for real-time features');
});
