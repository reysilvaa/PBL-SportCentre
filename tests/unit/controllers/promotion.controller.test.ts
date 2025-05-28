import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { Request, Response } from 'express';
import { unitTestSetup } from '../../core';
import { PromotionStatus } from '../../../src/types';

// Setup untuk pengujian unit
const { prismaMock } = unitTestSetup.setupControllerTest();

// Import controller setelah mock
import * as promotionController from '../../../src/controllers/promotion.controller';

describe('Promotion Controller', () => {
  let mockRequest: Partial<Request>;
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
      ip: '127.0.0.1',
      user: {},
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

  describe('getPromotions', () => {
    it('seharusnya mengembalikan semua promosi yang tersedia', async () => {
      // Setup
      const mockPromotions = [
        { 
          id: 1, 
          code: 'DISKON50', 
          description: 'Diskon 50%', 
          discountPercent: 50,
          PromoUsages: []
        },
        { 
          id: 2, 
          code: 'WEEKEND20', 
          description: 'Diskon Akhir Pekan', 
          discountPercent: 20,
          PromoUsages: []
        },
      ];
      prismaMock.promotion.findMany.mockResolvedValue(mockPromotions as any);

      // Execute
      await promotionController.getPromotions(mockRequest as Request, mockResponse as Response);

      // Verify
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        status: true,
        message: 'Berhasil mendapatkan daftar promo',
        data: mockPromotions
      });
    });

    it('seharusnya menangani error saat mengambil daftar promosi', async () => {
      // Setup
      prismaMock.promotion.findMany.mockRejectedValue(new Error('Database error'));

      // Execute
      await promotionController.getPromotions(mockRequest as Request, mockResponse as Response);

      // Verify
      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        status: false,
        message: 'Internal Server Error',
      });
    });
  });

  describe('createPromotion', () => {
    it('seharusnya membuat promosi baru dengan sukses', async () => {
      // Setup
      const newPromotion = { 
        code: 'NEWPROMO', 
        description: 'Promo Baru', 
        discountPercent: 30, 
        maxDiscount: 100000 
      };
      
      mockRequest.body = newPromotion;
      mockRequest.user = { id: 1 };
      
      const mockCreatedPromotion = {
        id: 3,
        ...newPromotion,
        validFrom: expect.any(Date),
        validUntil: expect.any(Date),
        status: PromotionStatus.ACTIVE,
        createdAt: new Date()
      };
      
      prismaMock.promotion.findFirst.mockResolvedValue(null);
      prismaMock.promotion.create.mockResolvedValue(mockCreatedPromotion as any);
      prismaMock.activityLog.create.mockResolvedValue({ id: 1 } as any);

      // Execute
      await promotionController.createPromotion(mockRequest as any, mockResponse as Response);

      // Verify
      expect(prismaMock.promotion.create).toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith({
        status: true,
        message: 'Berhasil membuat promo baru',
        data: mockCreatedPromotion
      });
    });
    
    it('seharusnya menolak jika data tidak lengkap', async () => {
      // Setup
      mockRequest.body = { description: 'Promo Tidak Lengkap' }; // Tidak ada code atau discountPercent
      
      // Execute
      await promotionController.createPromotion(mockRequest as any, mockResponse as Response);
      
      // Verify
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        status: false,
        message: 'Kode, deskripsi, dan persentase diskon harus diisi',
      });
    });
    
    it('seharusnya menolak jika kode promo sudah digunakan', async () => {
      // Setup
      mockRequest.body = { 
        code: 'EXISTINGCODE', 
        description: 'Promo Duplikat', 
        discountPercent: 25 
      };
      
      prismaMock.promotion.findFirst.mockResolvedValue({ id: 5, code: 'EXISTINGCODE' } as any);
      
      // Execute
      await promotionController.createPromotion(mockRequest as any, mockResponse as Response);
      
      // Verify
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        status: false,
        message: 'Kode promo sudah digunakan',
      });
    });
  });
  
  describe('updatePromotion', () => {
    it('seharusnya mengupdate promosi yang ada', async () => {
      // Setup
      const updateData = { 
        code: 'UPDATED', 
        description: 'Promo Updated', 
        discountPercent: 40
      };
      
      mockRequest.params = { id: '3' };
      mockRequest.body = updateData;
      mockRequest.user = { id: 1 };
      
      const existingPromo = {
        id: 3,
        code: 'OLDCODE',
        description: 'Old Description',
        discountPercent: 30,
        validFrom: new Date(),
        validUntil: new Date(),
        status: PromotionStatus.ACTIVE
      };
      
      const updatedPromotion = {
        ...existingPromo,
        ...updateData
      };
      
      prismaMock.promotion.findUnique.mockResolvedValue(existingPromo as any);
      prismaMock.promotion.findFirst.mockResolvedValue(null); // Kode belum digunakan
      prismaMock.promotion.update.mockResolvedValue(updatedPromotion as any);
      
      // Execute
      await promotionController.updatePromotion(mockRequest as any, mockResponse as Response);
      
      // Verify
      expect(prismaMock.promotion.update).toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        status: true,
        message: 'Berhasil memperbarui promo',
        data: updatedPromotion
      });
    });
    
    it('seharusnya menolak jika promosi tidak ditemukan', async () => {
      // Setup
      mockRequest.params = { id: '999' };
      mockRequest.body = { code: 'NOTFOUND' };
      
      prismaMock.promotion.findUnique.mockResolvedValue(null);
      
      // Execute
      await promotionController.updatePromotion(mockRequest as any, mockResponse as Response);
      
      // Verify
      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        status: false,
        message: 'Promo tidak ditemukan',
      });
    });
  });
  
  describe('deletePromotion', () => {
    it('seharusnya menghapus promosi yang ada', async () => {
      // Setup
      mockRequest.params = { id: '3' };
      mockRequest.user = { id: 1 };
      
      const deletedPromotion = {
        id: 3,
        code: 'TOBEDELETED',
        description: 'Promo yang akan dihapus'
      };
      
      prismaMock.promotion.findUnique.mockResolvedValue(deletedPromotion as any);
      prismaMock.promotion.delete.mockResolvedValue(deletedPromotion as any);
      prismaMock.activityLog.create.mockResolvedValue({ id: 2 } as any);
      
      // Execute
      await promotionController.deletePromotion(mockRequest as any, mockResponse as Response);
      
      // Verify
      expect(prismaMock.promotion.delete).toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        status: true,
        message: 'Berhasil menghapus promo'
      });
    });
    
    it('seharusnya menolak jika promosi tidak ditemukan', async () => {
      // Setup
      mockRequest.params = { id: '999' };
      
      prismaMock.promotion.findUnique.mockResolvedValue(null);
      
      // Execute
      await promotionController.deletePromotion(mockRequest as any, mockResponse as Response);
      
      // Verify
      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        status: false,
        message: 'Promo tidak ditemukan',
      });
    });
  });
}); 