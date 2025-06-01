import { Request, Response } from 'express';
import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import * as NotificationController from '../../../../src/controllers/webhook/notification.controller';
import prisma from '../../../../src/config/services/database';

// Mock dependencies
jest.mock('../../../../src/config/services/database', () => ({
  notification: {
    findMany: jest.fn(),
    update: jest.fn(),
  },
}));

describe('Notification Controller', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  
  beforeEach(() => {
    mockReq = {
      params: {}
    };
    
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    
    jest.clearAllMocks();
  });

  describe('getNotifications', () => {
    const mockNotifications = [
      {
        id: 1,
        userId: 123,
        title: 'Booking Confirmed',
        message: 'Your booking has been confirmed',
        isRead: false,
        type: 'booking',
        linkId: 'booking-123',
        createdAt: new Date(),
      },
      {
        id: 2,
        userId: 123,
        title: 'Payment Received',
        message: 'We have received your payment',
        isRead: true,
        type: 'payment',
        linkId: 'payment-456',
        createdAt: new Date(),
      },
    ];

    it('should return notifications for a specific user', async () => {
      // Arrange
      mockReq.params = { userId: '123' };
      (prisma.notification.findMany as jest.Mock).mockResolvedValue(mockNotifications);

      // Act
      await NotificationController.getNotifications(mockReq as Request, mockRes as Response);

      // Assert
      expect(prisma.notification.findMany).toHaveBeenCalledWith({
        where: {
          userId: 123,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
      expect(mockRes.json).toHaveBeenCalledWith({
        status: true,
        message: 'Berhasil mendapatkan notifikasi',
        data: mockNotifications
      });
    });

    it('should handle database errors', async () => {
      // Arrange
      mockReq.params = { userId: '123' };
      (prisma.notification.findMany as jest.Mock).mockRejectedValue(new Error('Database error'));

      // Act
      await NotificationController.getNotifications(mockReq as Request, mockRes as Response);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ 
        status: false,
        message: 'Gagal mendapatkan notifikasi',
        error: 'Internal Server Error' 
      });
    });
  });

  describe('readNotification', () => {
    const mockNotification = {
      id: 1,
      userId: 123,
      title: 'Booking Confirmed',
      message: 'Your booking has been confirmed',
      isRead: true,
      type: 'booking',
      linkId: 'booking-123',
      createdAt: new Date(),
    };

    it('should mark a notification as read', async () => {
      // Arrange
      mockReq.params = { id: '1' };
      (prisma.notification.update as jest.Mock).mockResolvedValue(mockNotification);

      // Act
      await NotificationController.readNotification(mockReq as Request, mockRes as Response);

      // Assert
      expect(prisma.notification.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { isRead: true },
      });
      expect(mockRes.json).toHaveBeenCalledWith({
        status: true,
        message: 'Notifikasi ditandai sebagai telah dibaca',
        data: mockNotification
      });
    });

    it('should handle database errors', async () => {
      // Arrange
      mockReq.params = { id: '1' };
      (prisma.notification.update as jest.Mock).mockRejectedValue(new Error('Database error'));

      // Act
      await NotificationController.readNotification(mockReq as Request, mockRes as Response);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ 
        status: false,
        message: 'Gagal menandai notifikasi sebagai dibaca',
        error: 'Internal Server Error' 
      });
    });

    it('should handle invalid notification ID', async () => {
      // Arrange
      mockReq.params = { id: 'invalid' };
      (prisma.notification.update as jest.Mock).mockRejectedValue(new Error('Invalid ID'));

      // Act
      await NotificationController.readNotification(mockReq as Request, mockRes as Response);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ 
        status: false,
        message: 'Gagal menandai notifikasi sebagai dibaca',
        error: 'Internal Server Error' 
      });
    });
  });
}); 