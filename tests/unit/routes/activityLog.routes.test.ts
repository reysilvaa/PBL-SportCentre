import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import express, { Request, Response, NextFunction } from 'express';
import activityLogRoutes from '../../../src/routes/route-lists/activityLog.routes';
import * as ActivityLogController from '../../../src/controllers/activityLog.controller';

// Mock the controllers
jest.mock('../../../src/controllers/activityLog.controller', () => ({
  getActivityLogs: jest.fn((_req: Request, res: Response) => res.json({ status: true, logs: [] })),
  createActivityLog: jest.fn((_req: Request, res: Response) => res.json({ status: true, message: 'Activity log created' })),
  deleteActivityLog: jest.fn((_req: Request, res: Response) => res.json({ status: true, message: 'Activity log deleted' })),
}));

// Mock the middlewares
jest.mock('../../../src/middlewares/auth.middleware', () => ({
  auth: jest.fn(() => (req: Request, res: Response, next: NextFunction) => {
    req.user = { id: 1, role: 'super_admin' } as any;
    next();
  }),
}));

jest.mock('../../../src/utils/cache.utils', () => ({
  cacheMiddleware: jest.fn((_key: string, _ttl: number) => (req: Request, res: Response, next: NextFunction) => next()),
}));

describe('Activity Log Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    
    // Create a new Express app and use the activity log routes
    app = express();
    app.use(express.json());
    app.use('/activity-logs', activityLogRoutes);
  });

  describe('GET /', () => {
    it('should call getActivityLogs controller', async () => {
      // Act
      const response = await request(app).get('/activity-logs');
      
      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: true, logs: [] });
      // We're not checking middleware calls since they're internal to the route definition
      expect(ActivityLogController.getActivityLogs).toHaveBeenCalled();
    });
  });

  describe('POST /', () => {
    it('should call createActivityLog controller', async () => {
      // Arrange
      const logData = { 
        userId: 1,
        action: 'TEST_ACTION',
        details: 'Test activity log',
        ipAddress: '127.0.0.1'
      };
      
      // Act
      const response = await request(app)
        .post('/activity-logs')
        .send(logData);
      
      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: true, message: 'Activity log created' });
      // We're not checking middleware calls since they're internal to the route definition
      expect(ActivityLogController.createActivityLog).toHaveBeenCalled();
    });
  });

  describe('DELETE /:id', () => {
    it('should call deleteActivityLog controller', async () => {
      // Act
      const response = await request(app).delete('/activity-logs/1');
      
      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: true, message: 'Activity log deleted' });
      // We're not checking middleware calls since they're internal to the route definition
      expect(ActivityLogController.deleteActivityLog).toHaveBeenCalled();
    });
  });
}); 