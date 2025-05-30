// @ts-nocheck
import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { getPromotions, createPromotion, updatePromotion, deletePromotion } from '../../../src/controllers/promotion.controller';

// Mock the database
jest.mock('../../../src/config/services/database', () => ({
  __esModule: true,
  default: {
    promotion: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    promotionUsage: {
      findFirst: jest.fn(),
    },
    activityLog: {
      create: jest.fn(),
    },
  },
}));

// Mock the cache invalidation
jest.mock('../../../src/utils/cache/cacheInvalidation.utils', () => ({
  invalidatePromotionCache: jest.fn(),
}));

describe('Promotion Controller', () => {
  let req, res;
  
  beforeEach(() => {
    req = {
      query: {},
      params: {},
      body: {},
      user: { id: 1, role: 'super_admin' },
      ip: '127.0.0.1',
    };
    
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    
    jest.clearAllMocks();
  });
  
  describe('getPromotions', () => {
    it('should return all promotions', async () => {
      const mockPromotions = [
        { id: 1, code: 'PROMO1', discountPercent: 10, validFrom: new Date(), validUntil: new Date() },
        { id: 2, code: 'PROMO2', discountPercent: 20, validFrom: new Date(), validUntil: new Date() },
      ];
      
      const prisma = require('../../../src/config/services/database').default;
      prisma.promotion.findMany.mockResolvedValue(mockPromotions);
      
      await getPromotions(req, res);
      
      expect(prisma.promotion.findMany).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        status: true,
        message: 'Berhasil mendapatkan daftar promo',
        data: mockPromotions,
      });
    });
    
    it('should handle errors', async () => {
      const prisma = require('../../../src/config/services/database').default;
      prisma.promotion.findMany.mockRejectedValue(new Error('Database error'));
      
      await getPromotions(req, res);
      
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        status: false,
        message: 'Internal Server Error',
      });
    });
  });
  
  describe('createPromotion', () => {
    it('should create a new promotion', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      
      req.body = {
        code: 'NEWPROMO',
        description: 'New promotion',
        discountPercent: 15,
        maxDiscount: 50000,
        validFrom: tomorrow.toISOString(),
        validUntil: nextWeek.toISOString(),
      };
      
      const mockPromotion = { 
        id: 1, 
        ...req.body,
        validFrom: tomorrow,
        validUntil: nextWeek,
        status: 'active',
      };
      
      const prisma = require('../../../src/config/services/database').default;
      prisma.promotion.findFirst.mockResolvedValue(null);
      prisma.promotion.create.mockResolvedValue(mockPromotion);
      
      await createPromotion(req, res);
      
      expect(prisma.promotion.create).toHaveBeenCalledWith({
        data: {
          code: 'NEWPROMO',
          description: 'New promotion',
          discountPercent: 15,
          maxDiscount: 50000,
          validFrom: expect.any(Date),
          validUntil: expect.any(Date),
          status: 'active',
        },
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        status: true,
        message: 'Berhasil membuat promo baru',
        data: mockPromotion,
      });
    });
    
    it('should return 400 if required fields are missing', async () => {
      req.body = {
        code: 'NEWPROMO',
      };
      
      await createPromotion(req, res);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        status: false,
        message: 'Kode, deskripsi, dan persentase diskon harus diisi',
      });
    });
    
    it('should return 400 if code already exists', async () => {
      req.body = {
        code: 'EXISTINGPROMO',
        description: 'Existing promotion',
        discountPercent: 10,
      };
      
      const prisma = require('../../../src/config/services/database').default;
      prisma.promotion.findFirst.mockResolvedValue({ id: 1, code: 'EXISTINGPROMO' });
      
      await createPromotion(req, res);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        status: false,
        message: 'Kode promo sudah digunakan',
      });
    });
    
    it('should handle errors', async () => {
      req.body = {
        code: 'NEWPROMO',
        description: 'New promotion',
        discountPercent: 15,
      };
      
      const prisma = require('../../../src/config/services/database').default;
      prisma.promotion.findFirst.mockResolvedValue(null);
      prisma.promotion.create.mockRejectedValue(new Error('Database error'));
      
      await createPromotion(req, res);
      
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        status: false,
        message: 'Internal Server Error',
      });
    });
  });
  
  describe('updatePromotion', () => {
    it('should update a promotion', async () => {
      req.params.id = '1';
      req.body = {
        description: 'Updated promotion',
      };
      
      const existingPromo = {
        id: 1,
        code: 'PROMO1',
        description: 'Old description',
        discountPercent: 10,
        maxDiscount: 50000,
        validFrom: new Date(),
        validUntil: new Date(),
        status: 'active',
      };
      
      const updatedPromo = {
        ...existingPromo,
        description: 'Updated promotion',
      };
      
      const prisma = require('../../../src/config/services/database').default;
      prisma.promotion.findUnique.mockResolvedValue(existingPromo);
      prisma.promotion.update.mockResolvedValue(updatedPromo);
      
      await updatePromotion(req, res);
      
      expect(prisma.promotion.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          code: 'PROMO1',
          description: 'Updated promotion',
          discountPercent: 10,
          maxDiscount: 50000,
          validFrom: existingPromo.validFrom,
          validUntil: existingPromo.validUntil,
          status: 'active',
        },
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        status: true,
        message: 'Berhasil memperbarui promo',
        data: updatedPromo,
      });
    });
    
    it('should return 404 if promotion not found', async () => {
      req.params.id = '999';
      req.body = {
        description: 'Updated promotion',
      };
      
      const prisma = require('../../../src/config/services/database').default;
      prisma.promotion.findUnique.mockResolvedValue(null);
      
      await updatePromotion(req, res);
      
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        status: false,
        message: 'Promo tidak ditemukan',
      });
    });
    
    it('should handle errors', async () => {
      req.params.id = '1';
      req.body = {
        description: 'Updated promotion',
      };
      
      const prisma = require('../../../src/config/services/database').default;
      prisma.promotion.findUnique.mockRejectedValue(new Error('Database error'));
      
      await updatePromotion(req, res);
      
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        status: false,
        message: 'Internal Server Error',
      });
    });
  });
  
  describe('deletePromotion', () => {
    it('should delete a promotion', async () => {
      req.params.id = '1';
      
      const existingPromo = {
        id: 1,
        code: 'PROMO1',
        description: 'Test promotion',
      };
      
      const prisma = require('../../../src/config/services/database').default;
      prisma.promotion.findUnique.mockResolvedValue(existingPromo);
      prisma.promotionUsage.findFirst.mockResolvedValue(null);
      prisma.promotion.delete.mockResolvedValue(existingPromo);
      
      await deletePromotion(req, res);
      
      expect(prisma.promotion.delete).toHaveBeenCalledWith({
        where: { id: 1 },
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        status: true,
        message: 'Berhasil menghapus promo',
      });
    });
    
    it('should return 404 if promotion not found', async () => {
      req.params.id = '999';
      
      const prisma = require('../../../src/config/services/database').default;
      prisma.promotion.findUnique.mockResolvedValue(null);
      
      await deletePromotion(req, res);
      
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        status: false,
        message: 'Promo tidak ditemukan',
      });
    });
    
    it('should return 400 if promotion has been used', async () => {
      req.params.id = '1';
      
      const existingPromo = {
        id: 1,
        code: 'PROMO1',
        description: 'Test promotion',
      };
      
      const prisma = require('../../../src/config/services/database').default;
      prisma.promotion.findUnique.mockResolvedValue(existingPromo);
      prisma.promotionUsage.findFirst.mockResolvedValue({ id: 1, promoId: 1 });
      
      await deletePromotion(req, res);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        status: false,
        message: 'Tidak dapat menghapus promo yang sudah digunakan',
      });
    });
    
    it('should handle errors', async () => {
      req.params.id = '1';
      
      const prisma = require('../../../src/config/services/database').default;
      prisma.promotion.findUnique.mockRejectedValue(new Error('Database error'));
      
      await deletePromotion(req, res);
      
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        status: false,
        message: 'Internal Server Error',
      });
    });
  });
}); 