import { describe, it, expect, jest, beforeAll, beforeEach } from '@jest/globals';
import express, { Application } from 'express';
import request from 'supertest';
import branchRoutes from '../../../src/routes/route-lists/branch.routes';
import errorMiddleware from '../../../src/middlewares/error.middleware';
import prisma from '../../../src/config/services/database';

// Mock dependencies to isolate integration test
jest.mock('../../../src/config/services/database', () => ({
  branch: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn().mockResolvedValue(5)
  },
  branchAdmin: {
    create: jest.fn(),
    delete: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn()
  },
  field: {
    findMany: jest.fn().mockResolvedValue([])
  },
  user: {
    findUnique: jest.fn()
  },
  activityLog: {
    create: jest.fn()
  }
}));

// Mock auth middleware
jest.mock('../../../src/middlewares/auth.middleware', () => ({
  auth: (options = {}) => (req, res, next) => {
    // Set default user sebagai super_admin untuk branch routes
    req.user = {
      id: 3,
      role: 'super_admin'
    };
    
    // Jika ada role yang spesifik
    if (options.allowedRoles && options.allowedRoles.length > 0) {
      // Jika branch routes memerlukan role tertentu, pastikan super_admin diizinkan
      if (!options.allowedRoles.includes('super_admin') && 
          !options.allowedRoles.includes('admin_cabang') && 
          !options.allowedRoles.includes('owner_cabang')) {
        return res.status(403).json({
          status: false,
          message: `Forbidden: Resource ini hanya dapat diakses oleh ${options.allowedRoles.join(', ')}`
        });
      }
    }

    // Tambahkan req.ip untuk activity log
    req.ip = '127.0.0.1';
    
    next();
  },
  superAdminAuth: () => (req, res, next) => {
    req.user = {
      id: 3,
      role: 'super_admin'
    };
    req.ip = '127.0.0.1';
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
    req.ip = '127.0.0.1';
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
    req.ip = '127.0.0.1';
    next();
  }
}));

// Mock multer middleware
jest.mock('../../../src/middlewares/multer.middleware', () => ({
  branchUpload: {
    single: () => (req: any, res: any, next: any) => {
      req.file = {
        path: 'uploads/test-image.jpg',
        filename: 'test-image.jpg'
      };
      next();
    }
  }
}));

// Mock cloudinary
jest.mock('../../../src/utils/cloudinary.utils', () => ({
  uploadToCloudinary: jest.fn().mockResolvedValue({
    secure_url: 'https://res.cloudinary.com/test/image/upload/test-image.jpg'
  }),
  deleteImage: jest.fn(),
  cleanupUploadedFile: jest.fn()
}));

// Mock cache
jest.mock('../../../src/utils/cache.utils', () => ({
  cacheMiddleware: () => (req: any, res: any, next: any) => next(),
  clearCacheMiddleware: () => (req: any, res: any, next: any) => {
    res.on('finish', () => {});
    next();
  },
  CACHE_KEYS: {
    BRANCH: 'branch'
  }
}));

// Mock parseId middleware
jest.mock('../../../src/middlewares/parseId.middleware', () => ({
  parseIds: (req: any, res: any, next: any) => {
    // Convert string IDs to numbers
    if (req.params.id) req.params.id = Number(req.params.id);
    if (req.params.userId) req.params.userId = Number(req.params.userId);
    next();
  }
}));

describe('Branch API Integration', () => {
  let app: Application;
  
  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/branches', branchRoutes);
    app.use(errorMiddleware);
  });
  
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('GET /api/branches', () => {
    it('should return all branches with pagination', async () => {
      // Mock database response
      (prisma.branch.findMany as jest.Mock).mockResolvedValue([
        {
          id: 1,
          name: 'Cabang Malang',
          location: 'Jl. Soekarno Hatta No. 10, Malang',
          imageUrl: 'https://example.com/image1.jpg',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]);
      
      const response = await request(app).get('/api/branches');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('meta');
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].name).toBe('Cabang Malang');
    });
    
    it('should filter branches by search query', async () => {
      await request(app).get('/api/branches?search=malang');
      
      expect(prisma.branch.findMany).toHaveBeenCalled();
      const findManyArgs = (prisma.branch.findMany as jest.Mock).mock.calls[0][0];
      expect(findManyArgs).toBeDefined();
    });
  });
  
  describe('GET /api/branches/:id', () => {
    it('should return a branch by ID', async () => {
      (prisma.branch.findUnique as jest.Mock).mockResolvedValue({
        id: 1,
        name: 'Cabang Malang',
        location: 'Jl. Soekarno Hatta No. 10, Malang',
        imageUrl: 'https://example.com/image1.jpg',
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      const response = await request(app).get('/api/branches/1');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('status');
      expect(response.body.data).toHaveProperty('name', 'Cabang Malang');
    });
    
    it('should return 404 if branch not found', async () => {
      (prisma.branch.findUnique as jest.Mock).mockResolvedValue(null);
      
      const response = await request(app).get('/api/branches/999');
      
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('status', false);
    });
  });
  
  describe('GET /api/branches/:id/fields', () => {
    it('should return fields for a branch', async () => {
      (prisma.branch.findUnique as jest.Mock).mockResolvedValue({
        id: 1,
        name: 'Cabang Malang'
      });
      
      (prisma.field.findMany as jest.Mock).mockResolvedValue([
        {
          id: 1,
          name: 'Lapangan Futsal A',
          branchId: 1,
          typeId: 1,
          pricePerHourDay: 100000,
          pricePerHourNight: 150000,
          type: { id: 1, name: 'Futsal' }
        }
      ]);
      
      const response = await request(app).get('/api/branches/1/fields');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });
  
  describe('POST /api/branches', () => {
    it('should create a new branch', async () => {
      (prisma.branch.create as jest.Mock).mockResolvedValue({
        id: 1,
        name: 'Cabang Baru',
        location: 'Lokasi Baru',
        imageUrl: 'https://res.cloudinary.com/test/image/upload/test-image.jpg',
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      const response = await request(app)
        .post('/api/branches')
        .field('name', 'Cabang Baru')
        .field('location', 'Lokasi Baru')
        .attach('imageUrl', Buffer.from('fake image data'), 'test-image.jpg');
      
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('status', true);
      expect(response.body.data).toHaveProperty('name', 'Cabang Baru');
      expect(response.body.data).toHaveProperty('imageUrl');
    });
  });
  
  describe('PUT /api/branches/:id', () => {
    it('should update a branch', async () => {
      (prisma.branch.findUnique as jest.Mock).mockResolvedValue({
        id: 1,
        name: 'Cabang Lama',
        location: 'Lokasi Lama'
      });
      
      (prisma.branch.update as jest.Mock).mockResolvedValue({
        id: 1,
        name: 'Cabang Diupdate',
        location: 'Lokasi Diupdate',
        imageUrl: 'https://example.com/image1.jpg',
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      const response = await request(app)
        .put('/api/branches/1')
        .send({
          name: 'Cabang Diupdate',
          location: 'Lokasi Diupdate'
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('status', true);
      expect(response.body.data).toHaveProperty('name', 'Cabang Diupdate');
    });
  });
  
  describe('DELETE /api/branches/:id', () => {
    it('should delete a branch', async () => {
      (prisma.branch.findUnique as jest.Mock).mockResolvedValue({
        id: 1,
        name: 'Cabang Untuk Dihapus'
      });
      
      (prisma.branch.delete as jest.Mock).mockResolvedValue({
        id: 1,
        name: 'Cabang Untuk Dihapus'
      });
      
      const response = await request(app).delete('/api/branches/1');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('status', true);
      expect(response.body.message).toContain('berhasil dihapus');
    });
  });
  
  describe('POST /api/branches/:id/admins/:userId', () => {
    it('should add a branch admin', async () => {
      (prisma.branch.findUnique as jest.Mock).mockResolvedValue({
        id: 1,
        name: 'Cabang Test'
      });
      
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 2,
        name: 'Admin Baru',
        role: 'admin_cabang'
      });
      
      (prisma.branchAdmin.findFirst as jest.Mock).mockResolvedValue(null);
      
      (prisma.branchAdmin.create as jest.Mock).mockResolvedValue({
        id: 1,
        branchId: 1,
        userId: 2,
        createdAt: new Date()
      });
      
      const response = await request(app).post('/api/branches/1/admins/2');
      
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('status', true);
    });
  });
  
  describe('DELETE /api/branches/:id/admins/:userId', () => {
    it('should delete a branch admin', async () => {
      (prisma.branch.findUnique as jest.Mock).mockResolvedValue({
        id: 1,
        name: 'Cabang Test'
      });
      
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 2,
        name: 'Admin Untuk Dihapus',
        role: 'admin_cabang'
      });
      
      (prisma.branchAdmin.findFirst as jest.Mock).mockResolvedValue({
        id: 1,
        branchId: 1,
        userId: 2
      });
      
      (prisma.branchAdmin.delete as jest.Mock).mockResolvedValue({
        id: 1,
        branchId: 1,
        userId: 2
      });
      
      const response = await request(app).delete('/api/branches/1/admins/2');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('status', true);
    });
  });
}); 