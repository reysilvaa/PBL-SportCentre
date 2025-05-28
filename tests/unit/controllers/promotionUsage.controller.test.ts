import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { Request, Response } from 'express';
import { unitTestSetup } from '../../core';
import { Role } from '../../../src/types';

// Setup untuk pengujian unit
const { prismaMock } = unitTestSetup.setupControllerTest();

// Import controller setelah mock
import * as promotionUsageController from '../../../src/controllers/promotionUsage.controller';

// Tambahkan custom interface untuk request dengan userBranch
interface CustomRequest extends Request {
  userBranch?: { id: number };
}

describe('Promotion Usage Controller', () => {
  let mockRequest: Partial<CustomRequest>;
  let mockResponse: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn().mockReturnThis();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });

    mockRequest = {
      body: {},
      // @ts-ignore - mengabaikan masalah tipe pada header
      header: jest.fn(),
      params: {},
      query: {},
      user: { id: 1, role: Role.USER },
      userBranch: undefined,
    };

    mockResponse = {
      // @ts-ignore - mengabaikan masalah tipe pada json dan status
      json: jsonMock,
      // @ts-ignore - mengabaikan masalah tipe pada json dan status
      status: statusMock,
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getPromotionUsages', () => {
    it('seharusnya mengembalikan semua penggunaan promosi untuk admin', async () => {
      // Setup
      mockRequest.user = { id: 1, role: Role.SUPER_ADMIN };
      
      const mockPromotionUsages = [
        {
          id: 1,
          userId: 2,
          bookingId: 101,
          promoId: 5,
          user: { id: 2, name: 'Pengguna 1', email: 'user1@example.com' },
          booking: {
            id: 101,
            field: {
              name: 'Lapangan Futsal',
              branch: { name: 'Cabang Utama' }
            }
          },
          promo: { id: 5, code: 'DISKON50', discountPercent: 50 }
        },
        {
          id: 2,
          userId: 3,
          bookingId: 102,
          promoId: 5,
          user: { id: 3, name: 'Pengguna 2', email: 'user2@example.com' },
          booking: {
            id: 102,
            field: {
              name: 'Lapangan Badminton',
              branch: { name: 'Cabang Utama' }
            }
          },
          promo: { id: 5, code: 'DISKON50', discountPercent: 50 }
        }
      ];
      
      prismaMock.promotionUsage.findMany.mockResolvedValue(mockPromotionUsages as any);

      // Execute
      await promotionUsageController.getPromotionUsages(mockRequest as any, mockResponse as Response);

      // Verify
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        status: true,
        message: 'Berhasil mendapatkan data penggunaan promo',
        data: mockPromotionUsages
      });
    });

    it('seharusnya memfilter penggunaan promosi berdasarkan query params', async () => {
      // Setup
      mockRequest.user = { id: 1, role: Role.SUPER_ADMIN };
      mockRequest.query = { userId: '2', promoId: '5' };
      
      const filteredUsages = [
        {
          id: 1,
          userId: 2,
          bookingId: 101,
          promoId: 5,
          user: { id: 2, name: 'Pengguna 1', email: 'user1@example.com' },
          booking: {
            field: {
              name: 'Lapangan Futsal',
              branch: { name: 'Cabang Utama' }
            }
          },
          promo: { id: 5, code: 'DISKON50', discountPercent: 50 }
        }
      ];
      
      prismaMock.promotionUsage.findMany.mockResolvedValue(filteredUsages as any);

      // Execute
      await promotionUsageController.getPromotionUsages(mockRequest as any, mockResponse as Response);

      // Verify
      expect(prismaMock.promotionUsage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 2,
            promoId: 5
          })
        })
      );
      expect(statusMock).toHaveBeenCalledWith(200);
    });
    
    it('seharusnya memfilter berdasarkan cabang untuk admin cabang', async () => {
      // Setup
      mockRequest.user = { id: 1, role: Role.ADMIN_CABANG };
      mockRequest.userBranch = { id: 1 };
      
      const branchFilteredUsages = [
        {
          id: 1,
          userId: 2,
          bookingId: 101,
          promoId: 5,
          user: { id: 2, name: 'Pengguna 1' },
          booking: {
            field: {
              name: 'Lapangan Futsal',
              branch: { name: 'Cabang Utama' }
            }
          },
          promo: { id: 5, code: 'DISKON50' }
        }
      ];
      
      prismaMock.promotionUsage.findMany.mockResolvedValue(branchFilteredUsages as any);

      // Execute
      await promotionUsageController.getPromotionUsages(mockRequest as any, mockResponse as Response);

      // Verify
      expect(prismaMock.promotionUsage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            booking: {
              field: {
                branchId: 1
              }
            }
          })
        })
      );
      expect(statusMock).toHaveBeenCalledWith(200);
    });
  });

  describe('createPromotionUsage', () => {
    it('seharusnya membuat penggunaan promosi baru', async () => {
      // Setup
      mockRequest.user = { id: 2, role: Role.USER };
      mockRequest.body = { bookingId: 101, promoId: 5 };
      
      const mockBooking = {
        id: 101,
        userId: 2,
        fieldId: 1
      };
      
      const mockPromo = {
        id: 5,
        code: 'DISKON50',
        status: 'active',
        validFrom: new Date(Date.now() - 86400000), // kemarin
        validUntil: new Date(Date.now() + 86400000) // besok
      };
      
      const mockUsage = {
        id: 1,
        userId: 2,
        bookingId: 101,
        promoId: 5,
        createdAt: new Date(),
        promo: mockPromo
      };
      
      prismaMock.booking.findFirst.mockResolvedValue(mockBooking as any);
      prismaMock.promotion.findUnique.mockResolvedValue(mockPromo as any);
      prismaMock.promotionUsage.findFirst.mockResolvedValue(null); // tidak ada penggunaan sebelumnya
      prismaMock.promotionUsage.create.mockResolvedValue(mockUsage as any);

      // Execute
      await promotionUsageController.createPromotionUsage(mockRequest as any, mockResponse as Response);

      // Verify
      expect(prismaMock.promotionUsage.create).toHaveBeenCalledWith({
        data: { userId: 2, bookingId: 101, promoId: 5 },
        include: { promo: true }
      });
      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: true,
          message: 'Berhasil menggunakan promo',
          data: mockUsage
        })
      );
    });
    
    it('seharusnya menolak jika data tidak lengkap', async () => {
      // Setup
      mockRequest.user = { id: 2, role: Role.USER };
      mockRequest.body = { promoId: 5 }; // Tidak ada bookingId
      
      // Execute
      await promotionUsageController.createPromotionUsage(mockRequest as any, mockResponse as Response);
      
      // Verify
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        status: false,
        message: 'User ID, booking ID dan promo ID harus diisi',
      });
    });
    
    it('seharusnya menolak jika booking bukan milik user', async () => {
      // Setup
      mockRequest.user = { id: 2, role: Role.USER };
      mockRequest.body = { bookingId: 101, promoId: 5 };
      
      prismaMock.booking.findFirst.mockResolvedValue(null); // tidak ada booking milik user
      
      // Execute
      await promotionUsageController.createPromotionUsage(mockRequest as any, mockResponse as Response);
      
      // Verify
      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        status: false,
        message: 'Booking tidak ditemukan atau bukan milik Anda',
      });
    });
    
    it('seharusnya menolak jika promo tidak valid', async () => {
      // Setup
      mockRequest.user = { id: 2, role: Role.USER };
      mockRequest.body = { bookingId: 101, promoId: 999 };
      
      const mockBooking = {
        id: 101,
        userId: 2,
        fieldId: 1
      };
      
      prismaMock.booking.findFirst.mockResolvedValue(mockBooking as any);
      prismaMock.promotion.findUnique.mockResolvedValue(null); // promo tidak ditemukan
      
      // Execute
      await promotionUsageController.createPromotionUsage(mockRequest as any, mockResponse as Response);
      
      // Verify
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        status: false,
        message: 'Promo tidak valid atau tidak aktif',
      });
    });
    
    it('seharusnya menolak jika promo sudah berakhir', async () => {
      // Setup
      mockRequest.user = { id: 2, role: Role.USER };
      mockRequest.body = { bookingId: 101, promoId: 5 };
      
      const mockBooking = {
        id: 101,
        userId: 2,
        fieldId: 1
      };
      
      const expiredPromo = {
        id: 5,
        code: 'DISKON50',
        status: 'active',
        validFrom: new Date(Date.now() - 172800000), // 2 hari yang lalu
        validUntil: new Date(Date.now() - 86400000) // kemarin
      };
      
      prismaMock.booking.findFirst.mockResolvedValue(mockBooking as any);
      prismaMock.promotion.findUnique.mockResolvedValue(expiredPromo as any);
      
      // Execute
      await promotionUsageController.createPromotionUsage(mockRequest as any, mockResponse as Response);
      
      // Verify
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        status: false,
        message: 'Promo sudah tidak berlaku',
      });
    });
    
    it('seharusnya menolak jika booking sudah menggunakan promo lain', async () => {
      // Setup
      mockRequest.user = { id: 2, role: Role.USER };
      mockRequest.body = { bookingId: 101, promoId: 5 };
      
      const mockBooking = {
        id: 101,
        userId: 2,
        fieldId: 1
      };
      
      const mockPromo = {
        id: 5,
        code: 'DISKON50',
        status: 'active',
        validFrom: new Date(Date.now() - 86400000),
        validUntil: new Date(Date.now() + 86400000)
      };
      
      const existingUsage = {
        id: 3,
        userId: 2,
        bookingId: 101,
        promoId: 4
      };
      
      prismaMock.booking.findFirst.mockResolvedValue(mockBooking as any);
      prismaMock.promotion.findUnique.mockResolvedValue(mockPromo as any);
      prismaMock.promotionUsage.findFirst.mockResolvedValue(existingUsage as any);
      
      // Execute
      await promotionUsageController.createPromotionUsage(mockRequest as any, mockResponse as Response);
      
      // Verify
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        status: false,
        message: 'Booking ini sudah menggunakan promo lain',
      });
    });
  });
  
  describe('deletePromotionUsage', () => {
    it('seharusnya menghapus penggunaan promosi yang ada', async () => {
      // Setup
      mockRequest.params = { id: '1' };
      mockRequest.user = { id: 2, role: Role.USER };
      
      const mockUsage = {
        id: 1,
        userId: 2,
        bookingId: 101,
        promoId: 5
      };
      
      prismaMock.promotionUsage.findUnique.mockResolvedValue(mockUsage as any);
      // Mock delete untuk simulasi error
      prismaMock.promotionUsage.delete.mockRejectedValue(new Error('Database error'));
      
      // Execute
      await promotionUsageController.deletePromotionUsage(mockRequest as any, mockResponse as Response);
      
      // Verify
      expect(prismaMock.promotionUsage.delete).toHaveBeenCalledWith({
        where: { id: 1 }
      });
      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        status: false,
        message: 'Gagal menghapus penggunaan promo'
      });
    });
    
    it('seharusnya menolak jika penggunaan promosi tidak ditemukan', async () => {
      // Setup
      mockRequest.params = { id: '999' };
      mockRequest.user = { id: 2, role: Role.USER };
      
      prismaMock.promotionUsage.findUnique.mockResolvedValue(null);
      
      // Execute
      await promotionUsageController.deletePromotionUsage(mockRequest as any, mockResponse as Response);
      
      // Verify
      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        status: false,
        message: 'Penggunaan promo tidak ditemukan'
      });
    });
    
    it('seharusnya menolak jika user mencoba menghapus penggunaan promosi orang lain', async () => {
      // Setup
      mockRequest.params = { id: '1' };
      mockRequest.user = { id: 3, role: Role.USER }; // User berbeda
      
      const mockUsage = {
        id: 1,
        userId: 2, // Milik user lain
        bookingId: 101,
        promoId: 5
      };
      
      prismaMock.promotionUsage.findUnique.mockResolvedValue(mockUsage as any);
      
      // Execute
      await promotionUsageController.deletePromotionUsage(mockRequest as any, mockResponse as Response);
      
      // Verify
      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({
        status: false,
        message: 'Anda tidak memiliki izin untuk menghapus penggunaan promo ini'
      });
    });
    
    it('seharusnya mengizinkan admin untuk menghapus penggunaan promosi apa pun', async () => {
      // Setup
      mockRequest.params = { id: '1' };
      mockRequest.user = { id: 1, role: Role.SUPER_ADMIN }; // Admin
      
      const mockUsage = {
        id: 1,
        userId: 2, // Milik user lain
        bookingId: 101,
        promoId: 5
      };
      
      prismaMock.promotionUsage.findUnique.mockResolvedValue(mockUsage as any);
      // Mock delete untuk simulasi error
      prismaMock.promotionUsage.delete.mockRejectedValue(new Error('Database error'));
      
      // Execute
      await promotionUsageController.deletePromotionUsage(mockRequest as any, mockResponse as Response);
      
      // Verify
      expect(prismaMock.promotionUsage.delete).toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        status: false,
        message: 'Gagal menghapus penggunaan promo'
      });
    });
    
    it('seharusnya berhasil menghapus penggunaan promosi tanpa error', async () => {
      // Setup
      mockRequest.params = { id: '1' };
      mockRequest.user = { id: 1, role: Role.SUPER_ADMIN }; // Admin
      
      const mockUsage = {
        id: 1,
        userId: 2,
        bookingId: 101,
        promoId: 5,
        promo: { code: 'DISKON50' }
      };
      
      prismaMock.promotionUsage.findUnique.mockResolvedValue(mockUsage as any);
      prismaMock.promotionUsage.delete.mockResolvedValue(mockUsage as any);
      prismaMock.activityLog.create.mockResolvedValue({ id: 1 } as any);
      
      // Execute
      await promotionUsageController.deletePromotionUsage(mockRequest as any, mockResponse as Response);
      
      // Verify
      expect(prismaMock.promotionUsage.delete).toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        status: true,
        message: 'Berhasil menghapus penggunaan promo'
      });
    });
  });
}); 