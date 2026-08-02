const cron = require('node-cron');
const moment = require('moment');
const Booking = require('../models/booking');
const Notification = require('../models/notification');
const pushService = require('../services/pushService');

// Run every hour to check for upcoming bookings
const scheduleReminders = () => {
  cron.schedule('0 * * * *', async () => {
    console.log('[Cron] Running scheduled job for booking reminders');
    try {
      const now = moment();

      // Look for confirmed bookings within a 3-day window to optimize query performance
      const today = moment().startOf('day').toDate();
      const dayAfterTomorrow = moment().add(2, 'days').endOf('day').toDate();
      const bookings = await Booking.find({
        status: 'confirmed',
        date: { $gte: today, $lte: dayAfterTomorrow },
      });

      for (const booking of bookings) {
        if (!booking.date || !booking.startTime) continue;

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
      createdAt: { $gte: moment().subtract(2, 'hours').toDate() },
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

// Every day at 8:00 AM IST (2:30 AM UTC)
const schedulePushReminders = () => {
  cron.schedule('30 2 * * *', async () => {
    console.log('[Cron] Running ceremony reminder job...');
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = tomorrow.toISOString().split('T')[0];

      const bookings = await Booking.find({
        date: {
          $gte: new Date(dateStr + 'T00:00:00.000Z'),
          $lt: new Date(dateStr + 'T23:59:59.999Z'),
        },
        status: 'confirmed',
      }).populate('devoteeId priestId', 'name');

      for (const booking of bookings) {
        await pushService.notifyBothCeremonyReminder(
          booking.devoteeId._id,
          booking.priestId._id,
          booking
        );
      }
      console.log(`[Cron] Sent reminders for ${bookings.length} ceremonies.`);
    } catch (err) {
      console.error('[Cron] Reminder job failed:', err.message);
    }
  });
};

// Every 15 minutes — cancel bookings whose payment window expired before payment
// was completed. Covers both 'pending' requests AND 'confirmed' bookings that a
// priest accepted before payment: without the 'confirmed' case those would sit
// unpaid forever (they can never be completed, which requires a paid status).
const runExpiredPaymentCleanup = async () => {
  const expired = await Booking.find({
    status: { $in: ['pending', 'confirmed'] },
    paymentStatus: { $ne: 'completed' },
    paymentExpiresAt: { $lt: new Date() },
  });
  for (const b of expired) {
    b.status = 'cancelled';
    b.cancellationReason = 'Payment not completed within time limit';
    b.cancellationDate = new Date();
    b.statusHistory.push({
      status: 'cancelled',
      timestamp: new Date(),
      reason: 'Payment not completed within time limit',
    });
    await b.save();

    // Let the devotee know their unpaid booking was released, and free the
    // priest's slot by notifying them too (only relevant once a priest is set).
    await sendReminder(
      b.devoteeId,
      b._id,
      'Booking Cancelled — Payment Not Completed',
      `Your ${b.ceremonyType} booking was cancelled because payment was not completed in time.`,
      'devotee'
    );
    if (b.priestId) {
      await sendReminder(
        b.priestId,
        b._id,
        'Booking Released — Payment Not Completed',
        `The ${b.ceremonyType} booking was cancelled because the devotee did not complete payment in time.`,
        'priest'
      );
    }
  }
  if (expired.length > 0) {
    console.log(`[Cron] Cancelled ${expired.length} expired unpaid bookings`);
  }
  return expired.length;
};

const scheduleExpiredPaymentCleanup = () => {
  cron.schedule('*/15 * * * *', async () => {
    try {
      await runExpiredPaymentCleanup();
    } catch (err) {
      console.error('[Cron] Expired payment cleanup failed:', err.message);
    }
  });
};

// Expire instant bookings that no priest accepted within their 10-minute TTL.
// Cancels them and nudges the devotee toward scheduling a specific pandit.
const runInstantExpiryCleanup = async () => {
  const expired = await Booking.find({
    bookingType: 'instant',
    status: 'searching',
    instantExpiresAt: { $lt: new Date() },
  });

  for (const b of expired) {
    // Use an atomic update (not .save()) — a 'searching' booking has no priestId,
    // and saving it as 'cancelled' would trip the priestId-required validator.
    await Booking.findByIdAndUpdate(b._id, {
      $set: {
        status: 'cancelled',
        cancellationReason: 'No pandit accepted within 10 minutes',
        cancellationDate: new Date(),
      },
      $push: {
        statusHistory: {
          status: 'cancelled',
          timestamp: new Date(),
          reason: 'No pandit accepted within 10 minutes',
        },
      },
    });

    await pushService.sendToUser(
      b.devoteeId,
      'No Pandit Found',
      'No pandit accepted your instant request. You can schedule with a specific pandit instead.',
      { screen: 'BookingsTab', bookingId: b._id.toString(), targetRole: 'devotee' },
      'booking'
    );
  }

  if (expired.length > 0) {
    console.log(`[Cron] Expired ${expired.length} instant bookings`);
  }
  return expired.length;
};

const scheduleInstantExpiryCleanup = () => {
  // Every 2 minutes.
  cron.schedule('*/2 * * * *', async () => {
    try {
      await runInstantExpiryCleanup();
    } catch (err) {
      console.error('[Cron] Instant expiry cleanup failed:', err.message);
    }
  });
};

// Every hour — delete stale 'searching' bookings older than 2 hours (no priest ever assigned)
const scheduleStaleSearchingCleanup = () => {
  cron.schedule('0 * * * *', async () => {
    try {
      const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000);
      const result = await Booking.deleteMany({
        status: 'searching',
        createdAt: { $lt: cutoff },
      });
      if (result.deletedCount > 0) {
        console.log(`[Cron] Cleaned ${result.deletedCount} stale searching bookings`);
      }
    } catch (err) {
      console.error('[Cron] Stale searching cleanup failed:', err.message);
    }
  });
};

module.exports = {
  scheduleReminders,
  schedulePushReminders,
  scheduleExpiredPaymentCleanup,
  scheduleStaleSearchingCleanup,
  scheduleInstantExpiryCleanup,
  runExpiredPaymentCleanup,
  runInstantExpiryCleanup,
};
