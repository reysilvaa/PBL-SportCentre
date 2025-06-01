import { describe, it, expect, jest, beforeAll, beforeEach } from '@jest/globals';
import express, { Application } from 'express';
import request from 'supertest';
import promotionUsageRoutes from '../../../src/routes/route-lists/promotionUsage.routes';
import errorMiddleware from '../../../src/middlewares/error.middleware';
import prisma from '../../../src/config/services/database';

// Mock dependencies untuk isolasi test integrasi
jest.mock('../../../src/config/services/database', () => {
  const mockPromotionUsages = [
    {
      id: 1,
      promoId: 1,
      userId: 1,
      bookingId: 1,
      createdAt: new Date(),
      promo: {
        id: 1,
        code: 'SUMMER2023',
        discountPercent: 10
      },
      user: {
        id: 1,
        name: 'User Test',
        email: 'user@example.com'
      },
      booking: {
        id: 1,
        field: {
          name: 'Lapangan Futsal A',
          branch: {
            name: 'Cabang Malang'
          }
        }
      }
    }
  ];
  
  return {
    promotionUsage: {
      findMany: jest.fn().mockResolvedValue(mockPromotionUsages),
      findUnique: jest.fn().mockImplementation((args: any) => {
        if (args.where.id === 999) {
          return Promise.resolve(null);
        }
        return Promise.resolve({
          id: args.where.id,
          promoId: 1,
          userId: 1,
          bookingId: 1,
          createdAt: new Date()
        });
      }),
      create: jest.fn().mockResolvedValue({
        id: 1,
        promoId: 1,
        userId: 1,
        bookingId: 1,
        createdAt: new Date(),
        promo: {
          code: 'SUMMER2023'
        }
      }),
      delete: jest.fn().mockImplementation((args: any) => {
        if (args.where.id === 999) {
          throw new Error('Promotion usage not found');
        }
        return Promise.resolve({
          id: args.where.id,
          promoId: 1,
          userId: 1,
          bookingId: 1,
          createdAt: new Date()
        });
      }),
      findFirst: jest.fn().mockImplementation((args: any) => {
        if (args.where.bookingId === 1 && args.where.bookingId !== undefined) {
          return Promise.resolve({
            id: 1,
            promoId: 1,
            userId: 1,
            bookingId: 1
          });
        }
        return Promise.resolve(null);
      })
    },
    promotion: {
      findUnique: jest.fn().mockImplementation((args: any) => {
        if (args.where.id === 999) {
          return Promise.resolve(null);
        }
        return Promise.resolve({
          id: args.where.id,
          code: 'SUMMER2023',
          discountPercent: 10,
          status: 'active'
        });
      })
    },
    booking: {
      findUnique: jest.fn().mockResolvedValue({
        id: 1,
        userId: 1,
        fieldId: 1
      })
    }
  };
});

// Mock auth middleware
jest.mock('../../../src/middlewares/auth.middleware', () => ({
  auth: jest.fn().mockImplementation((options: any = {}) => (req: any, _res: any, next: any) => {
    // Jika opsi admin, gunakan role admin_cabang
    if (options.allowedRoles && 
        (options.allowedRoles.includes('admin_cabang') || options.allowedRoles.includes('super_admin'))) {
      req.user = { id: 1, role: 'admin_cabang' };
    } else {
      req.user = { id: 1, role: 'user' };
    }
    next();
  })
}));

let app: Application;

beforeAll(() => {
  app = express();
  app.use(express.json());
  app.use('/api/promotion-usages', promotionUsageRoutes);
  app.use(errorMiddleware as express.ErrorRequestHandler);
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Promotion Usage API Integration', () => {
  describe('GET /api/promotion-usages', () => {
    it('should return all promotion usages with pagination (admin access)', async () => {
      const response = await request(app)
        .get('/api/promotion-usages');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', true);
      expect(response.body).toHaveProperty('message', 'Berhasil mendapatkan data penggunaan promo');
      expect(response.body).toHaveProperty('data');
      expect(prisma.promotionUsage.findMany).toHaveBeenCalled();
    });
    
    it('should filter promotion usages by user ID', async () => {
      const response = await request(app)
        .get('/api/promotion-usages?userId=1');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(prisma.promotionUsage.findMany).toHaveBeenCalled();
      // Memeriksa apakah filter userId diterapkan
      expect(prisma.promotionUsage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 1
          })
        })
      );
    });
  });
  
  describe('POST /api/promotion-usages', () => {
    it('should create a new promotion usage', async () => {
      // Mock untuk promo valid dan belum digunakan
      (prisma.promotion.findUnique as jest.Mock).mockResolvedValueOnce({
        id: 1,
        code: 'SUMMER2023',
        discountPercent: 10,
        status: 'active'
      });
      
      (prisma.promotionUsage.findFirst as jest.Mock).mockResolvedValueOnce(null);
      
      (prisma.promotionUsage.create as jest.Mock).mockResolvedValueOnce({
        id: 1,
        promoId: 1,
        userId: 1,
        bookingId: 2,
        createdAt: new Date(),
        promo: {
          code: 'SUMMER2023'
        }
      });
      
      const response = await request(app)
        .post('/api/promotion-usages')
        .send({
          promoId: 1,
          bookingId: 2
        });
      
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('status', true);
      expect(response.body).toHaveProperty('message', 'Berhasil menggunakan promo');
      expect(prisma.promotionUsage.create).toHaveBeenCalled();
    });
    
    it('should return 400 if promotion does not exist', async () => {
      // Mock untuk promo tidak ditemukan
      (prisma.promotion.findUnique as jest.Mock).mockResolvedValueOnce(null);
      
      const response = await request(app)
        .post('/api/promotion-usages')
        .send({
          promoId: 999,
          bookingId: 1
        });
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('status', false);
      expect(response.body).toHaveProperty('message', 'Promo tidak valid atau tidak aktif');
    });
    
    it('should return 400 if promotion has already been used by the user', async () => {
      // Mock untuk promo valid
      (prisma.promotion.findUnique as jest.Mock).mockResolvedValueOnce({
        id: 1,
        code: 'SUMMER2023',
        discountPercent: 10,
        status: 'active'
      });
      
      // Mock promo sudah digunakan
      (prisma.promotionUsage.findFirst as jest.Mock).mockResolvedValueOnce({
        id: 1,
        promoId: 1,
        userId: 1,
        bookingId: 1
      });
      
      const response = await request(app)
        .post('/api/promotion-usages')
        .send({
          promoId: 1,
          bookingId: 1
        });
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('status', false);
      expect(response.body).toHaveProperty('message', 'Booking ini sudah menggunakan promo lain');
    });
  });
  
  describe('DELETE /api/promotion-usages/:id', () => {
    it('should delete a promotion usage (admin access)', async () => {
      // Mock promotionUsage ditemukan
      (prisma.promotionUsage.findUnique as jest.Mock).mockResolvedValueOnce({
        id: 1,
        promoId: 1,
        userId: 1,
        bookingId: 1,
        createdAt: new Date()
      });
      
      // Mock delete berhasil
      (prisma.promotionUsage.delete as jest.Mock).mockResolvedValueOnce({
        id: 1,
        promoId: 1,
        userId: 1,
        bookingId: 1,
        createdAt: new Date()
      });
      
      const response = await request(app)
        .delete('/api/promotion-usages/1');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', true);
      expect(response.body).toHaveProperty('message', 'Berhasil menghapus penggunaan promo');
      expect(prisma.promotionUsage.delete).toHaveBeenCalled();
    });
    
    it('should return 404 if promotion usage not found', async () => {
      // Mock promotionUsage tidak ditemukan
      (prisma.promotionUsage.findUnique as jest.Mock).mockResolvedValueOnce(null);
      
      const response = await request(app)
        .delete('/api/promotion-usages/999');
      
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('status', false);
      expect(response.body).toHaveProperty('message', 'Penggunaan promo tidak ditemukan');
    });
  });
}); 