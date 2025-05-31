import { describe, it, expect, jest, beforeAll, beforeEach } from '@jest/globals';
import express, { Application } from 'express';
import request from 'supertest';
import promotionRoutes from '../../../src/routes/route-lists/promotion.routes';
import errorMiddleware from '../../../src/middlewares/error.middleware';
import prisma from '../../../src/config/services/database';

// Mock dependencies to isolate integration test
jest.mock('../../../src/config/services/database', () => {
  const mockPromotion = {
    id: 1,
    code: 'SUMMER2023',
    description: 'Summer discount',
    discountPercent: 10,
    maxDiscount: 50000,
    validFrom: new Date('2023-06-01'),
    validUntil: new Date('2023-08-31'),
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
    PromoUsages: []
  };

  return {
    promotion: {
      findMany: jest.fn().mockResolvedValue([mockPromotion]),
      findUnique: jest.fn().mockImplementation((args) => {
        if (args?.where?.id === 1) {
          return Promise.resolve(mockPromotion);
        }
        return Promise.resolve(null);
      }),
      findFirst: jest.fn().mockImplementation((args) => {
        // Jika mencari kode yang sama dengan EXISTING, kembalikan data
        if (args?.where?.code === 'EXISTING') {
          return Promise.resolve({ id: 2, code: 'EXISTING' });
        }
        // Jika tidak, kembalikan null (kode belum ada)
        return Promise.resolve(null);
      }),
      create: jest.fn().mockImplementation((args) => {
        return Promise.resolve({
          id: 1,
          ...args.data,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }),
      update: jest.fn().mockImplementation((args) => {
        return Promise.resolve({
          ...mockPromotion,
          ...args.data,
          updatedAt: new Date()
        });
      }),
      delete: jest.fn().mockImplementation((args) => {
        return Promise.resolve(mockPromotion);
      }),
      count: jest.fn().mockResolvedValue(5)
    },
    promotionUsage: {
      findFirst: jest.fn().mockImplementation((args) => {
        // Jika ID promotion adalah 1 dan ingin menguji promotion yang sudah digunakan
        if (args?.where?.promoId === 1) {
          return Promise.resolve({ id: 1, promoId: 1, userId: 1 });
        }
        return Promise.resolve(null);
      }),
      count: jest.fn().mockImplementation((args) => {
        // Jika ID promotion adalah 1 dan ingin menguji promotion yang sudah digunakan
        if (args?.where?.promoId === 1) {
          return Promise.resolve(5); // Promotion sudah digunakan 5 kali
        }
        return Promise.resolve(0); // Belum digunakan
      })
    },
    activityLog: {
      create: jest.fn().mockResolvedValue({ id: 1 })
    }
  };
});

// Mock auth middleware
jest.mock('../../../src/middlewares/auth.middleware', () => ({
  auth: (options = {}) => (req, res, next) => {
    // Set default user as admin_cabang untuk promotion routes
    req.user = {
      id: 2,
      role: 'admin_cabang'
    };
    
    req.userBranch = {
      id: 1,
      name: 'Test Branch'
    };
    
    // Jika ada role yang spesifik, periksa apakah admin_cabang atau super_admin diizinkan
    if (options.allowedRoles && options.allowedRoles.length > 0) {
      if (!options.allowedRoles.includes('admin_cabang') && !options.allowedRoles.includes('super_admin')) {
        return res.status(403).json({
          status: false,
          message: `Forbidden: Resource ini hanya dapat diakses oleh ${options.allowedRoles.join(', ')}`
        });
      }
    }
    
    next();
  },
  userAuth: () => (req, res, next) => {
    req.user = {
      id: 1,
      role: 'user'
    };
    next();
  },
  branchAdminAuth: () => (req, res, next) => {
    req.user = {
      id: 2,
      role: 'admin_cabang'
    };
    req.userBranch = {
      id: 1,
      name: 'Test Branch'
    };
    next();
  },
  superAdminAuth: () => (req, res, next) => {
    req.user = {
      id: 3,
      role: 'super_admin'
    };
    next();
  },
  ownerAuth: () => (req, res, next) => {
    req.user = {
      id: 4,
      role: 'owner_cabang'
    };
    req.userBranch = {
      id: 1,
      name: 'Test Branch'
    };
    next();
  }
}));

// Mock cache
jest.mock('../../../src/utils/cache.utils', () => ({
  cacheMiddleware: () => (req, res, next) => next(),
  clearCacheMiddleware: () => (req, res, next) => {
    res.on('finish', () => {});
    next();
  },
  CACHE_KEYS: {
    PROMOTION: 'promotion'
  }
}));

describe('Promotion API Integration', () => {
  let app: Application;
  
  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/promotions', promotionRoutes);
    app.use(errorMiddleware);
  });
  
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('GET /api/promotions', () => {
    it('should return all promotions with pagination', async () => {
      // Mock database response
      const response = await request(app).get('/api/promotions');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('message');
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].code).toBe('SUMMER2023');
    });
    
    it('should filter promotions by status', async () => {
      await request(app).get('/api/promotions?status=active');
      
      expect(prisma.promotion.findMany).toHaveBeenCalled();
      const findManyArgs = (prisma.promotion.findMany as jest.Mock).mock.calls[0][0];
      expect(findManyArgs).toBeDefined();
    });
  });
  
  describe('GET /api/promotions/:id', () => {
    it('should return a promotion by ID', async () => {
      (prisma.promotion.findUnique as jest.Mock).mockResolvedValue({
        id: 1,
        code: 'SUMMER2023',
        description: 'Summer discount',
        discountType: 'percentage',
        discountValue: 10,
        minBookingAmount: 100000,
        maxDiscountAmount: 50000,
        startDate: new Date('2023-06-01'),
        endDate: new Date('2023-08-31'),
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      const response = await request(app).get('/api/promotions/1');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('status', true);
      expect(response.body.data).toHaveProperty('code', 'SUMMER2023');
    });
    
    it('should return 404 if promotion not found', async () => {
      (prisma.promotion.findUnique as jest.Mock).mockResolvedValue(null);
      
      const response = await request(app).get('/api/promotions/999');
      
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('status', false);
    });
  });
  
  describe('POST /api/promotions', () => {
    it('should create a new promotion', async () => {
      const response = await request(app)
        .post('/api/promotions')
        .send({
          code: 'NEWYEAR2024',
          description: 'New Year discount',
          discountPercent: 15,
          maxDiscount: 75000,
          validFrom: '2024-01-01',
          validUntil: '2024-01-31',
          status: 'active'
        });
      
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('status', true);
      expect(response.body.data).toHaveProperty('code', 'NEWYEAR2024');
    });
    
    it('should return 400 if code already exists', async () => {
      const response = await request(app)
        .post('/api/promotions')
        .send({
          code: 'EXISTING',
          description: 'Existing promotion',
          discountPercent: 10,
          validFrom: '2023-01-01',
          validUntil: '2023-12-31'
        });
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('status', false);
    });
  });
  
  describe('PUT /api/promotions/:id', () => {
    it('should update a promotion', async () => {
      const response = await request(app)
        .put('/api/promotions/1')
        .send({
          description: 'Updated summer discount',
          discountPercent: 15,
          maxDiscount: 75000
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('status', true);
      expect(response.body.data).toHaveProperty('description', 'Updated summer discount');
    });
    
    it('should return 404 if promotion not found', async () => {
      const response = await request(app)
        .put('/api/promotions/999')
        .send({
          description: 'Updated description'
        });
      
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('status', false);
    });
  });
  
  describe('DELETE /api/promotions/:id', () => {
    it('should delete a promotion', async () => {
      // Override mock untuk test ini
      (prisma.promotionUsage.findFirst as jest.Mock).mockResolvedValueOnce(null);
      
      const response = await request(app).delete('/api/promotions/1');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('status', true);
      expect(response.body.message).toContain('berhasil');
    });
    
    it('should return 404 if promotion not found', async () => {
      const response = await request(app).delete('/api/promotions/999');
      
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('status', false);
    });
    
    it('should return 400 if promotion has been used', async () => {
      // Override mock untuk test ini
      (prisma.promotionUsage.findFirst as jest.Mock).mockResolvedValueOnce({ id: 1, promoId: 1, userId: 1 });
      
      const response = await request(app).delete('/api/promotions/1');
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('status', false);
      expect(response.body.message).toContain('Tidak dapat menghapus promo yang sudah digunakan');
    });
  });
}); 