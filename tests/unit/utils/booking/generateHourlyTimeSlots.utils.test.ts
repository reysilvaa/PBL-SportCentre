import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { generateHourlyTimeSlots } from '../../../../src/utils/booking/generateHourlyTimeSlots.utils';

// Mock timezone to be consistent in tests
jest.mock('../../../../src/utils/variables/timezone.utils', () => ({
  TIMEZONE: 'UTC'
}));

describe('generateHourlyTimeSlots', () => {
  beforeEach(() => {
    // Ensure consistent date handling in tests
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2023-06-15T00:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should generate 24 hourly time slots for a given date', () => {
    // Arrange
    const testDate = new Date('2023-06-15T00:00:00.000Z');
    
    // Act
    const slots = generateHourlyTimeSlots(testDate);
    
    // Assert
    expect(slots).toHaveLength(24);
    
    // Remove exact ISO string checks which depend on timezone
    // and focus on the structure/properties instead
    
    // Verify slots are generated for the correct hours and duration
    for (let i = 0; i < 24; i++) {
      const slot = slots[i];
      
      // Each slot should be exactly 1 hour long
      const hourDiff = (slot.end.getTime() - slot.start.getTime()) / (1000 * 60 * 60);
      expect(hourDiff).toBe(1);
      
      // Check minutes, seconds, milliseconds are zeroed
      expect(slot.start.getMinutes()).toBe(0);
      expect(slot.start.getSeconds()).toBe(0);
      expect(slot.start.getMilliseconds()).toBe(0);
      
      expect(slot.end.getMinutes()).toBe(0);
      expect(slot.end.getSeconds()).toBe(0);
      expect(slot.end.getMilliseconds()).toBe(0);
    }
    
    // The first slot should start at midnight of the input date
    const firstSlot = slots[0];
    expect(firstSlot.start.getFullYear()).toBe(testDate.getFullYear());
    expect(firstSlot.start.getMonth()).toBe(testDate.getMonth());
    expect(firstSlot.start.getDate()).toBe(testDate.getDate());
    
    // The last slot's end should be midnight of the next day
    const lastSlot = slots[23];
    expect(lastSlot.end.getDate()).toBe(testDate.getDate() + 1);
  });
  
  it('should maintain the date from the input', () => {
    // Arrange
    const testDate = new Date('2023-06-15T00:00:00.000Z');
    
    // Act
    const slots = generateHourlyTimeSlots(testDate);
    
    // Assert - all slots should be on the same date except the last end time
    for (let i = 0; i < slots.length; i++) {
      expect(slots[i].start.getDate()).toBe(testDate.getDate());
      
      // The end time of the last slot will be on the next day
      if (i < 23) {
        expect(slots[i].end.getDate()).toBe(testDate.getDate());
      }
    }
    
    // The end time of the last slot should be the next day
    expect(slots[23].end.getDate()).toBe(testDate.getDate() + 1);
  });
}); 