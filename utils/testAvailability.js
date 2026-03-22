const { isPriestAvailable } = require('./availability');
const moment = require('moment');

// Mock Availability Data
const mockAvailability = {
    weeklySchedule: new Map([
        ['monday', ['09:00-17:00']],
        ['tuesday', ['10:00-14:00']],
        ['wednesday', []], // Day Off by default
    ]),
    dateOverrides: [
        {
            date: moment().day(1).toDate(), // Next Monday
            isUnavailable: true, // Specific Monday Off
            reason: 'Holiday'
        },
        {
            date: moment().day(2).toDate(), // Next Tuesday
            isUnavailable: false,
            customSlots: [{ start: '18:00', end: '20:00' }], // Evening shift instead
            reason: 'Evening Puja'
        }
    ]
};

// Test Cases
const tests = [
    {
        desc: 'Monday (Default Schedule) - Should be Available in slot',
        date: moment().day(8).format('YYYY-MM-DD'), // 2 Mondays ahead (no override)
        time: '10:00',
        duration: 60,
        expected: true
    },
    {
        desc: 'Monday (Default Schedule) - Should be Unavailable outside slot',
        date: moment().day(8).format('YYYY-MM-DD'), 
        time: '18:00',
        duration: 60,
        expected: false
    },
    {
        desc: 'Next Monday (Override: Day Off) - Should be Unavailable',
        date: moment().day(1).format('YYYY-MM-DD'),
        time: '10:00',
        duration: 60,
        expected: false
    },
    {
        desc: 'Next Tuesday (Override: Custom Evening) - Should be Unavailable in morning',
        date: moment().day(2).format('YYYY-MM-DD'),
        time: '10:00',
        duration: 60,
        expected: false
    },
    {
        desc: 'Next Tuesday (Override: Custom Evening) - Should be Available in evening',
        date: moment().day(2).format('YYYY-MM-DD'),
        time: '18:30',
        duration: 60,
        expected: true
    },
    {
        desc: 'Wednesday (Default: Empty) - Should be Unavailable',
        date: moment().day(3).format('YYYY-MM-DD'),
        time: '12:00',
        duration: 60,
        expected: false
    }
];

console.log('--- Running Availability Tests ---');
tests.forEach(test => {
    const result = isPriestAvailable(mockAvailability, test.date, test.time, test.duration);
    const status = result === test.expected ? 'PASS' : `FAIL (Expected ${test.expected}, Got ${result})`;
    console.log(`${status}: ${test.desc} [${test.date} @ ${test.time}]`);
});
