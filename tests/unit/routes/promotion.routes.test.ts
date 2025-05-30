// @ts-nocheck
import { jest, describe, it, expect } from '@jest/globals';

// Mock the controller
jest.mock('../../../src/controllers/promotion.controller', () => ({
  getPromotions: jest.fn(),
  getPromotionById: jest.fn(),
  createPromotion: jest.fn(),
  updatePromotion: jest.fn(),
  deletePromotion: jest.fn(),
}));

// Mock the middleware
jest.mock('../../../src/middlewares/auth.middleware', () => ({
  auth: jest.fn(() => (req, res, next) => next()),
}));

// Import after mocks
import promotionRoutes from '../../../src/routes/route-lists/promotion.routes';

describe('Promotion Routes', () => {
  it('should export a router', () => {
    expect(promotionRoutes).toBeDefined();
  });
}); 