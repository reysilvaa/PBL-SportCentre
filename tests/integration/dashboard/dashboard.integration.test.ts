import { describe, it, expect, jest, beforeAll, beforeEach } from '@jest/globals';
import express, { Application } from 'express';
import request from 'supertest';
import dashboardRoutes from '../../../src/routes/route-lists/dashboard.routes';
import errorMiddleware from '../../../src/middlewares/error.middleware';

// Mock dependencies
jest.mock('../../../src/config/services/database', () => ({
  booking: {
    count: jest.fn().mockResolvedValue(50),
    groupBy: jest.fn().mockResolvedValue([
      { _count: { id: 10 }, bookingDate: new Date('2023-08-01') },
      { _count: { id: 15 }, bookingDate: new Date('2023-08-02') },
      { _count: { id: 25 }, bookingDate: new Date('2023-08-03') }
    ])
  },
  payment: {
    aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 5000000 } }),
    groupBy: jest.fn().mockResolvedValue([
      { _sum: { amount: 1000000 }, status: 'paid', createdAt: new Date('2023-08-01') },
      { _sum: { amount: 1500000 }, status: 'paid', createdAt: new Date('2023-08-02') },
      { _sum: { amount: 2500000 }, status: 'paid', createdAt: new Date('2023-08-03') }
    ])
  },
  user: {
    count: jest.fn().mockResolvedValue(100)
  },
  field: {
    count: jest.fn().mockResolvedValue(20)
  },
  branch: {
    count: jest.fn().mockResolvedValue(5)
  }
}));

// Mock services
jest.mock('../../../src/repositories/statistics/unifiedStats.service', () => ({
  getBookingStatsByPeriod: jest.fn().mockResolvedValue({
    totalBookings: 50,
    bookingTrend: [
      { date: '2023-08-01', count: 10 },
      { date: '2023-08-02', count: 15 },
      { date: '2023-08-03', count: 25 }
    ]
  })
}));

jest.mock('../../../src/repositories/revenue/revenueReports.service', () => ({
  getRevenueStatsByPeriod: jest.fn().mockResolvedValue({
    totalRevenue: 5000000,
    revenueTrend: [
      { date: '2023-08-01', amount: 1000000 },
      { date: '2023-08-02', amount: 1500000 },
      { date: '2023-08-03', amount: 2500000 }
    ]
  })
}));

// Mock auth middleware
jest.mock('../../../src/middlewares/auth.middleware', () => {
  return {
    auth: jest.fn().mockImplementation(() => (req, res, next) => {
      // Set default user sebagai super_admin untuk dashboard routes
      req.user = {
        id: 3,
        role: 'super_admin'
      };
      
      // Tambahkan req.userBranch untuk admin_cabang dan owner_cabang
      if (req.user.role === 'admin_cabang' || req.user.role === 'owner_cabang') {
        req.userBranch = {
          id: 1,
          name: 'Test Branch'
        };
      }
      
      next();
    })
  };
});

describe('Dashboard API Integration', () => {
  let app: Application;
  
  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/dashboard', dashboardRoutes);
    app.use(errorMiddleware);
  });
  
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('GET /api/dashboard/stats', () => {
    it('should return dashboard statistics for super admin', async () => {
      const response = await request(app).get('/api/dashboard/stats');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', true);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('data');
      
      // Verify data structure
      expect(response.body.data).toHaveProperty('bookingStats');
      expect(response.body.data).toHaveProperty('revenueStats');
      expect(response.body.data).toHaveProperty('userCount');
      expect(response.body.data).toHaveProperty('fieldCount');
      expect(response.body.data).toHaveProperty('branchCount');
      
      // Verify data values
      expect(response.body.data.bookingStats.totalBookings).toBe(50);
      expect(response.body.data.revenueStats.totalRevenue).toBe(5000000);
      expect(response.body.data.userCount).toBe(100);
      expect(response.body.data.fieldCount).toBe(20);
      expect(response.body.data.branchCount).toBe(5);
    });
    
    it('should return dashboard statistics with daily period', async () => {
      const response = await request(app).get('/api/dashboard/stats?period=daily');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('bookingStats');
      expect(response.body.data).toHaveProperty('revenueStats');
      
      // Verify repositories were called with correct period
      const { getBookingStatsByPeriod } = require('../../../src/repositories/statistics/unifiedStats.service');
      const { getRevenueStatsByPeriod } = require('../../../src/repositories/revenue/revenueReports.service');
      
      expect(getBookingStatsByPeriod).toHaveBeenCalledWith(expect.objectContaining({ period: 'daily' }));
      expect(getRevenueStatsByPeriod).toHaveBeenCalledWith(expect.objectContaining({ period: 'daily' }));
    });
    
    it('should return dashboard statistics with monthly period', async () => {
      const response = await request(app).get('/api/dashboard/stats?period=monthly');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      
      // Verify repositories were called with correct period
      const { getBookingStatsByPeriod } = require('../../../src/repositories/statistics/unifiedStats.service');
      const { getRevenueStatsByPeriod } = require('../../../src/repositories/revenue/revenueReports.service');
      
      expect(getBookingStatsByPeriod).toHaveBeenCalledWith(expect.objectContaining({ period: 'monthly' }));
      expect(getRevenueStatsByPeriod).toHaveBeenCalledWith(expect.objectContaining({ period: 'monthly' }));
    });
    
    it('should return dashboard statistics with yearly period', async () => {
      const response = await request(app).get('/api/dashboard/stats?period=yearly');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      
      // Verify repositories were called with correct period
      const { getBookingStatsByPeriod } = require('../../../src/repositories/statistics/unifiedStats.service');
      const { getRevenueStatsByPeriod } = require('../../../src/repositories/revenue/revenueReports.service');
      
      expect(getBookingStatsByPeriod).toHaveBeenCalledWith(expect.objectContaining({ period: 'yearly' }));
      expect(getRevenueStatsByPeriod).toHaveBeenCalledWith(expect.objectContaining({ period: 'yearly' }));
    });
    
    it('should handle branch admin role', async () => {
      // Override auth mock for this test
      const { auth } = require('../../../src/middlewares/auth.middleware');
      auth.mockImplementationOnce(() => (req, res, next) => {
        req.user = {
          id: 2,
          role: 'admin_cabang'
        };
        req.userBranch = {
          id: 1,
          name: 'Test Branch'
        };
        next();
      });
      
      const response = await request(app).get('/api/dashboard/stats');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      
      // Verify repositories were called with branch filter
      const { getBookingStatsByPeriod } = require('../../../src/repositories/statistics/unifiedStats.service');
      const { getRevenueStatsByPeriod } = require('../../../src/repositories/revenue/revenueReports.service');
      
      expect(getBookingStatsByPeriod).toHaveBeenCalledWith(expect.objectContaining({ branchId: 1 }));
      expect(getRevenueStatsByPeriod).toHaveBeenCalledWith(expect.objectContaining({ branchId: 1 }));
    });
  });
}); 