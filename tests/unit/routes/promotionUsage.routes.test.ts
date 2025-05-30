// @ts-nocheck
import { jest, describe, it, expect } from '@jest/globals';

// Mock the controller
jest.mock('../../../src/controllers/promotionUsage.controller', () => ({
  getPromotionUsages: jest.fn(),
  createPromotionUsage: jest.fn(),
  deletePromotionUsage: jest.fn(),
}));

// Mock the middleware
jest.mock('../../../src/middlewares/auth.middleware', () => ({
  auth: jest.fn(() => (req, res, next) => next()),
}));

// Import after mocks
import promotionUsageRoutes from '../../../src/routes/route-lists/promotionUsage.routes';

describe('Promotion Usage Routes', () => {
  it('should export a router', () => {
    expect(promotionUsageRoutes).toBeDefined();
  });
}); 