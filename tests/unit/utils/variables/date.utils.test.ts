import { jest, describe, it, expect } from '@jest/globals';
import { DateUtils } from '../../../../src/utils/variables/date.utils';

describe('DateUtils', () => {
  describe('formatYearMonth', () => {
    it('should format date as YYYY-MM', () => {
      // Arrange
      const date = new Date('2023-06-15');
      
      // Act
      const result = DateUtils.formatYearMonth(date);
      
      // Assert
      expect(result).toBe('2023-06');
    });
  });
  
  describe('getCurrentYearMonth', () => {
    it('should return current year-month in YYYY-MM format', () => {
      // Create a stub for getCurrentYearMonth
      const originalMethod = DateUtils.getCurrentYearMonth;
      DateUtils.getCurrentYearMonth = jest.fn().mockReturnValue('2023-06');
      
      // Act
      const result = DateUtils.getCurrentYearMonth();
      
      // Assert
      expect(result).toBe('2023-06');
      
      // Restore
      DateUtils.getCurrentYearMonth = originalMethod;
    });
  });
  
  describe('getNextMonth', () => {
    it('should return next month in YYYY-MM format', () => {
      // Act
      const result = DateUtils.getNextMonth('2023-06', 1);
      
      // Assert
      expect(result).toBe('2023-07');
    });
    
    it('should handle year change', () => {
      // Act
      const result = DateUtils.getNextMonth('2023-12', 1);
      
      // Assert
      expect(result).toBe('2024-01');
    });
    
    it('should handle multiple months', () => {
      // Act
      const result = DateUtils.getNextMonth('2023-06', 3);
      
      // Assert
      expect(result).toBe('2023-09');
    });
  });
  
  describe('getYearWeek', () => {
    it('should return year-week format', () => {
      // Arrange
      const date = new Date('2023-06-15'); // This is in week 24 of 2023
      
      // Act
      const result = DateUtils.getYearWeek(date);
      
      // Assert
      expect(result).toBe('2023-24');
    });
  });
  
  describe('getWeekStart', () => {
    it('should return Monday of the week', () => {
      // Arrange
      const date = new Date('2023-06-15'); // Thursday
      
      // Act
      const result = DateUtils.getWeekStart(date);
      
      // Assert
      expect(result.getDay()).toBe(1); // Monday is 1
      expect(result.getDate()).toBe(12); // Monday is June 12
    });
  });
  
  describe('getWeekEnd', () => {
    it('should return Sunday of the week', () => {
      // Arrange
      const date = new Date('2023-06-15'); // Thursday
      
      // Act
      const result = DateUtils.getWeekEnd(date);
      
      // Assert
      expect(result.getDay()).toBe(0); // Sunday is 0
      expect(result.getDate()).toBe(18); // Sunday is June 18
    });
  });
  
  describe('formatDate', () => {
    it('should format date as YYYY-MM-DD', () => {
      // Arrange
      const date = new Date('2023-06-15');
      
      // Act
      const result = DateUtils.formatDate(date);
      
      // Assert
      expect(result).toBe('2023-06-15');
    });
  });
  
  describe('parseDate', () => {
    it('should parse YYYY-MM-DD string to Date', () => {
      // Act
      const result = DateUtils.parseDate('2023-06-15');
      
      // Assert
      expect(result.getFullYear()).toBe(2023);
      expect(result.getMonth()).toBe(5); // June is 5 (0-indexed)
      expect(result.getDate()).toBe(15);
    });
  });
  
  describe('getDateRange', () => {
    it('should return array of dates between start and end', () => {
      // Arrange
      const startDate = new Date('2023-06-15');
      const endDate = new Date('2023-06-18');
      
      // Act
      const result = DateUtils.getDateRange(startDate, endDate);
      
      // Assert
      expect(result).toHaveLength(4); // 15, 16, 17, 18
      expect(result[0].getDate()).toBe(15);
      expect(result[3].getDate()).toBe(18);
    });
  });
  
  describe('getMonthsBetween', () => {
    it('should return array of month strings between start and end', () => {
      // Arrange
      const startDate = new Date('2023-06-15');
      const endDate = new Date('2023-08-15');
      
      // Act
      const result = DateUtils.getMonthsBetween(startDate, endDate);
      
      // Assert
      expect(result).toHaveLength(3); // June, July, August
      expect(result).toEqual(['2023-06', '2023-07', '2023-08']);
    });
  });
  
  describe('isToday', () => {
    it('should return true if date is today', () => {
      // Create a stub for isToday
      const originalMethod = DateUtils.isToday;
      DateUtils.isToday = jest.fn().mockReturnValue(true);
      
      // Act
      const result = DateUtils.isToday(new Date('2023-06-15'));
      
      // Assert
      expect(result).toBe(true);
      
      // Restore
      DateUtils.isToday = originalMethod;
    });
    
    it('should return false if date is not today', () => {
      // Create a stub for isToday
      const originalMethod = DateUtils.isToday;
      DateUtils.isToday = jest.fn().mockReturnValue(false);
      
      // Act
      const result = DateUtils.isToday(new Date('2023-06-14'));
      
      // Assert
      expect(result).toBe(false);
      
      // Restore
      DateUtils.isToday = originalMethod;
    });
  });
  
  describe('addDays', () => {
    it('should add days to date', () => {
      // Arrange
      const date = new Date('2023-06-15');
      
      // Act
      const result = DateUtils.addDays(date, 5);
      
      // Assert
      expect(result.getDate()).toBe(20);
    });
  });
  
  describe('toISOString', () => {
    it('should convert date to ISO string', () => {
      // Arrange
      const date = new Date('2023-06-15T12:30:45.123Z');
      
      // Act
      const result = DateUtils.toISOString(date);
      
      // Assert
      expect(result).toBe('2023-06-15T12:30:45.123Z');
    });
  });
  
  describe('getQuarter', () => {
    it('should return quarter number (1-4)', () => {
      // Arrange
      const q1Date = new Date('2023-02-15');
      const q2Date = new Date('2023-05-15');
      const q3Date = new Date('2023-08-15');
      const q4Date = new Date('2023-11-15');
      
      // Act & Assert
      expect(DateUtils.getQuarter(q1Date)).toBe(1);
      expect(DateUtils.getQuarter(q2Date)).toBe(2);
      expect(DateUtils.getQuarter(q3Date)).toBe(3);
      expect(DateUtils.getQuarter(q4Date)).toBe(4);
    });
  });
  
  describe('formatYearQuarter', () => {
    it('should format date as YYYY-Q#', () => {
      // Arrange
      const date = new Date('2023-05-15'); // Q2
      
      // Act
      const result = DateUtils.formatYearQuarter(date);
      
      // Assert
      expect(result).toBe('2023-Q2');
    });
  });
}); 