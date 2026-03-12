// models/notification.js
const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    enum: ['booking', 'payment', 'reminder', 'general', 'withdrawal'],
    required: true,
  },
  read: {
    type: Boolean,
    default: false,
  },
  relatedId: {
    type: mongoose.Schema.Types.ObjectId,
    // This can reference a booking, transaction, etc.
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Create indexes for better query performance
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, read: 1 });
notificationSchema.index({ createdAt: -1 });

// Update the updatedAt field before saving
notificationSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const { Expo } = require('expo-server-sdk');
let expo = new Expo();

// Helper method to create notifications
notificationSchema.statics.createNotification = async function(data) {
  try {
    const notification = new this(data);
    await notification.save();

    // Send push notification via Expo if token exists
    mongoose.model('User').findById(data.userId).then(async (user) => {
      if (user && user.expoPushToken && Expo.isExpoPushToken(user.expoPushToken)) {
        let messages = [];
        messages.push({
          to: user.expoPushToken,
          sound: 'default',
          title: data.title,
          body: data.message,
          data: { relatedId: data.relatedId, type: data.type },
        });

        try {
          let chunks = expo.chunkPushNotifications(messages);
          for (let chunk of chunks) {
            let ticketChunk = await expo.sendPushNotificationsAsync(chunk);
            console.log('Push notification sent:', ticketChunk);
          }
        } catch (pushError) {
          console.error('Error sending push notification via Expo:', pushError);
        }
      }
    }).catch(err => {
      console.error('Error fetching user for push notification:', err);
    });

    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
};

module.exports = mongoose.model('Notification', notificationSchema);
