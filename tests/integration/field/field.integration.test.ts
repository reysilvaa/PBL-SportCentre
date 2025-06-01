  import { describe, it, expect, jest, beforeAll, beforeEach } from '@jest/globals';
  import express, { Application } from 'express';
  import request from 'supertest';
  import fieldRoutes from '../../../src/routes/route-lists/field.routes';
  import errorMiddleware from '../../../src/middlewares/error.middleware';
  import prisma from '../../../src/config/services/database';

  // Mock dependencies untuk isolasi test integrasi
  jest.mock('../../../src/config/services/database', () => ({
    field: {
      findMany: jest.fn().mockResolvedValue([
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
      ]),
      findUnique: jest.fn().mockImplementation((args) => {
        if (args.where.id === 1) {
          return Promise.resolve({
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
        }
        return Promise.resolve(null);
      }),
      create: jest.fn().mockResolvedValue({
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
      }),
      update: jest.fn().mockResolvedValue({
        id: 1,
        name: 'Updated Field',
        description: 'Updated field description',
        branchId: 1,
        typeId: 1,
        pricePerHourDay: 120000,
        pricePerHourNight: 180000,
        nightStartHour: 18,
        status: 'active',
        imageUrl: 'https://res.cloudinary.com/test/image/upload/test-image.jpg',
        createdAt: new Date(),
        updatedAt: new Date()
      }),
      delete: jest.fn().mockResolvedValue({
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
        updatedAt: new Date()
      }),
      count: jest.fn().mockResolvedValue(10)
    },
    branch: {
      findUnique: jest.fn().mockResolvedValue({
        id: 1,
        name: 'Test Branch'
      })
    },
    fieldType: {
      findUnique: jest.fn().mockResolvedValue({
        id: 1,
        name: 'Futsal'
      })
    },
    booking: {
      findMany: jest.fn().mockResolvedValue([])
    },
    fieldReview: {
      aggregate: jest.fn().mockResolvedValue({ _avg: { rating: 4.5 } })
    }
  }));

  // Mock auth middleware
  jest.mock('../../../src/middlewares/auth.middleware', () => {
    return {
      auth: jest.fn().mockImplementation(() => (req, res, next) => {
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
        
        next();
      })
    };
  });

  // Mock multer middleware
  jest.mock('../../../src/middlewares/multer.middleware', () => ({
    fieldUpload: {
      single: () => (req, res, next) => {
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
    cacheMiddleware: () => (req, res, next) => next(),
    clearCacheMiddleware: () => (req, res, next) => {
      res.on('finish', () => {});
      next();
    },
    CACHE_KEYS: {
      FIELD: 'field'
    }
  }));

  // Mock parseId middleware
  jest.mock('../../../src/middlewares/parseId.middleware', () => ({
    parseIds: (req, res, next) => {
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
        const response = await request(app).get('/api/fields');
        
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('data');
        expect(response.body).toHaveProperty('meta');
        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0].name).toBe('Field 1');
      });
      
      it('should filter fields by search query', async () => {
        const response = await request(app).get('/api/fields?search=futsal');
        
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('data');
      });
      
      it('should filter fields by branchId', async () => {
        const response = await request(app).get('/api/fields?branchId=1');
        
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('data');
      });
    });
    
    describe('GET /api/fields/:id', () => {
      it('should return a field by ID', async () => {
        const response = await request(app).get('/api/fields/1');
        
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('data');
        expect(response.body).toHaveProperty('message');
        expect(response.body).toHaveProperty('status');
        expect(response.body.data).toHaveProperty('name', 'Field 1');
      });
      
      it('should return 404 if field not found', async () => {
        const response = await request(app).get('/api/fields/999');
        
        expect(response.status).toBe(404);
        expect(response.body).toHaveProperty('message');
        expect(response.body).toHaveProperty('status', false);
      });
    });
    
    describe('POST /api/fields', () => {
      it('should create a new field as branch admin', async () => {
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
          .attach('imageUrl', Buffer.from('fake image data'), 'test-image.jpg');
        
        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('data');
        expect(response.body).toHaveProperty('message');
        expect(response.body).toHaveProperty('status', true);
      });
    });
    
    describe('PUT /api/fields/:id', () => {
      it('should update a field', async () => {
        const response = await request(app)
          .put('/api/fields/1')
          .field('name', 'Updated Field')
          .field('description', 'Updated field description')
          .field('branchId', '1')
          .field('typeId', '1')
          .field('pricePerHourDay', '120000')
          .field('pricePerHourNight', '180000')
          .field('nightStartHour', '18')
          .field('status', 'active');
        
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('data');
        expect(response.body).toHaveProperty('message');
        expect(response.body).toHaveProperty('status', true);
      });
      
      it('should return 404 if field not found', async () => {
        const response = await request(app)
          .put('/api/fields/999')
          .field('name', 'Updated Field')
          .field('description', 'Updated field description');
        
        expect(response.status).toBe(404);
        expect(response.body).toHaveProperty('message');
        expect(response.body).toHaveProperty('status', false);
      });
    });
    
    describe('DELETE /api/fields/:id', () => {
      it('should delete a field', async () => {
        const response = await request(app).delete('/api/fields/1');
        
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('message');
        expect(response.body).toHaveProperty('status', true);
      });
      
      it('should return 404 if field not found', async () => {
        const response = await request(app).delete('/api/fields/999');
        
        expect(response.status).toBe(404);
        expect(response.body).toHaveProperty('message');
        expect(response.body).toHaveProperty('status', false);
      });
    });
  }); 