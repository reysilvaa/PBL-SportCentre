// @ts-nocheck
import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import express from 'express';
import request from 'supertest';

// Mock all route files
jest.mock('../../../src/routes/route-lists/user.routes', () => {
  const router = express.Router();
  router.get('/test', (req, res) => res.json({ route: 'users' }));
  return { __esModule: true, default: router };
});

jest.mock('../../../src/routes/route-lists/branch.routes', () => {
  const router = express.Router();
  router.get('/test', (req, res) => res.json({ route: 'branches' }));
  return { __esModule: true, default: router };
});

jest.mock('../../../src/routes/route-lists/field.routes', () => {
  const router = express.Router();
  router.get('/test', (req, res) => res.json({ route: 'fields' }));
  return { __esModule: true, default: router };
});

jest.mock('../../../src/routes/route-lists/booking.routes', () => {
  const router = express.Router();
  router.get('/test', (req, res) => res.json({ route: 'bookings' }));
  return { __esModule: true, default: router };
});

jest.mock('../../../src/routes/route-lists/fieldTypes.routes', () => {
  const router = express.Router();
  router.get('/test', (req, res) => res.json({ route: 'field-types' }));
  return { __esModule: true, default: router };
});

jest.mock('../../../src/routes/route-lists/activityLog.routes', () => {
  const router = express.Router();
  router.get('/test', (req, res) => res.json({ route: 'activity-logs' }));
  return { __esModule: true, default: router };
});

jest.mock('../../../src/routes/route-lists/fieldReview.routes', () => {
  const router = express.Router();
  router.get('/test', (req, res) => res.json({ route: 'field-reviews' }));
  return { __esModule: true, default: router };
});

jest.mock('../../../src/routes/route-lists/promotion.routes', () => {
  const router = express.Router();
  router.get('/test', (req, res) => res.json({ route: 'promotions' }));
  return { __esModule: true, default: router };
});

jest.mock('../../../src/routes/route-lists/promotionUsage.routes', () => {
  const router = express.Router();
  router.get('/test', (req, res) => res.json({ route: 'promotion-usages' }));
  return { __esModule: true, default: router };
});

jest.mock('../../../src/routes/route-lists/auth.routes', () => {
  const router = express.Router();
  router.get('/test', (req, res) => res.json({ route: 'auth' }));
  return { __esModule: true, default: router };
});

jest.mock('../../../src/routes/route-lists/webhook.routes', () => {
  const router = express.Router();
  router.get('/test', (req, res) => res.json({ route: 'webhooks' }));
  return { __esModule: true, default: router };
});

jest.mock('../../../src/routes/route-lists/notification.routes', () => {
  const router = express.Router();
  router.get('/test', (req, res) => res.json({ route: 'notifications' }));
  return { __esModule: true, default: router };
});

jest.mock('../../../src/routes/route-lists/dashboard.routes', () => {
  const router = express.Router();
  router.get('/test', (req, res) => res.json({ route: 'dashboard' }));
  return { __esModule: true, default: router };
});

// Mock auth middleware
jest.mock('../../../src/middlewares/auth.middleware', () => ({
  auth: jest.fn().mockImplementation(() => (req, res, next) => {
    // Mock authentication
    req.user = { id: 1, role: 'super_admin' };
    next();
  }),
}));

// Mock cache utils
jest.mock('../../../src/utils/cache.utils', () => {
  const mockClient = {
    scan: jest.fn().mockImplementation((cursor, options) => {
      if (cursor === 0) {
        return Promise.resolve({
          cursor: 0,
          keys: ['key1', 'key2', 'key3'],
        });
      }
      return Promise.resolve({ cursor: 0, keys: [] });
    }),
  };

  return {
    __esModule: true,
    default: mockClient,
    getCacheStats: jest.fn().mockResolvedValue({
      memory: { used: '10MB', total: '100MB', percentage: '10%' },
      keys: 100,
      clients: 5,
      uptime: 3600,
    }),
  };
});

// Import the router after mocking all dependencies
import router from '../../../src/routes/index.routes';

describe('API Routes', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api', router);
  });

  it('should setup all route endpoints correctly', async () => {
    // Test that router sets up all routes correctly by checking a few
    const routes = [
      '/api/users/test',
      '/api/branches/test',
      '/api/fields/test',
      '/api/bookings/test',
      '/api/field-types/test',
      '/api/activity-logs/test',
      '/api/field-reviews/test',
      '/api/promotions/test',
      '/api/promotion-usages/test',
      '/api/auth/test',
      '/api/webhooks/test',
      '/api/notifications/test',
      '/api/dashboard/test',
    ];

    for (const route of routes) {
      const response = await request(app).get(route);
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('route');
    }
  });

  describe('Health Check Endpoint', () => {
    it('should return a 200 status for health check', async () => {
      const response = await request(app).get('/api/health');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        status: 'ok',
        message: 'Service is running',
      });
    });
  });

  describe('Cache Stats Endpoint', () => {
    it('should return cache statistics for authenticated admin users', async () => {
      const response = await request(app).get('/api/cache-stats');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('stats');
      expect(response.body.stats).toHaveProperty('memory');
      expect(response.body.stats).toHaveProperty('keys');
      expect(response.body.stats).toHaveProperty('uptime');
    });

    it('should return matching keys when pattern is provided', async () => {
      const response = await request(app).get('/api/cache-stats?pattern=test');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('keys');
      expect(Array.isArray(response.body.keys)).toBe(true);
      expect(response.body.keysCount).toBe(3);
    });

    it('should handle errors gracefully', async () => {
      // Mock getCacheStats to throw an error
      const { getCacheStats } = require('../../../src/utils/cache.utils');
      getCacheStats.mockRejectedValueOnce(new Error('Redis connection error'));

      const response = await request(app).get('/api/cache-stats');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Failed to get cache statistics');
    });
  });
}); 