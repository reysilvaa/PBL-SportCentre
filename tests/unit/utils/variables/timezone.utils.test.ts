import { jest, describe, it, expect } from '@jest/globals';
import {
  TIMEZONE,
  formatDateToWIB,
  getStartOfDayWIB,
  createDateWithHourWIB,
  combineDateWithTimeWIB
} from '../../../../src/utils/variables/timezone.utils';

// Mock date-fns-tz functions
jest.mock('date-fns-tz', () => ({
  formatInTimeZone: jest.fn((_date, _timezone, _format) => {
    // Simple mock implementation
    return `2023-06-15 10:00:00 +0700`;
  }),
  toZonedTime: jest.fn((date) => date) // Just return the same date for simplicity
}));

describe('Timezone Utils', () => {
  describe('TIMEZONE constant', () => {
    it('should be set to Asia/Jakarta', () => {
      expect(TIMEZONE).toBe('Asia/Jakarta');
    });
  });

  describe('formatDateToWIB', () => {
    it('should format date to WIB timezone string', () => {
      // Arrange
      const testDate = new Date('2023-06-15T03:00:00.000Z');
      
      // Act
      const result = formatDateToWIB(testDate);
      
      // Assert
      expect(result).toBe('2023-06-15 10:00:00 +0700');
    });
  });

  describe('getStartOfDayWIB', () => {
    it('should set time to start of day in WIB timezone', () => {
      // Arrange
      const testDate = new Date('2023-06-15T15:30:45.123Z');
      
      // Act
      const result = getStartOfDayWIB(testDate);
      
      // Assert
      expect(result.getHours()).toBe(0);
      expect(result.getMinutes()).toBe(0);
      expect(result.getSeconds()).toBe(0);
      expect(result.getMilliseconds()).toBe(0);
    });
  });

  describe('createDateWithHourWIB', () => {
    it('should create date with specified hour in WIB timezone', () => {
      // Arrange
      const testDate = new Date('2023-06-15T00:00:00.000Z');
      const hour = 14; // 2 PM
      
      // Act
      const result = createDateWithHourWIB(testDate, hour);
      
      // Assert
      expect(result.getHours()).toBe(hour);
      expect(result.getMinutes()).toBe(0);
      expect(result.getSeconds()).toBe(0);
      expect(result.getMilliseconds()).toBe(0);
    });
  });

  describe('combineDateWithTimeWIB', () => {
    it('should combine date with time string in WIB timezone', () => {
      // Arrange
      const testDate = new Date('2023-06-15T00:00:00.000Z');
      const timeString = '14:30';
      
      // Act
      const result = combineDateWithTimeWIB(testDate, timeString);
      
      // Assert
      expect(result.getHours()).toBe(14);
      expect(result.getMinutes()).toBe(30);
      expect(result.getSeconds()).toBe(0);
      expect(result.getMilliseconds()).toBe(0);
    });
  });
}); 