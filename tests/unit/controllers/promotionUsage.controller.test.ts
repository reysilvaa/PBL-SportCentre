import { Response } from 'express';
import { jest, describe, it, beforeEach, expect } from '@jest/globals';
import * as PromotionUsageController from '../../../src/controllers/promotionUsage.controller';
import prisma from '../../../src/config/services/database';
import { Role } from '../../../src/types';

// Mock dependencies
jest.mock('../../../src/config/services/database', () => ({
  promotionUsage: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    findUnique: jest.fn(),
    delete: jest.fn(),
  },
  booking: {
    findFirst: jest.fn(),
  },
  promotion: {
    findUnique: jest.fn(),
  },
  activityLog: {
    create: jest.fn(),
  },
}));

describe('Promotion Usage Controller', () => {
  let mockReq: any;
  let mockRes: any;
  
  beforeEach(() => {
    mockReq = {
      user: { id: 1, role: Role.USER },
      userBranch: null,
      query: {},
      body: {},
      params: {},
      ip: '192.168.1.1',
    };
    
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;

    jest.clearAllMocks();
  });

  describe('getPromotionUsages', () => {
    const mockUsages = [
      {
        id: 1,
        userId: 1,
        bookingId: 1,
        promoId: 1,
        createdAt: new Date(),
        user: {
          id: 1,
          name: 'User 1',
          email: 'user1@example.com',
        },
        booking: {
          id: 1,
          field: {
            name: 'Lapangan 1',
            branch: {
              name: 'Cabang 1',
            },
          },
        },
        promo: {
          id: 1,
          code: 'PROMO10',
          name: 'Diskon 10%',
        },
      },
    ];

    it('should return promotion usages for regular users', async () => {
      // Arrange
      (prisma.promotionUsage.findMany as jest.Mock).mockResolvedValue(mockUsages);

      // Act
      await PromotionUsageController.getPromotionUsages(mockReq, mockRes);

      // Assert
      expect(prisma.promotionUsage.findMany).toHaveBeenCalledWith({
        where: {},
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          booking: {
            include: {
              field: {
                select: {
                  name: true,
                  branch: {
                    select: {
                      name: true,
                    },
                  },
                },
              },
            },
          },
          promo: true,
        },
      });
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: true,
        message: 'Berhasil mendapatkan data penggunaan promo',
        data: mockUsages,
      });
    });

    it('should filter by userId when provided', async () => {
      // Arrange
      mockReq.query.userId = '1';
      (prisma.promotionUsage.findMany as jest.Mock).mockResolvedValue(mockUsages);

      // Act
      await PromotionUsageController.getPromotionUsages(mockReq, mockRes);

      // Assert
      expect(prisma.promotionUsage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: 1 }),
        })
      );
    });

    it('should filter by promoId when provided', async () => {
      // Arrange
      mockReq.query.promoId = '2';
      (prisma.promotionUsage.findMany as jest.Mock).mockResolvedValue(mockUsages);

      // Act
      await PromotionUsageController.getPromotionUsages(mockReq, mockRes);

      // Assert
      expect(prisma.promotionUsage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ promoId: 2 }),
        })
      );
    });

    it('should filter by branch for branch admin', async () => {
      // Arrange
      mockReq.user.role = Role.ADMIN_CABANG;
      mockReq.userBranch = { id: 3 };
      (prisma.promotionUsage.findMany as jest.Mock).mockResolvedValue(mockUsages);

      // Act
      await PromotionUsageController.getPromotionUsages(mockReq, mockRes);

      // Assert
      expect(prisma.promotionUsage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            booking: {
              field: {
                branchId: 3,
              },
            },
          }),
        })
      );
    });

    it('should handle error', async () => {
      // Arrange
      (prisma.promotionUsage.findMany as jest.Mock).mockRejectedValue(new Error('Database error'));

      // Act
      await PromotionUsageController.getPromotionUsages(mockReq, mockRes);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: false,
        message: 'Internal Server Error',
      });
    });
  });

  describe('createPromotionUsage', () => {
    const validPromoData = {
      bookingId: 1,
      promoId: 1,
    };

    const mockBooking = {
      id: 1,
      userId: 1,
      fieldId: 1,
      status: 'PENDING',
    };

    const mockPromotion = {
      id: 1,
      code: 'PROMO10',
      status: 'active',
      validFrom: new Date(Date.now() - 86400000), // 1 day ago
      validUntil: new Date(Date.now() + 86400000), // 1 day in future
    };

    const mockPromotionUsage = {
      id: 1,
      userId: 1,
      bookingId: 1,
      promoId: 1,
      promo: mockPromotion,
    };

    it('should create a new promotion usage successfully', async () => {
      // Arrange
      mockReq.body = validPromoData;
      
      (prisma.booking.findFirst as jest.Mock).mockResolvedValue(mockBooking);
      (prisma.promotion.findUnique as jest.Mock).mockResolvedValue(mockPromotion);
      (prisma.promotionUsage.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.promotionUsage.create as jest.Mock).mockResolvedValue(mockPromotionUsage);

      // Act
      await PromotionUsageController.createPromotionUsage(mockReq, mockRes);

      // Assert
      expect(prisma.booking.findFirst).toHaveBeenCalledWith({
        where: {
          id: validPromoData.bookingId,
          userId: mockReq.user.id,
        },
      });
      expect(prisma.promotion.findUnique).toHaveBeenCalledWith({
        where: { id: validPromoData.promoId },
      });
      expect(prisma.promotionUsage.create).toHaveBeenCalledWith({
        data: {
          userId: mockReq.user.id,
          bookingId: validPromoData.bookingId,
          promoId: validPromoData.promoId,
        },
        include: {
          promo: true,
        },
      });
      expect(prisma.activityLog.create).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: true,
        message: 'Berhasil menggunakan promo',
        data: mockPromotionUsage,
      });
    });

    it('should return 400 if required fields are missing', async () => {
      // Arrange
      mockReq.body = { bookingId: 1 }; // promoId missing

      // Act
      await PromotionUsageController.createPromotionUsage(mockReq, mockRes);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: false,
        message: 'User ID, booking ID dan promo ID harus diisi',
      });
    });

    it('should return 404 if booking not found or not owned by user', async () => {
      // Arrange
      mockReq.body = validPromoData;
      
      (prisma.booking.findFirst as jest.Mock).mockResolvedValue(null);

      // Act
      await PromotionUsageController.createPromotionUsage(mockReq, mockRes);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: false,
        message: 'Booking tidak ditemukan atau bukan milik Anda',
      });
    });

    it('should return 400 if promotion is not valid or not active', async () => {
      // Arrange
      mockReq.body = validPromoData;
      
      (prisma.booking.findFirst as jest.Mock).mockResolvedValue(mockBooking);
      (prisma.promotion.findUnique as jest.Mock).mockResolvedValue({
        ...mockPromotion,
        status: 'inactive',
      });

      // Act
      await PromotionUsageController.createPromotionUsage(mockReq, mockRes);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: false,
        message: 'Promo tidak valid atau tidak aktif',
      });
    });

    it('should return 400 if promotion is expired', async () => {
      // Arrange
      mockReq.body = validPromoData;
      
      (prisma.booking.findFirst as jest.Mock).mockResolvedValue(mockBooking);
      (prisma.promotion.findUnique as jest.Mock).mockResolvedValue({
        ...mockPromotion,
        validFrom: new Date(Date.now() - 172800000), // 2 days ago
        validUntil: new Date(Date.now() - 86400000), // 1 day ago (expired)
      });

      // Act
      await PromotionUsageController.createPromotionUsage(mockReq, mockRes);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: false,
        message: 'Promo sudah tidak berlaku',
      });
    });

    it('should return 400 if booking already has a promotion', async () => {
      // Arrange
      mockReq.body = validPromoData;
      
      (prisma.booking.findFirst as jest.Mock).mockResolvedValue(mockBooking);
      (prisma.promotion.findUnique as jest.Mock).mockResolvedValue(mockPromotion);
      (prisma.promotionUsage.findFirst as jest.Mock).mockResolvedValue({
        id: 2,
        bookingId: 1,
        promoId: 2,
      });

      // Act
      await PromotionUsageController.createPromotionUsage(mockReq, mockRes);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: false,
        message: 'Booking ini sudah menggunakan promo lain',
      });
    });
  });

  describe('deletePromotionUsage', () => {
    const mockUsage = {
      id: 1,
      userId: 1,
      bookingId: 1,
      promoId: 1,
      booking: {
        id: 1,
        userId: 1,
      },
      promo: {
        id: 1,
        code: 'PROMO10',
      },
    };

    it('should delete promotion usage successfully for owner', async () => {
      // Arrange
      mockReq.params = { id: '1' };
      
      (prisma.promotionUsage.findUnique as jest.Mock).mockResolvedValue(mockUsage);
      (prisma.promotionUsage.delete as jest.Mock).mockResolvedValue(mockUsage);

      // Act
      await PromotionUsageController.deletePromotionUsage(mockReq, mockRes);

      // Assert
      expect(prisma.promotionUsage.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        include: {
          booking: true,
          promo: true,
        },
      });
      expect(prisma.promotionUsage.delete).toHaveBeenCalledWith({
        where: { id: 1 },
      });
      expect(prisma.activityLog.create).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: true,
        message: 'Berhasil menghapus penggunaan promo',
      });
    });

    it('should delete promotion usage successfully for admin', async () => {
      // Arrange
      mockReq.params = { id: '1' };
      mockReq.user = { id: 2, role: Role.SUPER_ADMIN };
      
      (prisma.promotionUsage.findUnique as jest.Mock).mockResolvedValue({
        ...mockUsage,
        userId: 3, // Different user ID
      });
      (prisma.promotionUsage.delete as jest.Mock).mockResolvedValue(mockUsage);

      // Act
      await PromotionUsageController.deletePromotionUsage(mockReq, mockRes);

      // Assert
      expect(prisma.promotionUsage.delete).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('should return 400 if ID is invalid', async () => {
      // Arrange
      mockReq.params = { id: 'invalid' };

      // Act
      await PromotionUsageController.deletePromotionUsage(mockReq, mockRes);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: false,
        message: 'ID penggunaan promo tidak valid',
      });
    });

    it('should return 404 if promotion usage not found', async () => {
      // Arrange
      mockReq.params = { id: '999' };
      
      (prisma.promotionUsage.findUnique as jest.Mock).mockResolvedValue(null);

      // Act
      await PromotionUsageController.deletePromotionUsage(mockReq, mockRes);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: false,
        message: 'Penggunaan promo tidak ditemukan',
      });
    });

    it('should return 403 if user is not authorized to delete', async () => {
      // Arrange
      mockReq.params = { id: '1' };
      mockReq.user = { id: 2, role: Role.USER };
      
      (prisma.promotionUsage.findUnique as jest.Mock).mockResolvedValue({
        ...mockUsage,
        userId: 1, // Different from current user
      });

      // Act
      await PromotionUsageController.deletePromotionUsage(mockReq, mockRes);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: false,
        message: 'Anda tidak memiliki izin untuk menghapus penggunaan promo ini',
      });
    });

    it('should handle errors', async () => {
      // Arrange
      mockReq.params = { id: '1' };
      
      (prisma.promotionUsage.findUnique as jest.Mock).mockRejectedValue(new Error('Database error'));

      // Act
      await PromotionUsageController.deletePromotionUsage(mockReq, mockRes);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: false,
        message: 'Gagal menghapus penggunaan promo',
      });
    });
  });
}); 