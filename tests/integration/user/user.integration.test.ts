import { describe, it, expect, jest, beforeAll, beforeEach } from '@jest/globals';
import express, { Application } from 'express';
import request from 'supertest';
import userRoutes from '../../../src/routes/route-lists/user.routes';
import errorMiddleware from '../../../src/middlewares/error.middleware';
import prisma from '../../../src/config/services/database';

// Mock dependencies to isolate integration test
jest.mock('../../../src/config/services/database', () => ({
  user: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn().mockResolvedValue(10)
  },
  booking: {
    findMany: jest.fn()
  },
  activityLog: {
    create: jest.fn()
  }
}));

// Mock auth middleware
jest.mock('../../../src/middlewares/auth.middleware', () => ({
  auth: (options = {}) => (req, res, next) => {
    // Set default user sebagai super_admin untuk user routes
    req.user = {
      id: 3,
      role: 'super_admin'
    };
    
    // Jika ada role yang spesifik
    if (options.allowedRoles && options.allowedRoles.length > 0) {
      // Jika user routes memerlukan role tertentu, pastikan super_admin diizinkan
      // Jika tidak, kita perlu memeriksa role lain
      if (!options.allowedRoles.includes('super_admin') && 
          !options.allowedRoles.includes('admin_cabang') && 
          !options.allowedRoles.includes('owner_cabang')) {
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

// Mock password utils
jest.mock('../../../src/utils/password.utils', () => ({
  hashPassword: jest.fn().mockResolvedValue('hashed_password'),
  verifyPassword: jest.fn().mockResolvedValue(true)
}));

// Mock cache
jest.mock('../../../src/utils/cache.utils', () => ({
  cacheMiddleware: () => (req, res, next) => next(),
  clearCacheMiddleware: () => (req, res, next) => {
    res.on('finish', () => {});
    next();
  },
  CACHE_KEYS: {
    USER: 'user'
  }
}));

// Mock activity log
jest.mock('../../../src/utils/activityLog/activityLog.utils', () => ({
  logUserActivity: jest.fn()
}));

describe('User API Integration', () => {
  let app: Application;
  
  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/users', userRoutes);
    app.use(errorMiddleware);
  });
  
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('GET /api/users', () => {
    it('should return all users with pagination', async () => {
      // Mock database response
      const response = await request(app).get('/api/users');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('message');
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].name).toBe('Test User');
    });
    
    it('should filter users by search query', async () => {
      await request(app).get('/api/users?search=test');
      
      expect(prisma.user.findMany).toHaveBeenCalled();
      // Check that the search parameter was used in the query
      const findManyArgs = (prisma.user.findMany as jest.Mock).mock.calls[0][0];
      expect(findManyArgs).toBeDefined();
    });
  });
  
  describe('GET /api/users/detail/:id', () => {
    it('should return a user profile by ID', async () => {
      const response = await request(app).get('/api/users/detail/1');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('status', true);
    });
  });
  
  describe('GET /api/users/:id', () => {
    it('should return a user by ID', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 1,
        name: 'Test User',
        email: 'test@example.com',
        phone: '08123456789',
        role: 'user',
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      const response = await request(app).get('/api/users/1');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('status', true);
      expect(response.body.data).toHaveProperty('id', 1);
      expect(response.body.data).toHaveProperty('name', 'Test User');
    });
    
    it('should return 404 if user not found', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      
      const response = await request(app).get('/api/users/999');
      
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('status', false);
    });
  });
  
  describe('POST /api/users', () => {
    it('should create a new user', async () => {
      const response = await request(app)
        .post('/api/users')
        .send({
          name: 'New User',
          email: 'new@example.com',
          phone: '08123456789',
          password: 'password123',
          role: 'user'
        });
      
      expect(response.status).toBe(201);
      expect(response.body.data).toHaveProperty('id', 1);
      expect(response.body.data).toHaveProperty('name', 'New User');
      expect(response.body.data).not.toHaveProperty('password');
    });
    
    it('should return 400 if email already exists', async () => {
      const response = await request(app)
        .post('/api/users')
        .send({
          name: 'New User',
          email: 'existing@example.com',
          password: 'password123',
          role: 'user'
        });
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('sudah digunakan');
    });
  });
  
  describe('PUT /api/users/:id', () => {
    it('should update a user', async () => {
      const response = await request(app)
        .put('/api/users/1')
        .send({
          name: 'Updated User',
          email: 'updated@example.com'
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('status', true);
      expect(response.body.data).toHaveProperty('name', 'Updated User');
      expect(response.body.data).toHaveProperty('email', 'updated@example.com');
    });
    
    it('should return 400 if email already exists for another user', async () => {
      const response = await request(app)
        .put('/api/users/1')
        .send({
          email: 'existing@example.com'
        });
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('status', false);
    });
  });
  
  describe('DELETE /api/users/:id', () => {
    it('should delete a user', async () => {
      // Override mock untuk test ini
      (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce({
        id: 1,
        name: 'Test User'
      });
      
      (prisma.user.delete as jest.Mock).mockResolvedValueOnce({
        id: 1,
        name: 'Test User'
      });
      
      const response = await request(app).delete('/api/users/1');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('status', true);
      expect(response.body.message).toContain('berhasil dihapus');
    });
    
    it('should return 404 if user not found', async () => {
      const response = await request(app).delete('/api/users/999');
      
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('status', false);
    });
  });
}); 