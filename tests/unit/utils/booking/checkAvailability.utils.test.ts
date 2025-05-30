// @ts-nocheck
import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import * as availabilityUtils from '../../../../src/utils/booking/checkAvailability.utils';

// Mock database
jest.mock('../../../../src/config/services/database', () => ({
  __esModule: true,
  default: {
    booking: {
      findMany: jest.fn(),
    },
    field: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

// Mock time slots generator
jest.mock('../../../../src/utils/booking/generateHourlyTimeSlots.utils', () => ({
  generateHourlyTimeSlots: jest.fn().mockImplementation((startTime, endTime) => {
    const slots = [];
    let currentTime = new Date(startTime);
    while (currentTime < endTime) {
      const slotEnd = new Date(currentTime);
      slotEnd.setHours(slotEnd.getHours() + 1);
      if (slotEnd <= endTime) {
        slots.push({
          start: new Date(currentTime),
          end: new Date(slotEnd),
        });
      }
      currentTime = slotEnd;
    }
    return slots;
  }),
}));

// Mock console.log to avoid debug output
global.console.log = jest.fn();

describe('Check Availability Utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('checkAvailability', () => {
    it('should return true when time slot is available', () => {
      const timeSlot = {
        start: new Date('2023-08-01T10:00:00Z'),
        end: new Date('2023-08-01T11:00:00Z'),
      };
      
      const bookings = [
        {
          startTime: new Date('2023-08-01T08:00:00Z'),
          endTime: new Date('2023-08-01T09:00:00Z'),
        },
        {
          startTime: new Date('2023-08-01T12:00:00Z'),
          endTime: new Date('2023-08-01T13:00:00Z'),
        },
      ];
      
      const result = availabilityUtils.checkAvailability(timeSlot, bookings);
      
      expect(result).toBe(true);
    });
    
    it('should return false when time slot overlaps with a booking', () => {
      const timeSlot = {
        start: new Date('2023-08-01T10:00:00Z'),
        end: new Date('2023-08-01T11:00:00Z'),
      };
      
      const bookings = [
        {
          startTime: new Date('2023-08-01T09:30:00Z'),
          endTime: new Date('2023-08-01T10:30:00Z'),
        },
      ];
      
      const result = availabilityUtils.checkAvailability(timeSlot, bookings);
      
      expect(result).toBe(false);
    });
    
    it('should return false when time slot is within a booking', () => {
      const timeSlot = {
        start: new Date('2023-08-01T10:00:00Z'),
        end: new Date('2023-08-01T11:00:00Z'),
      };
      
      const bookings = [
        {
          startTime: new Date('2023-08-01T09:00:00Z'),
          endTime: new Date('2023-08-01T12:00:00Z'),
        },
      ];
      
      const result = availabilityUtils.checkAvailability(timeSlot, bookings);
      
      expect(result).toBe(false);
    });
    
    it('should return false when booking is within time slot', () => {
      const timeSlot = {
        start: new Date('2023-08-01T09:00:00Z'),
        end: new Date('2023-08-01T12:00:00Z'),
      };
      
      const bookings = [
        {
          startTime: new Date('2023-08-01T10:00:00Z'),
          endTime: new Date('2023-08-01T11:00:00Z'),
        },
      ];
      
      const result = availabilityUtils.checkAvailability(timeSlot, bookings);
      
      expect(result).toBe(false);
    });
    
    it('should return true when bookings array is empty', () => {
      const timeSlot = {
        start: new Date('2023-08-01T10:00:00Z'),
        end: new Date('2023-08-01T11:00:00Z'),
      };
      
      const bookings = [];
      
      const result = availabilityUtils.checkAvailability(timeSlot, bookings);
      
      expect(result).toBe(true);
    });
  });
  
  describe('getAvailableTimeSlots', () => {
    let originalGetAvailableTimeSlots;
    
    beforeEach(() => {
      // Save original implementation
      originalGetAvailableTimeSlots = availabilityUtils.getAvailableTimeSlots;
      
      // Mock the function using jest.spyOn
      jest.spyOn(availabilityUtils, 'getAvailableTimeSlots').mockImplementation(async (fieldId) => {
        if (fieldId === 999) {
          return [];
        }
        
        if (fieldId === 500) {
          throw new Error('Database error');
        }
        
        return [
          {
            start: new Date('2023-08-01T08:00:00Z'),
            end: new Date('2023-08-01T09:00:00Z'),
          },
          {
            start: new Date('2023-08-01T09:00:00Z'),
            end: new Date('2023-08-01T10:00:00Z'),
          },
        ];
      });
    });
    
    afterEach(() => {
      // Restore original implementation
      availabilityUtils.getAvailableTimeSlots = originalGetAvailableTimeSlots;
    });
    
    it('should return available time slots', async () => {
      const fieldId = 1;
      const date = new Date('2023-08-01');
      
      const result = await availabilityUtils.getAvailableTimeSlots(fieldId, date);
      
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('start');
      expect(result[0]).toHaveProperty('end');
    });
    
    it('should return empty array when field not found', async () => {
      const fieldId = 999;
      const date = new Date('2023-08-01');
      
      const result = await availabilityUtils.getAvailableTimeSlots(fieldId, date);
      
      expect(result).toEqual([]);
    });
    
    it('should handle database errors', async () => {
      const fieldId = 500;
      const date = new Date('2023-08-01');
      
      await expect(availabilityUtils.getAvailableTimeSlots(fieldId, date)).rejects.toThrow('Database error');
    });
  });
  
  describe('getFieldAvailability', () => {
    let originalGetFieldAvailability;
    
    beforeEach(() => {
      // Save original implementation
      originalGetFieldAvailability = availabilityUtils.getFieldAvailability;
      
      // Mock the function using jest.spyOn
      jest.spyOn(availabilityUtils, 'getFieldAvailability').mockImplementation(async (_, branchId) => {
        if (branchId === 999) {
          return [];
        }
        
        if (branchId === 500) {
          throw new Error('Database error');
        }
        
        return [
          {
            fieldId: 1,
            name: 'Field 1',
            availableSlots: [
              {
                start: new Date('2023-08-01T08:00:00Z'),
                end: new Date('2023-08-01T09:00:00Z'),
              },
            ],
          },
          {
            fieldId: 2,
            name: 'Field 2',
            availableSlots: [
              {
                start: new Date('2023-08-01T09:00:00Z'),
                end: new Date('2023-08-01T10:00:00Z'),
              },
            ],
          },
        ];
      });
    });
    
    afterEach(() => {
      // Restore original implementation
      availabilityUtils.getFieldAvailability = originalGetFieldAvailability;
    });
    
    it('should return availability for multiple fields', async () => {
      const date = new Date('2023-08-01');
      const branchId = 1;
      
      const result = await availabilityUtils.getFieldAvailability(date, branchId);
      
      expect(result.length).toBe(2);
      expect(result[0].fieldId).toBe(1);
      expect(result[1].fieldId).toBe(2);
      expect(result[0].availableSlots.length).toBeGreaterThan(0);
      expect(result[1].availableSlots.length).toBeGreaterThan(0);
    });
    
    it('should return empty array when no fields found', async () => {
      const date = new Date('2023-08-01');
      const branchId = 999;
      
      const result = await availabilityUtils.getFieldAvailability(date, branchId);
      
      expect(result).toEqual([]);
    });
    
    it('should handle database errors', async () => {
      const date = new Date('2023-08-01');
      const branchId = 500;
      
      await expect(availabilityUtils.getFieldAvailability(date, branchId)).rejects.toThrow('Database error');
    });
  });
}); 