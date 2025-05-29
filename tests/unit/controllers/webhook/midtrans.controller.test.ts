import { Request, Response } from 'express';
import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import * as MidtransController from '../../../../src/controllers/webhook/midtrans.controller';
import prisma from '../../../../src/config/services/database';
import * as BookingUtils from '../../../../src/utils/booking/booking.utils';
import * as CacheUtils from '../../../../src/utils/cache/cacheInvalidation.utils';
import * as SecurityMiddleware from '../../../../src/middlewares/security.middleware';
import { createHmac } from 'crypto';
import { config } from '../../../../src/config/app/env';
import { getIO } from '../../../../src/config/server/socket';

// Mock dependencies
jest.mock('../../../../src/config/services/database', () => ({
  payment: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  activityLog: {
    create: jest.fn(),
  },
  notification: {
    create: jest.fn(),
  },
}));

jest.mock('../../../../src/utils/booking/booking.utils', () => ({
  emitBookingEvents: jest.fn(),
}));

jest.mock('../../../../src/utils/cache/cacheInvalidation.utils', () => ({
  invalidatePaymentCache: jest.fn(),
}));

jest.mock('../../../../src/middlewares/security.middleware', () => ({
  trackFailedBooking: jest.fn(),
  resetFailedBookingCounter: jest.fn(),
}));

jest.mock('../../../../src/config/server/socket', () => ({
  getIO: jest.fn().mockImplementation(() => {
    throw new Error('Socket.IO not initialized');
  }),
}));

jest.mock('../../../../src/config/app/env', () => ({
  config: {
    midtransServerKey: 'test-server-key',
  },
}));

// Mock createHmac to control the signature validation
jest.mock('crypto', () => {
  const originalModule = jest.requireActual('crypto');
  return {
    ...originalModule,
    createHmac: jest.fn().mockReturnValue({
      update: jest.fn().mockReturnThis(),
      digest: jest.fn().mockReturnValue('valid-signature'),
    }),
  };
});

describe('Midtrans Controller', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;

  beforeEach(() => {
    mockReq = {
      body: {},
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('handleMidtransNotification', () => {
    const mockPayment = {
      id: 42,
      amount: 200000,
      status: 'pending',
      bookingId: 123,
      booking: {
        id: 123,
        userId: 456,
        fieldId: 10,
        user: {
          id: 456,
          email: 'user@example.com',
          name: 'Test User',
        },
        field: {
          id: 10,
          name: 'Lapangan Futsal A',
          branchId: 1,
          branch: {
            id: 1,
            name: 'Cabang Utama',
          },
        },
      },
    };

    const validNotification = {
      order_id: 'PAY-42',
      transaction_status: 'settlement',
      gross_amount: '200000.00',
      status_code: '200',
      transaction_id: 'mid-123456789',
      signature_key: 'valid-signature',
    };

    it('should process settlement notification successfully', async () => {
      // Arrange
      mockReq.body = validNotification;
      (prisma.payment.findUnique as jest.Mock).mockResolvedValueOnce(mockPayment);
      (prisma.payment.update as jest.Mock).mockResolvedValueOnce({
        ...mockPayment,
        status: 'paid',
        transactionId: 'mid-123456789',
      });
      (CacheUtils.invalidatePaymentCache as jest.Mock).mockResolvedValueOnce(true);

      // Act
      await MidtransController.handleMidtransNotification(mockReq as Request, mockRes as Response);

      // Assert
      expect(prisma.payment.findUnique).toHaveBeenCalled();
      expect(prisma.payment.update).toHaveBeenCalled();
      expect(CacheUtils.invalidatePaymentCache).toHaveBeenCalled();
      expect(SecurityMiddleware.resetFailedBookingCounter).toHaveBeenCalled();
      expect(BookingUtils.emitBookingEvents).toHaveBeenCalled();

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: 'success',
        message: 'Notification processed',
        data: expect.objectContaining({
          orderId: 'PAY-42',
          status: 'paid',
          transactionId: 'mid-123456789',
          bookingId: 123,
        }),
      });
    });

    it('should process pending notification correctly', async () => {
      // Arrange
      mockReq.body = {
        ...validNotification,
        transaction_status: 'pending',
      };
      (prisma.payment.findUnique as jest.Mock).mockResolvedValueOnce(mockPayment);
      (prisma.payment.update as jest.Mock).mockResolvedValueOnce({
        ...mockPayment,
        status: 'pending',
        transactionId: 'mid-123456789',
      });

      // Act
      await MidtransController.handleMidtransNotification(mockReq as Request, mockRes as Response);

      // Assert
      expect(prisma.payment.update).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        status: 'success',
        data: expect.objectContaining({
          status: 'pending',
        }),
      }));
    });

    it('should process failed payment notification correctly', async () => {
      // Arrange
      mockReq.body = {
        ...validNotification,
        transaction_status: 'expire',
      };
      (prisma.payment.findUnique as jest.Mock).mockResolvedValueOnce(mockPayment);
      (prisma.payment.update as jest.Mock).mockResolvedValueOnce({
        ...mockPayment,
        status: 'failed',
        transactionId: 'mid-123456789',
      });

      // Act
      await MidtransController.handleMidtransNotification(mockReq as Request, mockRes as Response);

      // Assert
      expect(prisma.payment.update).toHaveBeenCalled();
      expect(SecurityMiddleware.trackFailedBooking).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('should return 400 for invalid signature key', async () => {
      // Arrange
      mockReq.body = {
        ...validNotification,
        signature_key: 'invalid-signature',
      };

      const mockDigest = jest.fn().mockReturnValue('different-signature');
      (createHmac as jest.Mock).mockReturnValueOnce({
        update: jest.fn().mockReturnThis(),
        digest: mockDigest,
      });

      // Act
      await MidtransController.handleMidtransNotification(mockReq as Request, mockRes as Response);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'Invalid signature key',
      });
    });

    it('should return 400 for invalid order ID format', async () => {
      // Arrange
      mockReq.body = {
        ...validNotification,
        order_id: 'INVALID-FORMAT',
      };

      // Act
      await MidtransController.handleMidtransNotification(mockReq as Request, mockRes as Response);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'Invalid order ID format',
      });
    });

    it('should return 400 if payment not found', async () => {
      // Arrange
      mockReq.body = validNotification;
      (prisma.payment.findUnique as jest.Mock).mockResolvedValueOnce(null);

      // Act
      await MidtransController.handleMidtransNotification(mockReq as Request, mockRes as Response);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'Payment with ID 42 not found',
      });
    });

    it('should handle database errors', async () => {
      // Arrange
      mockReq.body = validNotification;
      (prisma.payment.findUnique as jest.Mock).mockRejectedValueOnce(new Error('Database error'));

      // Act
      await MidtransController.handleMidtransNotification(mockReq as Request, mockRes as Response);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'Database error',
      });
    });
  });
}); 