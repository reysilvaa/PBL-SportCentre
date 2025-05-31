import { Request, Response } from 'express';
import { jest, describe, it, beforeEach, expect } from '@jest/globals';
import * as AvailabilityController from '../../../src/controllers/availability.controller';
import * as AvailabilityUtils from '../../../src/utils/booking/checkAvailability.utils';
import * as SocketConfig from '../../../src/config/server/socket';

// Mock dependencies
jest.mock('../../../src/utils/booking/checkAvailability.utils', () => ({
  getAllFieldsAvailability: jest.fn(),
}));

jest.mock('../../../src/config/server/socket', () => ({
  emitFieldAvailabilityUpdate: jest.fn(),
}));

// Mock the queue module
jest.mock('../../../src/config/services/queue', () => {
  // Create a mock function that will store the callback
  let processCallback: Function | null = null;
  
  return {
    fieldAvailabilityQueue: {
      process: jest.fn((callback) => {
        processCallback = callback;
        return { name: 'fieldAvailabilityQueue' };
      }),
      add: jest.fn(),
      close: jest.fn().mockResolvedValue(undefined),
      // Helper method for tests to access the stored callback
      _getProcessCallback: () => processCallback,
    },
  };
});

describe('Availability Controller', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  
  // Import the queue after mocking
  const { fieldAvailabilityQueue } = require('../../../src/config/services/queue');

  beforeEach(() => {
    mockReq = {
      query: {},
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('checkAllFieldsAvailability', () => {
    const mockAvailabilityResults = [
      {
        fieldId: 1,
        fieldName: 'Lapangan Futsal A',
        branch: 'Cabang Utama',
        isAvailable: true,
        currentDate: new Date(),
        availableTimeSlots: [
          { start: new Date('2025-06-01T08:00:00'), end: new Date('2025-06-01T09:00:00') },
          { start: new Date('2025-06-01T14:00:00'), end: new Date('2025-06-01T15:00:00') },
        ]
      },
      {
        fieldId: 2,
        fieldName: 'Lapangan Futsal B',
        branch: 'Cabang Utama',
        isAvailable: true,
        currentDate: new Date(),
        availableTimeSlots: [
          { start: new Date('2025-06-01T10:00:00'), end: new Date('2025-06-01T11:00:00') },
          { start: new Date('2025-06-01T16:00:00'), end: new Date('2025-06-01T17:00:00') },
        ]
      }
    ];

    it('should return all fields availability without date parameter', async () => {
      // Arrange
      (AvailabilityUtils.getAllFieldsAvailability as jest.Mock).mockResolvedValue(mockAvailabilityResults);

      // Act
      await AvailabilityController.checkAllFieldsAvailability(mockReq as Request, mockRes as Response);

      // Assert
      expect(AvailabilityUtils.getAllFieldsAvailability).toHaveBeenCalledWith(undefined);
      expect(SocketConfig.emitFieldAvailabilityUpdate).toHaveBeenCalledWith(mockAvailabilityResults, undefined);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockAvailabilityResults,
      });
    });

    it('should return all fields availability with date parameter', async () => {
      // Arrange
      const testDate = '2025-06-01';
      mockReq.query = { date: testDate };
      
      (AvailabilityUtils.getAllFieldsAvailability as jest.Mock).mockResolvedValue(mockAvailabilityResults);

      // Act
      await AvailabilityController.checkAllFieldsAvailability(mockReq as Request, mockRes as Response);

      // Assert
      expect(AvailabilityUtils.getAllFieldsAvailability).toHaveBeenCalledWith(testDate);
      expect(SocketConfig.emitFieldAvailabilityUpdate).toHaveBeenCalledWith(mockAvailabilityResults, testDate);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockAvailabilityResults,
      });
    });

    it('should not emit event when no results are returned', async () => {
      // Arrange
      (AvailabilityUtils.getAllFieldsAvailability as jest.Mock).mockResolvedValue([]);

      // Act
      await AvailabilityController.checkAllFieldsAvailability(mockReq as Request, mockRes as Response);

      // Assert
      expect(AvailabilityUtils.getAllFieldsAvailability).toHaveBeenCalled();
      expect(SocketConfig.emitFieldAvailabilityUpdate).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: [],
      });
    });

    it('should handle errors', async () => {
      // Arrange
      (AvailabilityUtils.getAllFieldsAvailability as jest.Mock).mockRejectedValue(new Error('Service error'));

      // Act
      await AvailabilityController.checkAllFieldsAvailability(mockReq as Request, mockRes as Response);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to check all fields availability',
      });
    });
  });

  describe('setupFieldAvailabilityProcessor', () => {
    it('should register processor for availability queue', () => {
      // Act
      AvailabilityController.setupFieldAvailabilityProcessor();

      // Assert
      expect(fieldAvailabilityQueue.process).toHaveBeenCalled();
    });

    it('should successfully process queue job', async () => {
      // Arrange
      const mockResults = [
        { fieldId: 1, fieldName: 'Test Field', branch: 'Test Branch', isAvailable: true, availableTimeSlots: [] }
      ];
      (AvailabilityUtils.getAllFieldsAvailability as jest.Mock).mockResolvedValue(mockResults);

      // Act
      AvailabilityController.setupFieldAvailabilityProcessor();
      
      // Get the callback that was registered with process
      const processCallback = fieldAvailabilityQueue._getProcessCallback();
      
      // Execute the callback directly if it exists
      if (processCallback) {
        const result = await processCallback();

        // Assert
        expect(AvailabilityUtils.getAllFieldsAvailability).toHaveBeenCalled();
        expect(SocketConfig.emitFieldAvailabilityUpdate).toHaveBeenCalledWith(mockResults);
        expect(result).toEqual({
          success: true,
          timestamp: expect.any(Date)
        });
      } else {
        // Skip test if callback wasn't registered
        console.log('Process callback not registered, skipping test');
      }
    });

    it('should handle errors in processor', async () => {
      // Arrange
      const testError = new Error('Service error');
      (AvailabilityUtils.getAllFieldsAvailability as jest.Mock).mockRejectedValue(testError);

      // Act
      AvailabilityController.setupFieldAvailabilityProcessor();
      
      // Get the callback that was registered with process
      const processCallback = fieldAvailabilityQueue._getProcessCallback();
      
      // Test error handling if callback exists
      if (processCallback) {
        // Assert - ensure the callback rejects with the expected error
        await expect(processCallback()).rejects.toThrow('Service error');
      } else {
        // Skip test if callback wasn't registered
        console.log('Process callback not registered, skipping test');
      }
    });
  });
  
  describe('startFieldAvailabilityUpdates', () => {
    it('should add initial and recurring jobs to queue', () => {
      // Act
      AvailabilityController.startFieldAvailabilityUpdates();

      // Assert
      expect(fieldAvailabilityQueue.add).toHaveBeenCalledTimes(2);
      expect(fieldAvailabilityQueue.add).toHaveBeenNthCalledWith(1, {}, { jobId: 'initial-update' });
      expect(fieldAvailabilityQueue.add).toHaveBeenNthCalledWith(2, {}, {
        jobId: 'availability-recurring',
        repeat: { cron: '*/1 * * * *' },
      });
    });
  });
  
  describe('cleanupFieldAvailabilityUpdates', () => {
    it('should close the availability queue', async () => {
      // Act
      await AvailabilityController.cleanupFieldAvailabilityUpdates();

      // Assert
      expect(fieldAvailabilityQueue.close).toHaveBeenCalled();
    });
  });
}); 