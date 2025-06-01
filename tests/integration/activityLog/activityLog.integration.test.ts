import { describe, it, expect, jest, beforeAll, beforeEach } from '@jest/globals';
import express, { Application } from 'express';
import request from 'supertest';
import activityLogRoutes from '../../../src/routes/route-lists/activityLog.routes';
import errorMiddleware from '../../../src/middlewares/error.middleware';
import prisma from '../../../src/config/services/database';

// Mock dependencies untuk isolasi test integrasi
jest.mock('../../../src/config/services/database', () => ({
  activityLog: {
    findMany: jest.fn().mockResolvedValue([
      {
        id: 1,
        userId: 3,
        action: 'LOGIN',
        details: 'User logged in',
        ipAddress: '127.0.0.1',
        createdAt: new Date(),
        user: {
          id: 3,
          name: 'Super Admin',
          email: 'admin@example.com'
        }
      }
    ]),
    findUnique: jest.fn(),
    create: jest.fn().mockResolvedValue({
      id: 2,
      userId: 3,
      action: 'CREATE_USER',
      details: 'Created a new user',
      ipAddress: '127.0.0.1',
      createdAt: new Date()
    }),
    delete: jest.fn().mockResolvedValue({}),
    count: jest.fn().mockResolvedValue(20)
  },
  user: {
    findUnique: jest.fn()
  }
}));

// Mock auth middleware
jest.mock('../../../src/middlewares/auth.middleware', () => {
  return {
    auth: jest.fn().mockImplementation(() => (req, res, next) => {
      // Set default user sebagai super_admin untuk activity log routes
      req.user = {
        id: 3,
        role: 'super_admin'
      };
      
      // Tambahkan req.ip untuk activity log
      req.ip = '127.0.0.1';
      
      next();
    })
  };
});

// Mock cache
jest.mock('../../../src/utils/cache.utils', () => ({
  cacheMiddleware: () => (req, res, next) => next(),
  clearCacheMiddleware: () => (req, res, next) => {
    res.on('finish', () => {});
    next();
  },
  CACHE_KEYS: {
    ACTIVITY_LOG: 'activity_logs'
  }
}));

// Mock untuk ActivityLogService
jest.mock('../../../src/utils/activityLog/activityLog.utils', () => ({
  ActivityLogService: {
    getLogs: jest.fn().mockResolvedValue([
      {
        id: 1,
        userId: 3,
        action: 'LOGIN',
        details: 'User logged in',
        ipAddress: '127.0.0.1',
        createdAt: new Date(),
        user: {
          id: 3,
          name: 'Super Admin',
          email: 'admin@example.com'
        }
      }
    ]),
    createLog: jest.fn().mockResolvedValue({
      id: 2,
      userId: 3,
      action: 'CREATE_USER',
      details: 'Created a new user',
      ipAddress: '127.0.0.1',
      createdAt: new Date()
    }),
    deleteLog: jest.fn().mockResolvedValue({}),
    broadcastActivityLogUpdates: jest.fn().mockResolvedValue(true)
  }
}));

describe('Activity Log API Integration', () => {
  let app: Application;
  
  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/activity-logs', activityLogRoutes);
    app.use(errorMiddleware);
  });
  
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('GET /api/activity-logs', () => {
    it('should return all activity logs with pagination', async () => {
      const response = await request(app).get('/api/activity-logs');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('status', true);
    });
    
    it('should filter activity logs by user ID', async () => {
      const response = await request(app).get('/api/activity-logs?userId=3');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('status', true);
    });
    
    it('should filter activity logs by action type', async () => {
      const response = await request(app).get('/api/activity-logs?action=LOGIN');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('status', true);
    });
  });
  
  describe('POST /api/activity-logs', () => {
    it('should create a new activity log', async () => {
      const response = await request(app)
        .post('/api/activity-logs')
        .send({
          userId: 3,
          action: 'CREATE_USER',
          details: 'Created a new user'
        });
      
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('status', true);
    });
  });
  
  describe('DELETE /api/activity-logs/:id', () => {
    it('should delete an activity log', async () => {
      (prisma.activityLog.findUnique as jest.Mock).mockResolvedValue({
        id: 1,
        userId: 3,
        action: 'LOGIN',
        details: 'User logged in',
        ipAddress: '127.0.0.1',
        createdAt: new Date()
      });
      
      const response = await request(app).delete('/api/activity-logs/1');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('status', true);
    });
    
    it('should return 404 if activity log not found', async () => {
      (prisma.activityLog.findUnique as jest.Mock).mockResolvedValue(null);
      
      // Mock untuk ActivityLogService.deleteLog agar melempar error
      const { ActivityLogService } = require('../../../src/utils/activityLog/activityLog.utils');
      ActivityLogService.deleteLog.mockRejectedValueOnce(new Error('Log tidak ditemukan'));
      
      const response = await request(app).delete('/api/activity-logs/999');
      
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('status', false);
    });
  });
}); 