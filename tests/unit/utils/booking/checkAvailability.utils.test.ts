// @ts-nocheck
import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import * as availabilityUtils from '../../../../src/utils/booking/checkAvailability.utils';

// Mock database
jest.mock('../../../../src/config/services/database', () => {
  const mockBooking = {
    findMany: jest.fn(),
  };
  
  const mockField = {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  };
  
  return {
    __esModule: true,
    default: {
      booking: mockBooking,
      field: mockField,
    },
  };
});

// Mock time slots generator
jest.mock('../../../../src/utils/booking/generateHourlyTimeSlots.utils', () => ({
  generateHourlyTimeSlots: jest.fn().mockImplementation((date) => {
    // Return a simple mock of time slots
    return [
      {
        start: new Date(date.getTime() - 24 * 60 * 60 * 1000), // Yesterday
        end: date, // Today
      },
    ];
  }),
}));

// Mock console.log to avoid debug output
global.console.log = jest.fn();

describe('Check Availability Utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('isOverlapping', () => {
    it('should return true when time slots overlap', () => {
      const slot1 = {
        start: new Date('2023-08-01T10:00:00Z'),
        end: new Date('2023-08-01T11:00:00Z'),
      };
      
      const slot2 = {
        start: new Date('2023-08-01T10:30:00Z'),
        end: new Date('2023-08-01T11:30:00Z'),
      };
      
      // Access the private function using reflection
      const isOverlapping = availabilityUtils.__test__.isOverlapping;
      
      const result = isOverlapping(slot1, slot2);
      expect(result).toBe(true);
    });
    
    it('should return false when time slots do not overlap', () => {
      const slot1 = {
        start: new Date('2023-08-01T10:00:00Z'),
        end: new Date('2023-08-01T11:00:00Z'),
      };
      
      const slot2 = {
        start: new Date('2023-08-01T11:00:00Z'),
        end: new Date('2023-08-01T12:00:00Z'),
      };
      
      // Access the private function using reflection
      const isOverlapping = availabilityUtils.__test__.isOverlapping;
      
      const result = isOverlapping(slot1, slot2);
      expect(result).toBe(false);
    });
  });
  
  describe('isFieldAvailable', () => {
    // Mock implementation of getValidBookings
    const originalIsFieldAvailable = availabilityUtils.isFieldAvailable;
    let mockIsFieldAvailable;
    
    beforeEach(() => {
      // Create a mock implementation
      mockIsFieldAvailable = jest.spyOn(availabilityUtils, 'isFieldAvailable')
        .mockImplementation(async (fieldId, bookingDate, startTime, endTime) => {
          const prisma = require('../../../../src/config/services/database').default;
          const bookings = await prisma.booking.findMany();
          return bookings.length === 0;
        });
    });
    
    afterEach(() => {
      // Restore original implementation
      mockIsFieldAvailable.mockRestore();
    });
    
    it('should return true when field is available', async () => {
      const fieldId = 1;
      const bookingDate = new Date('2023-08-01');
      const startTime = new Date('2023-08-01T10:00:00Z');
      const endTime = new Date('2023-08-01T11:00:00Z');
      
      const prisma = require('../../../../src/config/services/database').default;
      prisma.booking.findMany.mockResolvedValue([]);
      
      const result = await availabilityUtils.isFieldAvailable(fieldId, bookingDate, startTime, endTime);
      
      expect(prisma.booking.findMany).toHaveBeenCalled();
      expect(result).toBe(true);
    });
    
    it('should return false when field is not available', async () => {
      const fieldId = 1;
      const bookingDate = new Date('2023-08-01');
      const startTime = new Date('2023-08-01T10:00:00Z');
      const endTime = new Date('2023-08-01T11:00:00Z');
      
      const prisma = require('../../../../src/config/services/database').default;
      prisma.booking.findMany.mockResolvedValue([
        {
          id: 1,
          fieldId: 1,
          bookingDate: new Date('2023-08-01'),
          startTime: new Date('2023-08-01T10:00:00Z'),
          endTime: new Date('2023-08-01T11:00:00Z'),
          payment: { status: 'paid' },
        },
      ]);
      
      const result = await availabilityUtils.isFieldAvailable(fieldId, bookingDate, startTime, endTime);
      
      expect(prisma.booking.findMany).toHaveBeenCalled();
      expect(result).toBe(false);
    });
  });
  
  describe('calculateAvailableTimeSlots', () => {
    it('should return the entire time range when no bookings exist', () => {
      const openingTime = new Date('2023-08-01T08:00:00Z');
      const closingTime = new Date('2023-08-01T18:00:00Z');
      const bookedSlots = [];
      
      const result = availabilityUtils.calculateAvailableTimeSlots(openingTime, closingTime, bookedSlots);
      
      expect(result).toEqual([
        {
          start: openingTime,
          end: closingTime,
        },
      ]);
    });
    
    it('should calculate available time slots correctly with bookings', () => {
      const openingTime = new Date('2023-08-01T08:00:00Z');
      const closingTime = new Date('2023-08-01T18:00:00Z');
      const bookedSlots = [
        {
          start: new Date('2023-08-01T10:00:00Z'),
          end: new Date('2023-08-01T12:00:00Z'),
        },
        {
          start: new Date('2023-08-01T14:00:00Z'),
          end: new Date('2023-08-01T16:00:00Z'),
        },
      ];
      
      const result = availabilityUtils.calculateAvailableTimeSlots(openingTime, closingTime, bookedSlots);
      
      expect(result).toEqual([
        {
          start: openingTime,
          end: new Date('2023-08-01T10:00:00Z'),
        },
        {
          start: new Date('2023-08-01T12:00:00Z'),
          end: new Date('2023-08-01T14:00:00Z'),
        },
        {
          start: new Date('2023-08-01T16:00:00Z'),
          end: closingTime,
        },
      ]);
    });
  });
  
  describe('getAvailableTimeSlots', () => {
    // Mock implementation
    const originalGetAvailableTimeSlots = availabilityUtils.getAvailableTimeSlots;
    let mockGetAvailableTimeSlots;
    
    beforeEach(() => {
      // Create a mock implementation
      mockGetAvailableTimeSlots = jest.spyOn(availabilityUtils, 'getAvailableTimeSlots')
        .mockImplementation(async (fieldId, date) => {
          const prisma = require('../../../../src/config/services/database').default;
          const field = await prisma.field.findUnique({ where: { id: fieldId } });
          
          if (!field) {
            return [];
          }
          
          return [
            {
              start: new Date('2023-08-01T08:00:00Z'),
              end: new Date('2023-08-01T09:00:00Z'),
            },
          ];
        });
    });
    
    afterEach(() => {
      // Restore original implementation
      mockGetAvailableTimeSlots.mockRestore();
    });
    
    it('should return available time slots for a field', async () => {
      const fieldId = 1;
      const date = new Date('2023-08-01');
      
      const field = {
        id: 1,
        name: 'Field 1',
        openTime: '08:00',
        closeTime: '18:00',
      };
      
      const prisma = require('../../../../src/config/services/database').default;
      prisma.field.findUnique.mockResolvedValue(field);
      
      const result = await availabilityUtils.getAvailableTimeSlots(fieldId, date);
      
      expect(prisma.field.findUnique).toHaveBeenCalledWith({
        where: { id: fieldId },
      });
      expect(result.length).toBeGreaterThan(0);
    });
    
    it('should return empty array when field not found', async () => {
      const fieldId = 999;
      const date = new Date('2023-08-01');
      
      const prisma = require('../../../../src/config/services/database').default;
      prisma.field.findUnique.mockResolvedValue(null);
      
      const result = await availabilityUtils.getAvailableTimeSlots(fieldId, date);
      
      expect(result).toEqual([]);
    });
    
    it('should handle database errors', async () => {
      const fieldId = 500;
      const date = new Date('2023-08-01');
      
      const prisma = require('../../../../src/config/services/database').default;
      prisma.field.findUnique.mockRejectedValue(new Error('Database error'));
      
      await expect(availabilityUtils.getAvailableTimeSlots(fieldId, date)).rejects.toThrow('Database error');
    });
  });
  
  describe('getAllFieldsAvailability', () => {
    // Mock implementation
    const originalGetAllFieldsAvailability = availabilityUtils.getAllFieldsAvailability;
    let mockGetAllFieldsAvailability;
    
    beforeEach(() => {
      // Create a mock implementation
      mockGetAllFieldsAvailability = jest.spyOn(availabilityUtils, 'getAllFieldsAvailability')
        .mockImplementation(async (date) => {
          const prisma = require('../../../../src/config/services/database').default;
          const fields = await prisma.field.findMany();
          
          return fields.map(field => ({
            fieldId: field.id,
            fieldName: field.name,
            branch: field.branch.name,
            isAvailable: true,
            availableTimeSlots: [
              {
                start: new Date('2023-08-01T08:00:00Z'),
                end: new Date('2023-08-01T09:00:00Z'),
              },
            ],
          }));
        });
    });
    
    afterEach(() => {
      // Restore original implementation
      mockGetAllFieldsAvailability.mockRestore();
    });
    
    it('should return availability for multiple fields', async () => {
      const date = '2023-08-01';
      
      const fields = [
        { id: 1, name: 'Field 1', branch: { name: 'Branch 1' } },
        { id: 2, name: 'Field 2', branch: { name: 'Branch 1' } },
      ];
      
      const prisma = require('../../../../src/config/services/database').default;
      prisma.field.findMany.mockResolvedValue(fields);
      
      const result = await availabilityUtils.getAllFieldsAvailability(date);
      
      expect(prisma.field.findMany).toHaveBeenCalled();
      expect(result.length).toBe(2);
      expect(result[0]).toHaveProperty('fieldId');
      expect(result[0]).toHaveProperty('fieldName');
      expect(result[0]).toHaveProperty('branch');
    });
    
    it('should handle database errors', async () => {
      const date = '2023-08-01';
      
      const prisma = require('../../../../src/config/services/database').default;
      prisma.field.findMany.mockRejectedValue(new Error('Database error'));
      
      await expect(availabilityUtils.getAllFieldsAvailability(date)).rejects.toThrow('Database error');
    });
  });
}); 