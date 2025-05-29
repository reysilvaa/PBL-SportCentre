import { Request, Response } from 'express';
import { jest } from '@jest/globals';
import * as AvailabilityController from '../../../src/controllers/availability.controller';
import * as AvailabilityUtils from '../../../src/utils/booking/checkAvailability.utils';
import * as SocketConfig from '../../../src/config/server/socket';
import { fieldAvailabilityQueue } from '../../../src/config/services/queue';

// Mock dependencies
jest.mock('../../../src/utils/booking/checkAvailability.utils', () => ({
  getAllFieldsAvailability: jest.fn(),
}));

jest.mock('../../../src/config/server/socket', () => ({
  emitFieldAvailabilityUpdate: jest.fn(),
}));

jest.mock('../../../src/config/services/queue', () => ({
  fieldAvailabilityQueue: {
    process: jest.fn(),
    add: jest.fn(),
    close: jest.fn(),
  },
}), { virtual: true });

describe('Availability Controller', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;

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
      let processCallback: Function = () => {};
      (fieldAvailabilityQueue.process as jest.Mock).mockImplementation((callback) => {
        processCallback = callback;
      });

      (AvailabilityUtils.getAllFieldsAvailability as jest.Mock).mockResolvedValue(
        [{ fieldId: 1, fieldName: 'Test Field', branch: 'Test Branch', isAvailable: true, availableTimeSlots: [] }]
      );

      // Act
      AvailabilityController.setupFieldAvailabilityProcessor();
      const result = await processCallback();

      // Assert
      expect(AvailabilityUtils.getAllFieldsAvailability).toHaveBeenCalled();
      expect(SocketConfig.emitFieldAvailabilityUpdate).toHaveBeenCalled();
      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('timestamp');
    });

    it('should handle errors in processor', async () => {
      // Arrange
      let processCallback: Function = () => {};
      (fieldAvailabilityQueue.process as jest.Mock).mockImplementation((callback) => {
        processCallback = callback;
      });

      const testError = new Error('Service error');
      (AvailabilityUtils.getAllFieldsAvailability as jest.Mock).mockRejectedValue(testError);

      // Act
      AvailabilityController.setupFieldAvailabilityProcessor();
      
      // Assert
      await expect(processCallback()).rejects.toThrow('Service error');
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