const moment = require('moment'); // Assuming moment is available, or use native Date

/**
 * Checks if a priest is available for a specific date and time duration.
 * 
 * @param {Object} availability - The priest's availability object from PriestProfile
 * @param {Date|string} date - The date of the booking
 * @param {string} startTime - The start time in "HH:mm" format (24h)
 * @param {number} durationMinutes - Duration of the service in minutes
 * @returns {boolean} - True if available, False otherwise
 */
exports.isPriestAvailable = (availability, date, startTime, durationMinutes = 60) => {
    if (!availability) return false;

    const bookingDate = moment(date);
    const dayOfWeek = bookingDate.format('dddd').toLowerCase(); // monday, tuesday...
    const dateStr = bookingDate.format('YYYY-MM-DD');

    // 1. Check for Date Overrides
    if (availability.dateOverrides && availability.dateOverrides.length > 0) {
        const override = availability.dateOverrides.find(o => 
            moment(o.date).format('YYYY-MM-DD') === dateStr
        );

        if (override) {
            if (override.isUnavailable) return false; // Day off
            if (override.customSlots && override.customSlots.length > 0) {
                return checkTimeSlots(override.customSlots, startTime, durationMinutes);
            }
            // If override exists but not unavailable and no slots?? Assume unavailable or full day? 
            // Usually "Day Off" = isUnavailable: true. 
            // If just modifying hours, customSlots should be present.
            return false; 
        }
    }

    // 2. Check Weekly Schedule (Default)
    if (availability.weeklySchedule) {
        const slots = availability.weeklySchedule.get(dayOfWeek);
        if (!slots || slots.length === 0) return false; // No slots defined for this day = unavailable

        // Parse slots from ["09:00-17:00"] format
        const parsedSlots = slots.map(slotStr => {
            const [start, end] = slotStr.split('-');
            return { start, end };
        });

        return checkTimeSlots(parsedSlots, startTime, durationMinutes);
    }

    return false; // Default to unavailable if no schedule found
};

/**
 * Helper to check if a time range fits within any of the provided slots.
 */
function checkTimeSlots(slots, bookingStart, durationMinutes) {
    const bookingStartMinutes = timeToMinutes(bookingStart);
    const bookingEndMinutes = bookingStartMinutes + durationMinutes;

    return slots.some(slot => {
        const slotStartMinutes = timeToMinutes(slot.start);
        const slotEndMinutes = timeToMinutes(slot.end);

        return bookingStartMinutes >= slotStartMinutes && bookingEndMinutes <= slotEndMinutes;
    });
}

function timeToMinutes(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
}
