// @ts-nocheck
import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';

// Define redisClient mock before importing other modules
const redisClient = {
  scan: jest.fn().mockImplementation(() => ({
    cursor: 0,
    keys: ['test-key-1', 'test-key-2']
  })),
};

// Mock the NAMESPACE object before importing any files that use it
jest.mock('../../../src/config/services/redis', () => ({
  __esModule: true,
  NAMESPACE: {
    PREFIX: 'sportcenter',
    CLEANUP: 'cleanup-expired-bookings',
    AVAILABILITY: 'field-availability-updates'
  },
  KEYS: {
    TOKEN_BLACKLIST: 'sportcenter:auth:token_blacklist:',
    SOCKET: {
      ROOT: 'sportcenter',
      FIELDS: 'sportcenter/fields',
      NOTIFICATION: 'sportcenter/notification'
    },
    QUEUE: {
      CLEANUP: 'sportcenter:cleanup-expired-bookings',
      AVAILABILITY: 'sportcenter:field-availability-updates'
    },
    CACHE: {
      FIELD: 'sportcenter:fields:',
      BRANCH: 'sportcenter:branches:',
      USER: 'sportcenter:users:',
      BOOKING: 'sportcenter:bookings:',
      PAYMENT: 'sportcenter:payments:'
    }
  },
  ensureConnection: {
    exists: jest.fn(),
    setEx: jest.fn(),
    del: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
    keys: jest.fn()
  },
  default: {
    on: jest.fn(),
    connect: jest.fn().mockResolvedValue(true)
  }
}));

// Mock cache utils before importing other modules
jest.mock('../../../src/utils/cache.utils', () => ({
  __esModule: true,
  default: redisClient,
  getCacheStats: jest.fn().mockResolvedValue({
    used_memory: '1000',
    used_memory_human: '1K',
    used_memory_peak: '2000',
    used_memory_peak_human: '2K',
    connected_clients: '10',
  }),
  cacheMiddleware: jest.fn().mockImplementation(() => (req, res, next) => next()),
  clearCacheMiddleware: jest.fn().mockImplementation(() => (req, res, next) => next()),
  setCacheControlHeaders: jest.fn(),
}));

// Now import router and other modules
import router from '../../../src/routes/index.routes';
import { getCacheStats, cacheMiddleware, clearCacheMiddleware, setCacheControlHeaders } from '../../../src/utils/cache.utils';
import { auth } from '../../../src/middlewares/auth.middleware';

// Mock Bull queue
jest.mock('bull', () => {
  return jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    add: jest.fn(),
    process: jest.fn(),
    getJobCounts: jest.fn().mockResolvedValue({ active: 0, completed: 0, failed: 0, delayed: 0, waiting: 0 }),
    name: 'mockQueue'
  }));
});

jest.mock('../../../src/middlewares/auth.middleware', () => ({
  auth: jest.fn().mockImplementation(() => (req, res, next) => {
    req.user = { id: 1, role: 'super_admin' };
    next();
  }),
  superAdminAuth: jest.fn().mockImplementation(() => (req, res, next) => {
    req.user = { id: 1, role: 'super_admin' };
    next();
  }),
  branchAdminAuth: jest.fn().mockImplementation(() => (req, res, next) => {
    req.user = { id: 1, role: 'admin_cabang' };
    next();
  }),
  ownerAuth: jest.fn().mockImplementation(() => (req, res, next) => {
    req.user = { id: 1, role: 'owner_cabang' };
    next();
  }),
  userAuth: jest.fn().mockImplementation(() => (req, res, next) => {
    req.user = { id: 1, role: 'user' };
    next();
  }),
  withBranch: jest.fn().mockImplementation(() => (req, res, next) => next()),
}));

// Membuat app express untuk supertest
const app = express();
app.use(express.json());
app.use(router);

describe('Index Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /health', () => {
    it('seharusnya mengembalikan status ok', async () => {
      const response = await request(app).get('/health');
      
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        status: 'ok',
        message: 'Service is running'
      });
    });
  });

  describe('GET /cache-stats', () => {
    it('seharusnya mengembalikan statistik cache tanpa pattern', async () => {
      const response = await request(app).get('/cache-stats');
      
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        stats: {
          used_memory: '1000',
          used_memory_human: '1K',
          used_memory_peak: '2000',
          used_memory_peak_human: '2K',
          connected_clients: '10',
        },
        keys: undefined,
        keysCount: undefined,
      });
      
      expect(getCacheStats).toHaveBeenCalled();
      expect(redisClient.scan).not.toHaveBeenCalled();
    });

    it('seharusnya mengembalikan keys ketika pattern diberikan', async () => {
      const response = await request(app).get('/cache-stats?pattern=test');
      
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        stats: expect.any(Object),
        keys: ['test-key-1', 'test-key-2'],
        keysCount: 2,
      });
      
      expect(getCacheStats).toHaveBeenCalled();
      expect(redisClient.scan).toHaveBeenCalledWith(0, {
        MATCH: '*test*',
        COUNT: 100,
      });
    });

    it('seharusnya menangani error pada cache stats', async () => {
      // Setup
      getCacheStats.mockRejectedValueOnce(new Error('Redis connection error'));
      
      const response = await request(app).get('/cache-stats');
      
      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        error: 'Failed to get cache statistics',
        message: 'Redis connection error',
      });
    });
  });
}); 