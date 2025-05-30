import { describe, it, expect, jest } from '@jest/globals';
import {
  getTimeRange,
  formatLastActive
} from '../../../../src/repositories/statistics/dashboardStats.service';

describe('Dashboard Stats Service', () => {
  describe('getTimeRange', () => {
    it('should return correct time range for daily period', () => {
      // Mock the current date
      const mockDate = new Date('2024-05-01T12:00:00Z');
      jest.useFakeTimers();
      jest.setSystemTime(mockDate);

      const timeRange = getTimeRange('daily');
      
      expect(timeRange).toHaveProperty('start');
      expect(timeRange).toHaveProperty('end');
      expect(timeRange).toHaveProperty('previous');
      expect(timeRange).toHaveProperty('formatFn');
      expect(timeRange).toHaveProperty('interval', 'hour');
      expect(timeRange).toHaveProperty('pastPeriods', 7);

      jest.useRealTimers();
    });

    it('should return correct time range for monthly period', () => {
      // Mock the current date
      const mockDate = new Date('2024-05-01T12:00:00Z');
      jest.useFakeTimers();
      jest.setSystemTime(mockDate);

      const timeRange = getTimeRange('monthly');
      
      expect(timeRange).toHaveProperty('interval', 'month');
      expect(timeRange).toHaveProperty('pastPeriods', 12);

      jest.useRealTimers();
    });

    it('should return correct time range for yearly period', () => {
      // Mock the current date
      const mockDate = new Date('2024-05-01T12:00:00Z');
      jest.useFakeTimers();
      jest.setSystemTime(mockDate);

      const timeRange = getTimeRange('yearly');
      
      expect(timeRange).toHaveProperty('interval', 'year');
      expect(timeRange).toHaveProperty('pastPeriods', 6);

      jest.useRealTimers();
    });
  });

  describe('formatLastActive', () => {
    it('should format time for just now', () => {
      const now = new Date();
      const date = new Date(now.getTime() - 30 * 1000); // 30 seconds ago
      
      const result = formatLastActive(date);
      
      expect(result).toBe('Baru saja');
    });

    it('should format time for minutes ago', () => {
      const now = new Date();
      const date = new Date(now.getTime() - 5 * 60 * 1000); // 5 minutes ago
      
      const result = formatLastActive(date);
      
      expect(result).toBe('5 menit lalu');
    });

    it('should format time for hours ago', () => {
      const now = new Date();
      const date = new Date(now.getTime() - 3 * 60 * 60 * 1000); // 3 hours ago
      
      const result = formatLastActive(date);
      
      expect(result).toBe('3 jam lalu');
    });

    it('should format time for days ago', () => {
      const now = new Date();
      const date = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000); // 2 days ago
      
      const result = formatLastActive(date);
      
      expect(result).toBe('2 hari lalu');
    });
  });
}); 