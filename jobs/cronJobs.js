const cron = require('node-cron');
const moment = require('moment');
const Booking = require('../models/booking');
const Notification = require('../models/notification');

// Run every hour to check for upcoming bookings
const scheduleReminders = () => {
  cron.schedule('0 * * * *', async () => {
    console.log('[Cron] Running scheduled job for booking reminders');
    try {
      const now = moment();
      
      // Look for confirmed bookings
      const bookings = await Booking.find({ status: 'confirmed' });

      for (const booking of bookings) {
        if (!booking.date || !booking.time) continue;

        // Create a moment object for the booking start time
        // Assuming time is in "HH:MM AM/PM" or "HH:MM" format
        const bookingDateTime = moment(
          `${moment(booking.date).format('YYYY-MM-DD')} ${booking.startTime}`,
          ['YYYY-MM-DD HH:mm A', 'YYYY-MM-DD HH:mm']
        );

        if (!bookingDateTime.isValid()) continue;

        const hoursUntilBooking = bookingDateTime.diff(now, 'hours');

        // 1. Day Before Reminder (Approx 24 hours before)
        if (hoursUntilBooking === 24) {
          // Notify Devotee
          await sendReminder(
            booking.devoteeId,
            booking._id,
            'Upcoming Puja Tomorrow',
            `Your booking for ${booking.ceremonyType} is scheduled for tomorrow at ${booking.startTime}.`,
            'devotee'
          );
          
          // Notify Priest
          await sendReminder(
            booking.priestId,
            booking._id,
            'Upcoming Puja Tomorrow',
            `You have a ${booking.ceremonyType} scheduled tomorrow at ${booking.startTime}.`,
            'priest'
          );
        }

        // 2. Morning-Of Reminder (Approx 2 hours before)
        if (hoursUntilBooking === 2) {
           // Notify Devotee
           await sendReminder(
            booking.devoteeId,
            booking._id,
            'Puja Starting Soon',
            `Your ${booking.ceremonyType} is starting in 2 hours.`,
            'devotee'
          );
          
          // Notify Priest
          await sendReminder(
            booking.priestId,
            booking._id,
            'Puja Starting Soon',
            `Your ${booking.ceremonyType} is starting in 2 hours.`,
            'priest'
          );
        }
      }
    } catch (error) {
      console.error('[Cron] Error running reminder jobs:', error);
    }
  });
};

const sendReminder = async (userId, relatedId, title, message, targetRole) => {
  try {
    // Check if notification already exists to prevent duplicate spam within the same hour
    const existing = await Notification.findOne({
      userId,
      relatedId,
      title,
      createdAt: { $gte: moment().subtract(2, 'hours').toDate() }
    });

    if (!existing) {
      await Notification.createNotification({
        userId,
        title,
        message,
        type: 'reminder',
        targetRole,
        relatedId,
      });
    }
  } catch (err) {
    console.error(`Error sending reminder to ${userId}:`, err);
  }
};

module.exports = { scheduleReminders };
