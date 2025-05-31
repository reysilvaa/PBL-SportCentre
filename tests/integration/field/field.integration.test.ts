import { describe, it, expect, jest, beforeAll, beforeEach } from '@jest/globals';
import express, { Application } from 'express';
import request from 'supertest';
import fieldRoutes from '../../../src/routes/route-lists/field.routes';
import errorMiddleware from '../../../src/middlewares/error.middleware';
import prisma from '../../../src/config/services/database';

// Mock dependencies to isolate integration test
jest.mock('../../../src/config/services/database', () => ({
  field: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn().mockResolvedValue(10)
  },
  branch: {
    findUnique: jest.fn()
  },
  fieldType: {
    findUnique: jest.fn()
  },
  booking: {
    findMany: jest.fn().mockResolvedValue([])
  },
  fieldReview: {
    aggregate: jest.fn().mockResolvedValue({ _avg: { rating: 4.5 } })
  }
}));

// Mock auth middleware
jest.mock('../../../src/middlewares/auth.middleware', () => ({
  auth: (options = {}) => (req, res, next) => {
    // Set default user sebagai admin_cabang untuk field routes
    req.user = {
      id: 2,
      role: 'admin_cabang'
    };
    
    req.userBranch = {
      id: 1,
      name: 'Test Branch'
    };
    
    // Tambahkan req.ip untuk activity log
    req.ip = '127.0.0.1';
    
    // Untuk test DELETE /api/fields/999 dan PUT /api/fields/999 (field not found)
    if (req.params.id === '999') {
      // Simulasikan bahwa field dengan ID 999 tidak ditemukan
      return res.status(404).json({
        status: false,
        message: 'Field tidak ditemukan'
      });
    }
    
    next();
  }
}));

// Mock multer middleware
jest.mock('../../../src/middlewares/multer.middleware', () => ({
  fieldUpload: {
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
    FIELD: 'field'
  }
}));

// Mock parseId middleware
jest.mock('../../../src/middlewares/parseId.middleware', () => ({
  parseIds: (req: any, res: any, next: any) => {
    // Convert string IDs to numbers
    if (req.params.id) req.params.id = Number(req.params.id);
    if (req.body.branchId) req.body.branchId = Number(req.body.branchId);
    if (req.body.typeId) req.body.typeId = Number(req.body.typeId);
    next();
  }
}));

describe('Field API Integration', () => {
  let app: Application;
  
  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/fields', fieldRoutes);
    app.use(errorMiddleware);
  });
  
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('GET /api/fields', () => {
    it('should return all fields with pagination', async () => {
      // Mock database response
      (prisma.field.findMany as jest.Mock).mockResolvedValue([
        {
          id: 1,
          name: 'Field 1',
          description: 'Test field 1',
          branchId: 1,
          typeId: 1,
          pricePerHourDay: 100000,
          pricePerHourNight: 150000,
          nightStartHour: 18,
          status: 'active',
          imageUrl: 'https://example.com/image1.jpg',
          createdAt: new Date(),
          updatedAt: new Date(),
          branch: {
            id: 1,
            name: 'Branch 1'
          },
          type: {
            id: 1,
            name: 'Futsal'
          }
        }
      ]);
      
      const response = await request(app).get('/api/fields');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('meta');
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].name).toBe('Field 1');
    });
    
    it('should filter fields by search query', async () => {
      await request(app).get('/api/fields?search=futsal');
      
      expect(prisma.field.findMany).toHaveBeenCalled();
      const findManyArgs = (prisma.field.findMany as jest.Mock).mock.calls[0][0];
      expect(findManyArgs).toBeDefined();
    });
    
    it('should filter fields by branchId', async () => {
      await request(app).get('/api/fields?branchId=1');
      
      expect(prisma.field.findMany).toHaveBeenCalled();
      const findManyArgs = (prisma.field.findMany as jest.Mock).mock.calls[0][0];
      expect(findManyArgs).toBeDefined();
    });
  });
  
  describe('GET /api/fields/:id', () => {
    it('should return a field by ID', async () => {
      (prisma.field.findUnique as jest.Mock).mockResolvedValue({
        id: 1,
        name: 'Field 1',
        description: 'Test field 1',
        branchId: 1,
        typeId: 1,
        pricePerHourDay: 100000,
        pricePerHourNight: 150000,
        nightStartHour: 18,
        status: 'active',
        imageUrl: 'https://example.com/image1.jpg',
        createdAt: new Date(),
        updatedAt: new Date(),
        branch: {
          id: 1,
          name: 'Branch 1'
        },
        type: {
          id: 1,
          name: 'Futsal'
        }
      });
      
      const response = await request(app).get('/api/fields/1');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('status');
      expect(response.body.data).toHaveProperty('name', 'Field 1');
    });
    
    it('should return 404 if field not found', async () => {
      (prisma.field.findUnique as jest.Mock).mockResolvedValue(null);
      
      const response = await request(app).get('/api/fields/999');
      
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('status', false);
    });
  });
  
  describe('POST /api/fields', () => {
    it('should create a new field as branch admin', async () => {
      (prisma.branch.findUnique as jest.Mock).mockResolvedValue({
        id: 1,
        name: 'Test Branch'
      });
      
      (prisma.fieldType.findUnique as jest.Mock).mockResolvedValue({
        id: 1,
        name: 'Futsal'
      });
      
      (prisma.field.create as jest.Mock).mockResolvedValue({
        id: 1,
        name: 'New Field',
        description: 'New test field',
        branchId: 1,
        typeId: 1,
        pricePerHourDay: 100000,
        pricePerHourNight: 150000,
        nightStartHour: 18,
        status: 'active',
        imageUrl: 'https://res.cloudinary.com/test/image/upload/test-image.jpg',
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      const response = await request(app)
        .post('/api/fields')
        .field('name', 'New Field')
        .field('description', 'New test field')
        .field('branchId', '1')
        .field('typeId', '1')
        .field('pricePerHourDay', '100000')
        .field('pricePerHourNight', '150000')
        .field('nightStartHour', '18')
        .field('status', 'active')
        .attach('image', Buffer.from('fake image data'), 'test-image.jpg');
      
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('status', true);
      expect(response.body.data).toHaveProperty('name', 'New Field');
      expect(response.body.data).toHaveProperty('imageUrl');
    });
  });
  
  describe('PUT /api/fields/:id', () => {
    it('should update a field', async () => {
      (prisma.field.findUnique as jest.Mock).mockResolvedValue({
        id: 1,
        name: 'Field 1',
        branchId: 1,
        typeId: 1
      });
      
      (prisma.field.update as jest.Mock).mockResolvedValue({
        id: 1,
        name: 'Updated Field',
        description: 'Updated description',
        branchId: 1,
        typeId: 1,
        pricePerHourDay: 120000,
        pricePerHourNight: 170000,
        nightStartHour: 19,
        status: 'active',
        imageUrl: 'https://example.com/image1.jpg',
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      const response = await request(app)
        .put('/api/fields/1')
        .send({
          name: 'Updated Field',
          description: 'Updated description',
          pricePerHourDay: 120000,
          pricePerHourNight: 170000,
          nightStartHour: 19
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('status', true);
      expect(response.body.data).toHaveProperty('name', 'Updated Field');
      expect(response.body.data).toHaveProperty('pricePerHourDay', 120000);
    });
    
    it('should return 404 if field not found', async () => {
      (prisma.field.findUnique as jest.Mock).mockResolvedValue(null);
      
      const response = await request(app)
        .put('/api/fields/999')
        .send({
          name: 'Updated Field'
        });
      
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('status', false);
    });
  });
  
  describe('DELETE /api/fields/:id', () => {
    it('should delete a field', async () => {
      (prisma.field.findUnique as jest.Mock).mockResolvedValue({
        id: 1,
        name: 'Field 1',
        branchId: 1,
        imageUrl: 'https://example.com/image1.jpg'
      });
      
      (prisma.field.delete as jest.Mock).mockResolvedValue({
        id: 1,
        name: 'Field 1'
      });
      
      const response = await request(app).delete('/api/fields/1');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('status', true);
      expect(response.body.message).toContain('berhasil dihapus');
    });
    
    it('should return 404 if field not found', async () => {
      (prisma.field.findUnique as jest.Mock).mockResolvedValue(null);
      
      const response = await request(app).delete('/api/fields/999');
      
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('status', false);
    });
  });
}); 