const { Expo } = require('expo-server-sdk');
const User = require('../models/user');
const Notification = require('../models/notification');

const expo = new Expo();

/**
 * Send a push notification to a single user.
 * Also creates a Notification record in MongoDB.
 *
 * @param {string} userId     - MongoDB User._id
 * @param {string} title      - Notification title
 * @param {string} body       - Notification body text
 * @param {object} data       - Extra data for navigation
 * @param {string} type       - 'booking' | 'payment' | 'system'
 */
async function sendToUser(userId, title, body, data = {}, type = 'booking') {
  try {
    // Always create in-app notification record
    await Notification.create({
      userId,
      title,
      message: body,
      type,
      targetRole: data.targetRole || 'devotee',
      relatedId: data.bookingId || null,
      read: false,
    });

    // Get user's push token
    const user = await User.findById(userId).select('expoPushToken');
    if (!user?.expoPushToken) return; // No token — in-app only
    if (!Expo.isExpoPushToken(user.expoPushToken)) return; // Invalid token

    const message = {
      to: user.expoPushToken,
      sound: 'default',
      title,
      body,
      data,
      priority: 'high',
      channelId: 'default',
    };

    const chunks = expo.chunkPushNotifications([message]);
    for (const chunk of chunks) {
      try {
        await expo.sendPushNotificationsAsync(chunk);
      } catch (err) {
        console.warn('[Push] Chunk send failed:', err.message);
      }
    }
  } catch (err) {
    // Never throw — push failure must not break the booking flow
    console.warn('[Push] sendToUser failed:', err.message);
  }
}

/**
 * Pre-built notification templates for every booking event.
 * Call these from bookingService.js after status changes.
 */

async function notifyPriestNewRequest(priestId, booking) {
  await sendToUser(
    priestId,
    'New Booking Request 🙏',
    `${booking.devoteeId?.name || 'A devotee'} has requested ` +
      `${booking.ceremonyType} on ` +
      `${new Date(booking.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`,
    {
      screen: 'RequestsTab',
      bookingId: booking._id.toString(),
      targetRole: 'priest',
    },
    'booking'
  );
}

async function notifyDevoteeBookingConfirmed(devoteeId, booking) {
  await sendToUser(
    devoteeId,
    'Booking Confirmed ✅',
    `Your ${booking.ceremonyType} on ` +
      `${new Date(booking.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} ` +
      `has been confirmed by your pandit.`,
    {
      screen: 'BookingDetails',
      bookingId: booking._id.toString(),
      targetRole: 'devotee',
    },
    'booking'
  );
}

async function notifyDevoteeBookingDeclined(devoteeId, booking) {
  await sendToUser(
    devoteeId,
    'Booking Request Declined',
    `Your request for ${booking.ceremonyType} was declined. ` +
      `Browse other pandits to find an alternative.`,
    {
      screen: 'ExploreTab',
      bookingId: booking._id.toString(),
      targetRole: 'devotee',
    },
    'booking'
  );
}

async function notifyPriestBookingCancelled(priestId, booking) {
  await sendToUser(
    priestId,
    'Booking Cancelled',
    `The ${booking.ceremonyType} booking for ` +
      `${new Date(booking.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} ` +
      `has been cancelled by the devotee.`,
    {
      screen: 'CalendarTab',
      bookingId: booking._id.toString(),
      targetRole: 'priest',
    },
    'booking'
  );
}

async function notifyDevoteeCancelledByPriest(devoteeId, booking) {
  await sendToUser(
    devoteeId,
    'Booking Cancelled by Pandit',
    `Your ${booking.ceremonyType} booking has been cancelled. ` + `Please book another pandit.`,
    {
      screen: 'BookingsTab',
      bookingId: booking._id.toString(),
      targetRole: 'devotee',
    },
    'booking'
  );
}

async function notifyPriestPaymentCredited(priestId, booking, amount) {
  await sendToUser(
    priestId,
    'Payment Credited 💰',
    `₹${amount.toLocaleString('en-IN')} has been credited to your ` +
      `wallet for ${booking.ceremonyType}.`,
    {
      screen: 'EarningsTab',
      bookingId: booking._id.toString(),
      targetRole: 'priest',
    },
    'payment'
  );
}

async function notifyDevoteePriestFoundPayNow(devoteeId, booking) {
  await sendToUser(
    devoteeId,
    'Pandit Found! ⚡ Complete Payment',
    `A pandit accepted your ${booking.ceremonyType} request. Complete payment now to confirm.`,
    {
      screen: 'SearchingForPriest',
      bookingId: booking._id.toString(),
      targetRole: 'devotee',
    },
    'booking'
  );
}

async function notifyBothCeremonyReminder(devoteeId, priestId, booking) {
  const dateStr = new Date(booking.date).toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  await sendToUser(
    devoteeId,
    'Ceremony Tomorrow 🕉️',
    `Your ${booking.ceremonyType} is scheduled for tomorrow, ${dateStr}.`,
    {
      screen: 'BookingDetails',
      bookingId: booking._id.toString(),
      targetRole: 'devotee',
    },
    'booking'
  );
  await sendToUser(
    priestId,
    'Ceremony Tomorrow',
    `Reminder: ${booking.ceremonyType} is scheduled for tomorrow, ${dateStr}.`,
    {
      screen: 'CalendarTab',
      bookingId: booking._id.toString(),
      targetRole: 'priest',
    },
    'booking'
  );
}

module.exports = {
  sendToUser,
  notifyPriestNewRequest,
  notifyDevoteeBookingConfirmed,
  notifyDevoteeBookingDeclined,
  notifyPriestBookingCancelled,
  notifyDevoteeCancelledByPriest,
  notifyPriestPaymentCredited,
  notifyBothCeremonyReminder,
  notifyDevoteePriestFoundPayNow,
};
