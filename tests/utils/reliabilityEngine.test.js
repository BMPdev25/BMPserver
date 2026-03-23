const mongoose = require('mongoose');

// We need to test the pure logic of getReliabilityBadge without DB.
// recalculateReliability needs DB mocking — we'll test it at integration level.
const { getReliabilityBadge } = require('../../utils/reliabilityEngine');

describe('Reliability Engine — getReliabilityBadge', () => {
  it('should return "none" for priests with fewer than 5 bookings', () => {
    expect(getReliabilityBadge(100, 4)).toBe('none');
    expect(getReliabilityBadge(50, 2)).toBe('none');
    expect(getReliabilityBadge(0, 0)).toBe('none');
  });

  it('should return "green" for ≥90% completion rate', () => {
    expect(getReliabilityBadge(100, 10)).toBe('green');
    expect(getReliabilityBadge(95, 20)).toBe('green');
    expect(getReliabilityBadge(90, 100)).toBe('green');
  });

  it('should return "yellow" for 70-89% completion rate', () => {
    expect(getReliabilityBadge(89, 10)).toBe('yellow');
    expect(getReliabilityBadge(80, 20)).toBe('yellow');
    expect(getReliabilityBadge(70, 100)).toBe('yellow');
  });

  it('should return "red" for <70% completion rate', () => {
    expect(getReliabilityBadge(69, 10)).toBe('red');
    expect(getReliabilityBadge(50, 100)).toBe('red');
    expect(getReliabilityBadge(0, 10)).toBe('red');
  });

  it('should handle edge case of exactly 5 bookings at boundary rates', () => {
    expect(getReliabilityBadge(90, 5)).toBe('green'); // 90% with 5 bookings
    expect(getReliabilityBadge(70, 5)).toBe('yellow'); // 70% with 5 bookings
    expect(getReliabilityBadge(69, 5)).toBe('red'); // 69% with 5 bookings
  });
});
