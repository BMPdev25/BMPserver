// utils/dateWindows.js
//
// India Standard Time (UTC+5:30) date-window helpers used to decide whether a
// requested booking date falls in the INSTANT window (today … day+2) or the
// SCHEDULED window (day+3 onwards). Booking dates are calendar days, so all
// boundary math is done in IST to avoid the UTC midnight-rollover bug.

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** Current instant shifted into IST wall-clock (as a Date whose UTC fields read IST). */
function nowIST() {
  return new Date(Date.now() + IST_OFFSET_MS);
}

/** The UTC instant corresponding to IST-midnight of the IST day containing `date`. */
function toISTMidnight(date) {
  const ist = new Date(date.getTime() + IST_OFFSET_MS);
  ist.setUTCHours(0, 0, 0, 0);
  return new Date(ist.getTime() - IST_OFFSET_MS);
}

/**
 * Compute the instant/scheduled window boundaries as UTC instants.
 *  - minInstantDate:    earliest allowed booking time (now + 2h)
 *  - maxInstantDate:    exclusive upper bound = IST midnight of day+3
 *  - scheduledStartDate: inclusive lower bound for scheduled = IST midnight of day+3
 */
function getInstantWindowUTC() {
  const todayIST = toISTMidnight(new Date());

  // Day+3 midnight IST = start of the scheduled window.
  const scheduledStart = new Date(todayIST);
  scheduledStart.setDate(scheduledStart.getDate() + 3);

  // Minimum booking lead time: now + 2 hours.
  const minBookingTime = new Date(Date.now() + 2 * 60 * 60 * 1000);

  return {
    minInstantDate: minBookingTime,
    maxInstantDate: scheduledStart,
    scheduledStartDate: scheduledStart,
  };
}

/**
 * True if 'YYYY-MM-DD' falls in the instant window: from the IST day of
 * (now + 2h) up to (but not including) day+3 IST midnight.
 */
function isInstantWindow(dateStr) {
  const { minInstantDate, maxInstantDate } = getInstantWindowUTC();
  const d = new Date(dateStr + 'T00:00:00+05:30');
  return d >= toISTMidnight(minInstantDate) && d < maxInstantDate;
}

/** True if 'YYYY-MM-DD' is day+3 IST midnight or later (the scheduled window). */
function isScheduledWindow(dateStr) {
  const { scheduledStartDate } = getInstantWindowUTC();
  const d = new Date(dateStr + 'T00:00:00+05:30');
  return d >= scheduledStartDate;
}

module.exports = {
  nowIST,
  toISTMidnight,
  getInstantWindowUTC,
  isInstantWindow,
  isScheduledWindow,
};
