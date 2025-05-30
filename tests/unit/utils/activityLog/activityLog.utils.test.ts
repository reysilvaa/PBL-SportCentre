import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { ActivityLogService } from '../../../../src/utils/activityLog/activityLog.utils';
import { User } from '../../../../src/types';

// Mock prisma client
jest.mock('../../../../src/config/services/database', () => ({
  __esModule: true,
  default: {
    activityLog: {
      create: jest.fn(),
      findMany: jest.fn(),
      delete: jest.fn()
    }
  }
}));

// Mock socket handler
jest.mock('../../../../src/socket-handlers/activityLog.socket', () => ({
  broadcastActivityLogUpdates: jest.fn()
}));

describe('ActivityLogService', () => {
  const mockPrisma = require('../../../../src/config/services/database').default;
  const mockSocket = require('../../../../src/socket-handlers/activityLog.socket');
  
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('createLog', () => {
    it('should create an activity log', async () => {
      // Arrange
      const userId = 1;
      const action = 'TEST_ACTION';
      const details = { test: 'data' };
      const relatedId = 123;
      const ipAddress = '127.0.0.1';
      
      const mockCreatedLog = {
        id: 1,
        userId,
        action,
        details: JSON.stringify(details),
        relatedId,
        ipAddress,
        createdAt: new Date(),
        user: { id: userId, name: 'Test User', email: 'test@example.com' }
      };
      
      mockPrisma.activityLog.create.mockResolvedValue(mockCreatedLog);
      
      // Act
      const result = await ActivityLogService.createLog(userId, action, details, relatedId, ipAddress);
      
      // Assert
      expect(mockPrisma.activityLog.create).toHaveBeenCalledWith({
        data: {
          userId,
          action,
          details: JSON.stringify(details),
          relatedId,
          ipAddress,
        },
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      });
      
      expect(mockSocket.broadcastActivityLogUpdates).toHaveBeenCalledWith(userId);
      expect(result).toEqual(mockCreatedLog);
    });
    
    it('should handle string details', async () => {
      // Arrange
      const userId = 1;
      const action = 'TEST_ACTION';
      const details = 'String details';
      
      const mockCreatedLog = {
        id: 1,
        userId,
        action,
        details,
        createdAt: new Date(),
        user: { id: userId, name: 'Test User', email: 'test@example.com' }
      };
      
      mockPrisma.activityLog.create.mockResolvedValue(mockCreatedLog);
      
      // Act
      const result = await ActivityLogService.createLog(userId, action, details);
      
      // Assert
      expect(mockPrisma.activityLog.create).toHaveBeenCalledWith({
        data: {
          userId,
          action,
          details,
        },
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      });
      
      expect(result).toEqual(mockCreatedLog);
    });
    
    it('should handle errors', async () => {
      // Arrange
      const userId = 1;
      const action = 'TEST_ACTION';
      const error = new Error('Database error');
      
      mockPrisma.activityLog.create.mockRejectedValue(error);
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      // Act & Assert
      await expect(ActivityLogService.createLog(userId, action)).rejects.toThrow(error);
      expect(consoleErrorSpy).toHaveBeenCalled();
      
      // Restore
      consoleErrorSpy.mockRestore();
    });
  });
  
  describe('logBookingActivity', () => {
    it('should log booking activity with user object', async () => {
      // Arrange
      const user = { 
        id: 1, 
        name: 'Test User', 
        email: 'test@example.com',
        password: 'hashed_password',
        phone: '1234567890',
        role: 'user',
        createdAt: new Date(),
        updatedAt: new Date()
      } as User;
      const action = 'BOOKING_CREATED';
      const bookingId = 123;
      const details = { price: 100000 };
      const ipAddress = '127.0.0.1';
      
      const createLogSpy = jest.spyOn(ActivityLogService, 'createLog').mockResolvedValue({} as any);
      
      // Act
      await ActivityLogService.logBookingActivity(user, action, bookingId, details, ipAddress);
      
      // Assert
      expect(createLogSpy).toHaveBeenCalledWith(user.id, action, details, bookingId, ipAddress);
      
      // Restore
      createLogSpy.mockRestore();
    });
    
    it('should log booking activity with user ID', async () => {
      // Arrange
      const userId = 1;
      const action = 'BOOKING_CREATED';
      const bookingId = 123;
      
      const createLogSpy = jest.spyOn(ActivityLogService, 'createLog').mockResolvedValue({} as any);
      
      // Act
      await ActivityLogService.logBookingActivity(userId, action, bookingId);
      
      // Assert
      expect(createLogSpy).toHaveBeenCalledWith(userId, action, undefined, bookingId, undefined);
      
      // Restore
      createLogSpy.mockRestore();
    });
  });
  
  describe('logPaymentActivity', () => {
    it('should log payment activity', async () => {
      // Arrange
      const userId = 1;
      const paymentId = 456;
      const bookingId = 123;
      const status = 'PAID';
      const details = { amount: 100000 };
      const ipAddress = '127.0.0.1';
      
      const createLogSpy = jest.spyOn(ActivityLogService, 'createLog').mockResolvedValue({} as any);
      
      // Act
      await ActivityLogService.logPaymentActivity(userId, paymentId, bookingId, status, details, ipAddress);
      
      // Assert
      expect(createLogSpy).toHaveBeenCalledWith(
        userId,
        `Payment ${status} for booking ${bookingId}`,
        {
          paymentId,
          bookingId,
          status,
          ...details,
        },
        undefined,
        ipAddress
      );
      
      // Restore
      createLogSpy.mockRestore();
    });
  });
  
  describe('getLogs', () => {
    it('should get all logs', async () => {
      // Arrange
      const mockLogs = [
        { id: 1, action: 'TEST_ACTION_1', userId: 1 },
        { id: 2, action: 'TEST_ACTION_2', userId: 2 }
      ];
      
      mockPrisma.activityLog.findMany.mockResolvedValue(mockLogs);
      
      // Act
      const result = await ActivityLogService.getLogs();
      
      // Assert
      expect(mockPrisma.activityLog.findMany).toHaveBeenCalledWith({
        where: {},
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
      
      expect(result).toEqual(mockLogs);
    });
    
    it('should get logs filtered by userId', async () => {
      // Arrange
      const userId = 1;
      const mockLogs = [
        { id: 1, action: 'TEST_ACTION_1', userId }
      ];
      
      mockPrisma.activityLog.findMany.mockResolvedValue(mockLogs);
      
      // Act
      const result = await ActivityLogService.getLogs(userId);
      
      // Assert
      expect(mockPrisma.activityLog.findMany).toHaveBeenCalledWith({
        where: { userId },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
      
      expect(result).toEqual(mockLogs);
    });
  });
  
  describe('deleteLog', () => {
    it('should delete a log and broadcast updates', async () => {
      // Arrange
      const logId = 1;
      const mockDeletedLog = {
        id: logId,
        action: 'TEST_ACTION',
        userId: 1,
        user: { id: 1, name: 'Test User', email: 'test@example.com' }
      };
      
      mockPrisma.activityLog.delete.mockResolvedValue(mockDeletedLog);
      
      // Act
      const result = await ActivityLogService.deleteLog(logId);
      
      // Assert
      expect(mockPrisma.activityLog.delete).toHaveBeenCalledWith({
        where: { id: logId },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      });
      
      expect(mockSocket.broadcastActivityLogUpdates).toHaveBeenCalled();
      expect(result).toEqual(mockDeletedLog);
    });
  });
}); 