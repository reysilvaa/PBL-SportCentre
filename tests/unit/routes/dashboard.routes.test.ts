import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import express, { Request, Response, NextFunction } from 'express';
import dashboardRoutes from '../../../src/routes/route-lists/dashboard.routes';
import * as StatisticsController from '../../../src/controllers/dashboard/statistics.controller';

// Mock the controllers
jest.mock('../../../src/controllers/dashboard/statistics.controller', () => ({
  getDashboardStats: jest.fn((req: Request, res: Response) => res.json({ status: true, stats: {} })),
}));

// Mock the middlewares
jest.mock('../../../src/middlewares/auth.middleware', () => ({
  auth: jest.fn(() => (req: Request, res: Response, next: NextFunction) => {
    req.user = { id: 1, role: 'super_admin' } as any;
    next();
  }),
}));

describe('Dashboard Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    
    // Create a new Express app and use the dashboard routes
    app = express();
    app.use(express.json());
    app.use('/dashboard', dashboardRoutes);
  });

  describe('GET /stats', () => {
    it('should call getDashboardStats controller', async () => {
      // Act
      const response = await request(app).get('/dashboard/stats');
      
      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: true, stats: {} });
      expect(StatisticsController.getDashboardStats).toHaveBeenCalled();
    });

    it('should pass period parameter to controller', async () => {
      // Act
      await request(app).get('/dashboard/stats?period=daily');
      
      // Assert
      expect(StatisticsController.getDashboardStats).toHaveBeenCalled();
      const mockCall = (StatisticsController.getDashboardStats as jest.Mock).mock.calls[0][0] as Request;
      expect(mockCall.query).toEqual({ period: 'daily' });
    });

    it('should work with different period values', async () => {
      // Act
      await request(app).get('/dashboard/stats?period=monthly');
      
      // Assert
      expect(StatisticsController.getDashboardStats).toHaveBeenCalled();
      const mockCall = (StatisticsController.getDashboardStats as jest.Mock).mock.calls[0][0] as Request;
      expect(mockCall.query).toEqual({ period: 'monthly' });
    });

    it('should work with yearly period', async () => {
      // Act
      await request(app).get('/dashboard/stats?period=yearly');
      
      // Assert
      expect(StatisticsController.getDashboardStats).toHaveBeenCalled();
      const mockCall = (StatisticsController.getDashboardStats as jest.Mock).mock.calls[0][0] as Request;
      expect(mockCall.query).toEqual({ period: 'yearly' });
    });
  });
}); 