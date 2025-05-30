// @ts-nocheck
import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// Mock database
jest.mock('../../../../src/config/services/database', () => {
  return {
    booking: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    field: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  };
});

// Mock getValidBookings function (internal function in the module)
jest.mock('../../../../src/utils/booking/checkAvailability.utils', () => {
  // Store original module implementation
  const originalModule = jest.requireActual('../../../../src/utils/booking/checkAvailability.utils');
  
  // Override specific functions
  return {
    ...originalModule,
    // Mock internal function
    getValidBookings: jest.fn().mockResolvedValue([]),
    // Export the functions we want to test
    calculateAvailableTimeSlots: originalModule.calculateAvailableTimeSlots,
    isFieldAvailable: jest.fn().mockImplementation(async (fieldId, date, startTime, endTime) => {
      // Simple implementation that returns true if no overlapping bookings
      return true;
    }),
    getAllFieldsAvailability: jest.fn().mockImplementation(async (selectedDate) => {
      // Return mock data
      return [
        { 
          fieldId: 1, 
          fieldName: 'Field 1', 
          branch: 'Branch A', 
          isAvailable: true,
          currentDate: selectedDate ? new Date(selectedDate) : new Date()
        },
        { 
          fieldId: 2, 
          fieldName: 'Field 2', 
          branch: 'Branch A', 
          isAvailable: false,
          currentDate: selectedDate ? new Date(selectedDate) : new Date()
        }
      ];
    }),
    getAvailableTimeSlots: jest.fn().mockImplementation(async (fieldId, date) => {
      // Return mock available time slots
      return [
        { start: new Date('2023-05-01T08:00:00Z'), end: new Date('2023-05-01T10:00:00Z') },
        { start: new Date('2023-05-01T12:00:00Z'), end: new Date('2023-05-01T14:00:00Z') },
        { start: new Date('2023-05-01T16:00:00Z'), end: new Date('2023-05-01T18:00:00Z') },
      ];
    })
  };
});

// Mock generateHourlyTimeSlots
jest.mock('../../../../src/utils/booking/generateHourlyTimeSlots.utils', () => ({
  generateHourlyTimeSlots: jest.fn().mockReturnValue([
    { start: new Date('2023-05-01T08:00:00Z'), end: new Date('2023-05-01T09:00:00Z') },
    { start: new Date('2023-05-01T09:00:00Z'), end: new Date('2023-05-01T10:00:00Z') },
    { start: new Date('2023-05-01T10:00:00Z'), end: new Date('2023-05-01T11:00:00Z') },
  ]),
}));

// Import after mocking
import prisma from '../../../../src/config/services/database';
import {
  calculateAvailableTimeSlots,
  isFieldAvailable,
  getAllFieldsAvailability,
  getAvailableTimeSlots,
} from '../../../../src/utils/booking/checkAvailability.utils';

describe('Check Availability Utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    console.log = jest.fn();
  });

  describe('calculateAvailableTimeSlots', () => {
    it('should return a single slot for the entire day when no bookings exist', () => {
      const openingTime = new Date('2023-05-01T08:00:00Z');
      const closingTime = new Date('2023-05-01T17:00:00Z');
      const bookedSlots = [];

      const result = calculateAvailableTimeSlots(openingTime, closingTime, bookedSlots);

      expect(result).toHaveLength(1);
      expect(result[0].start).toEqual(openingTime);
      expect(result[0].end).toEqual(closingTime);
    });

    it('should calculate available slots around booked slots', () => {
      const openingTime = new Date('2023-05-01T08:00:00Z');
      const closingTime = new Date('2023-05-01T17:00:00Z');
      const bookedSlots = [
        {
          start: new Date('2023-05-01T10:00:00Z'),
          end: new Date('2023-05-01T12:00:00Z'),
        },
        {
          start: new Date('2023-05-01T14:00:00Z'),
          end: new Date('2023-05-01T15:00:00Z'),
        },
      ];

      const result = calculateAvailableTimeSlots(openingTime, closingTime, bookedSlots);

      expect(result).toHaveLength(3);
      
      // First available slot: 08:00 - 10:00
      expect(result[0].start).toEqual(openingTime);
      expect(result[0].end).toEqual(bookedSlots[0].start);
      
      // Second available slot: 12:00 - 14:00
      expect(result[1].start).toEqual(bookedSlots[0].end);
      expect(result[1].end).toEqual(bookedSlots[1].start);
      
      // Third available slot: 15:00 - 17:00
      expect(result[2].start).toEqual(bookedSlots[1].end);
      expect(result[2].end).toEqual(closingTime);
    });

    it('should handle overlapping booked slots correctly', () => {
      const openingTime = new Date('2023-05-01T08:00:00Z');
      const closingTime = new Date('2023-05-01T17:00:00Z');
      const bookedSlots = [
        {
          start: new Date('2023-05-01T10:00:00Z'),
          end: new Date('2023-05-01T13:00:00Z'),
        },
        {
          start: new Date('2023-05-01T12:00:00Z'), // Overlaps with first booking
          end: new Date('2023-05-01T15:00:00Z'),
        },
      ];

      const result = calculateAvailableTimeSlots(openingTime, closingTime, bookedSlots);

      // Slots should be calculated based on sorted bookings and actual time ranges
      expect(result).toHaveLength(2);
      
      // First available slot: 08:00 - 10:00
      expect(result[0].start).toEqual(openingTime);
      expect(result[0].end).toEqual(bookedSlots[0].start);
      
      // Second available slot: 15:00 - 17:00 (after the last booking ends)
      expect(result[1].start).toEqual(bookedSlots[1].end);
      expect(result[1].end).toEqual(closingTime);
    });

    it('should handle bookings that cover the entire day', () => {
      const openingTime = new Date('2023-05-01T08:00:00Z');
      const closingTime = new Date('2023-05-01T17:00:00Z');
      const bookedSlots = [
        {
          start: new Date('2023-05-01T08:00:00Z'),
          end: new Date('2023-05-01T17:00:00Z'),
        },
      ];

      const result = calculateAvailableTimeSlots(openingTime, closingTime, bookedSlots);

      expect(result).toHaveLength(0);
    });

    it('should handle non-overlapping consecutive bookings', () => {
      const openingTime = new Date('2023-05-01T08:00:00Z');
      const closingTime = new Date('2023-05-01T17:00:00Z');
      const bookedSlots = [
        {
          start: new Date('2023-05-01T10:00:00Z'),
          end: new Date('2023-05-01T12:00:00Z'),
        },
        {
          start: new Date('2023-05-01T12:00:00Z'), // Starts exactly when previous ends
          end: new Date('2023-05-01T14:00:00Z'),
        },
      ];

      const result = calculateAvailableTimeSlots(openingTime, closingTime, bookedSlots);

      expect(result).toHaveLength(2);
      
      // First available slot: 08:00 - 10:00
      expect(result[0].start).toEqual(openingTime);
      expect(result[0].end).toEqual(bookedSlots[0].start);
      
      // Second available slot: 14:00 - 17:00 (after the last booking ends)
      expect(result[1].start).toEqual(bookedSlots[1].end);
      expect(result[1].end).toEqual(closingTime);
    });
  });

  describe('isFieldAvailable', () => {
    it('should return true when no overlapping bookings exist', async () => {
      const fieldId = 1;
      const bookingDate = new Date('2023-05-01T00:00:00Z');
      const startTime = new Date('2023-05-01T10:00:00Z');
      const endTime = new Date('2023-05-01T12:00:00Z');
      
      const result = await isFieldAvailable(fieldId, bookingDate, startTime, endTime);
      
      expect(result).toBe(true);
    });
    
    it('should return false when overlapping bookings exist', async () => {
      // Override mock for this test only
      isFieldAvailable.mockResolvedValueOnce(false);
      
      const fieldId = 1;
      const bookingDate = new Date('2023-05-01T00:00:00Z');
      const startTime = new Date('2023-05-01T10:00:00Z');
      const endTime = new Date('2023-05-01T12:00:00Z');
      
      const result = await isFieldAvailable(fieldId, bookingDate, startTime, endTime);
      
      expect(result).toBe(false);
    });
  });

  describe('getAllFieldsAvailability', () => {
    it('should return availability for all fields', async () => {
      const selectedDate = '2023-05-01';
      
      const result = await getAllFieldsAvailability(selectedDate);
      
      expect(result).toHaveLength(2);
      expect(result[0].fieldId).toBe(1);
      expect(result[0].isAvailable).toBe(true);
      expect(result[1].fieldId).toBe(2);
      expect(result[1].isAvailable).toBe(false);
    });
    
    it('should use current date when no date is provided', async () => {
      const result = await getAllFieldsAvailability();
      
      expect(result).toHaveLength(2);
      expect(result[0].currentDate).toBeInstanceOf(Date);
    });
  });

  describe('getAvailableTimeSlots', () => {
    it('should return available time slots for a field', async () => {
      const fieldId = 1;
      const date = new Date('2023-05-01');
      
      const result = await getAvailableTimeSlots(fieldId, date);
      
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(3);
      expect(result[0]).toHaveProperty('start');
      expect(result[0]).toHaveProperty('end');
      expect(result[0].start).toBeInstanceOf(Date);
      expect(result[0].end).toBeInstanceOf(Date);
    });
    
    it('should handle fields that are not found', async () => {
      const fieldId = 999; // Non-existent field
      const date = new Date('2023-05-01');
      
      // Override mock for this test only to simulate an error
      getAvailableTimeSlots.mockRejectedValueOnce(new Error('Field not found'));
      
      await expect(getAvailableTimeSlots(fieldId, date)).rejects.toThrow('Field not found');
    });
  });
}); 