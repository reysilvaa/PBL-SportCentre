import { Request, Response } from 'express';
import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { 
  checkBlockedUser, 
  trackFailedBooking, 
  resetFailedBookingCounter,
  sanitizeData
} from '../../../src/middlewares/security.middleware';
import redisClient from '../../../src/config/services/redis';
import prisma from '../../../src/config/services/database';

// Mock dependencies
jest.mock('../../../src/config/services/redis', () => ({
  exists: jest.fn(),
  ttl: jest.fn(),
  get: jest.fn(),
  setEx: jest.fn(),
  del: jest.fn(),
}));

jest.mock('../../../src/config/services/database', () => ({
  activityLog: {
    create: jest.fn(),
  },
}));

describe('Security Middleware', () => {
  let mockReq: Partial<Request & { user?: any }>;
  let mockRes: Partial<Response>;
  let mockNext: jest.Mock;

  beforeEach(() => {
    mockReq = {
      user: { id: 1 },
      ip: '192.168.1.1',
      socket: { remoteAddress: '192.168.1.1' } as any,
      body: {},
    };
    
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    
    mockNext = jest.fn();
    
    jest.clearAllMocks();
  });

  describe('checkBlockedUser', () => {
    it('should call next() if user is not blocked', async () => {
      // Arrange
      (redisClient.exists as jest.Mock).mockResolvedValue(0); // User not blocked
      
      // Act
      await checkBlockedUser(mockReq as Request, mockRes as Response, mockNext);
      
      // Assert
      expect(redisClient.exists).toHaveBeenCalledTimes(2); // Once for user, once for IP
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should return 403 if user is blocked', async () => {
      // Arrange
      (redisClient.exists as jest.Mock)
        .mockResolvedValueOnce(1) // User is blocked
        .mockResolvedValueOnce(0); // IP is not blocked (second call)
      (redisClient.ttl as jest.Mock).mockResolvedValue(300); // 5 minutes remaining
      
      // Act
      await checkBlockedUser(mockReq as Request, mockRes as Response, mockNext);
      
      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: false,
        message: expect.stringContaining('Akun Anda diblokir sementara'),
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 403 if IP is blocked', async () => {
      // Arrange
      // First call for user check returns 0 (not blocked)
      // Second call for IP check returns 1 (blocked)
      (redisClient.exists as jest.Mock)
        .mockImplementation((key: string) => {
          if (key.includes('blocked_user')) return Promise.resolve(0);
          if (key.includes('blocked_ip')) return Promise.resolve(1);
          return Promise.resolve(0);
        });
      
      (redisClient.ttl as jest.Mock).mockResolvedValue(180); // 3 minutes remaining
      
      // Act
      await checkBlockedUser(mockReq as Request, mockRes as Response, mockNext);
      
      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: false,
        message: expect.stringContaining('Akses diblokir sementara'),
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should call next() if no user is provided in request', async () => {
      // Arrange
      mockReq.user = undefined;
      
      // Act
      await checkBlockedUser(mockReq as Request, mockRes as Response, mockNext);
      
      // Assert
      expect(mockNext).toHaveBeenCalled();
      expect(redisClient.exists).not.toHaveBeenCalled();
    });

    it('should call next() if Redis throws an error', async () => {
      // Arrange
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      (redisClient.exists as jest.Mock).mockRejectedValue(new Error('Redis error'));
      
      // Act
      await checkBlockedUser(mockReq as Request, mockRes as Response, mockNext);
      
      // Assert
      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('trackFailedBooking', () => {
    it('should increment user and IP fail counters', async () => {
      // Arrange
      (redisClient.get as jest.Mock)
        .mockResolvedValueOnce('1') // User already has 1 failure
        .mockResolvedValueOnce('2'); // IP already has 2 failures
      
      // Act
      const result = await trackFailedBooking(1, 42, '192.168.1.1');
      
      // Assert
      expect(redisClient.setEx).toHaveBeenCalledTimes(2); // Once for user, once for IP
      expect(redisClient.setEx).toHaveBeenCalledWith(
        expect.stringContaining('failed_booking:user_1'),
        expect.any(Number),
        '2' // Incremented from 1 to 2
      );
      expect(redisClient.setEx).toHaveBeenCalledWith(
        expect.stringContaining('failed_booking:ip_192.168.1.1'),
        expect.any(Number),
        '3' // Incremented from 2 to 3
      );
      expect(prisma.activityLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 1,
          action: 'FAILED_BOOKING',
        }),
      });
      expect(result).toEqual({ userFailCount: 2, ipFailCount: 3 });
    });

    it('should block user after reaching maximum failures', async () => {
      // Arrange
      (redisClient.get as jest.Mock)
        .mockResolvedValueOnce('9') // User already has 9 failures (will become 10, the limit)
        .mockResolvedValueOnce('5'); // IP has 5 failures
      
      // Act
      await trackFailedBooking(1, 42, '192.168.1.1');
      
      // Assert
      expect(redisClient.setEx).toHaveBeenCalledWith(
        expect.stringContaining('blocked_user:1'),
        expect.any(Number),
        '1'
      );
      expect(prisma.activityLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 1,
          action: 'USER_BLOCKED',
        }),
      });
    });

    it('should block IP after reaching maximum failures', async () => {
      // Arrange
      (redisClient.get as jest.Mock)
        .mockResolvedValueOnce('5') // User has 5 failures
        .mockResolvedValueOnce('9'); // IP already has 9 failures (will become 10, the limit)
      
      // Act
      await trackFailedBooking(1, 42, '192.168.1.1');
      
      // Assert
      expect(redisClient.setEx).toHaveBeenCalledWith(
        expect.stringContaining('blocked_ip:192.168.1.1'),
        expect.any(Number),
        '1'
      );
      expect(prisma.activityLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 1,
          action: 'IP_BLOCKED',
        }),
      });
    });

    it('should handle Redis errors gracefully', async () => {
      // Arrange
      (redisClient.get as jest.Mock).mockRejectedValue(new Error('Redis error'));
      
      // Spy on console.error to verify it was called
      jest.spyOn(console, 'error').mockImplementation(() => {});
      
      // Act
      const result = await trackFailedBooking(1, 42, '192.168.1.1');
      
      // Assert
      expect(console.error).toHaveBeenCalled();
      expect(result).toEqual({ userFailCount: 0, ipFailCount: 0 });
    });
  });

  describe('resetFailedBookingCounter', () => {
    it('should delete user counter from Redis', async () => {
      // Act
      await resetFailedBookingCounter(1);
      
      // Assert
      expect(redisClient.del).toHaveBeenCalledWith(expect.stringContaining('failed_booking:user_1'));
    });

    it('should handle Redis errors gracefully', async () => {
      // Arrange
      (redisClient.del as jest.Mock).mockRejectedValue(new Error('Redis error'));
      
      // Spy on console.error to verify it was called
      jest.spyOn(console, 'error').mockImplementation(() => {});
      
      // Act
      await resetFailedBookingCounter(1);
      
      // Assert
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('sanitizeData', () => {
    it('should sanitize HTML tags from strings in request body', () => {
      // Arrange
      mockReq.body = {
        name: 'User <script>alert("XSS")</script>',
        email: ' test@example.com ',
        description: '<b>Bold text</b>',
        nested: {
          html: '<img src="x" onerror="alert(1)">',
        },
        array: ['<a href="#">Link</a>', 'Normal text'],
      };
      
      // Act
      sanitizeData(mockReq as Request, mockRes as Response, mockNext);
      
      // Assert
      expect(mockReq.body).toEqual({
        name: 'User scriptalert("XSS")/script',
        email: 'test@example.com',
        description: 'bBold text/b',
        nested: {
          html: 'img src="x" onerror="alert(1)"',
        },
        array: ['<a href="#">Link</a>', 'Normal text'],
      });
      expect(mockNext).toHaveBeenCalled();
    });

    it('should not modify non-string values', () => {
      // Arrange
      mockReq.body = {
        id: 42,
        active: true,
        price: 99.99,
        tags: ['one', 'two'],
        metadata: { key: 'value' },
      };
      
      // Act
      sanitizeData(mockReq as Request, mockRes as Response, mockNext);
      
      // Assert
      expect(mockReq.body).toEqual({
        id: 42,
        active: true,
        price: 99.99,
        tags: ['one', 'two'],
        metadata: { key: 'value' },
      });
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle empty or undefined body', () => {
      // Arrange
      mockReq.body = undefined;
      
      // Act
      sanitizeData(mockReq as Request, mockRes as Response, mockNext);
      
      // Assert
      expect(mockReq.body).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
    });
  });
}); 