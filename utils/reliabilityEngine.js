/**
 * reliabilityEngine.js
 * Recalculates a priest's completionRate based on their booking history.
 * Formula: completionRate = (completed / (completed + cancelled)) * 100
 * If no terminal bookings, defaults to 100.
 */

const Booking = require('../models/booking');
const PriestProfile = require('../models/priestProfile');

/**
 * Recalculate and persist the priest's completion rate.
 * @param {string} priestUserId - The User._id of the priest
 * @returns {Object} { completionRate, completed, cancelled, total }
 */
async function recalculateReliability(priestUserId) {
  // Count completed and cancelled bookings for this priest
  const [completed, cancelled] = await Promise.all([
    Booking.countDocuments({ priestId: priestUserId, status: 'completed' }),
    Booking.countDocuments({ priestId: priestUserId, status: 'cancelled' }),
  ]);

  const total = completed + cancelled;
  const completionRate = total === 0 ? 100 : Math.round((completed / total) * 100);

  // Persist to PriestProfile.analytics.completionRate
  await PriestProfile.findOneAndUpdate(
    { userId: priestUserId },
    { 'analytics.completionRate': completionRate },
    { new: true }
  );

  return { completionRate, completed, cancelled, total };
}

/**
 * Determine the reliability badge color based on completionRate.
 * @param {number} completionRate - 0-100
 * @param {number} totalBookings - total terminal bookings
 * @returns {'green' | 'yellow' | 'red' | 'none'}
 */
function getReliabilityBadge(completionRate, totalBookings) {
  if (totalBookings < 5) return 'none'; // Too few bookings to judge
  if (completionRate >= 90) return 'green';
  if (completionRate >= 70) return 'yellow';
  return 'red';
}

/**
 * Recalculate and persist the devotee's reliability score.
 * @param {string} devoteeUserId - The User._id of the devotee
 * @param {'completion' | 'cancellation' | 'late_cancellation'} actionType
 */
async function updateDevoteeReliability(devoteeUserId, actionType) {
  const User = require('../models/user');
  const user = await User.findById(devoteeUserId);
  if (!user || user.userType !== 'devotee') return;

  if (!user.devoteeReliability) {
    user.devoteeReliability = { score: 100, cancellationCount: 0, lateCancellationCount: 0, completedCount: 0 };
  }

  if (actionType === 'completion') {
    user.devoteeReliability.completedCount += 1;
    user.devoteeReliability.score = Math.min(100, (user.devoteeReliability.score || 100) + 2);
  } else if (actionType === 'cancellation') {
    user.devoteeReliability.cancellationCount += 1;
    user.devoteeReliability.score = Math.max(0, (user.devoteeReliability.score || 100) - 5);
  } else if (actionType === 'late_cancellation') {
    user.devoteeReliability.lateCancellationCount += 1;
    user.devoteeReliability.score = Math.max(0, (user.devoteeReliability.score || 100) - 20);
  }

  await user.save();
  return user.devoteeReliability;
}

module.exports = { recalculateReliability, getReliabilityBadge, updateDevoteeReliability };
