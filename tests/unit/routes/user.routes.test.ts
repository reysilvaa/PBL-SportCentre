// @ts-nocheck
import { jest, describe, it, expect } from '@jest/globals';

// Mock the controller
jest.mock('../../../src/controllers/user.controller', () => ({
  getUsers: jest.fn(),
  getUserById: jest.fn(),
  createUser: jest.fn(),
  updateUser: jest.fn(),
  deleteUser: jest.fn(),
  getUserProfile: jest.fn(),
  updateUserProfile: jest.fn(),
  getUserBranchAdmins: jest.fn(),
  getUserBranches: jest.fn(),
  getAdminProfile: jest.fn(),
}));

// Mock the middleware
jest.mock('../../../src/middlewares/auth.middleware', () => ({
  auth: jest.fn(() => (req, res, next) => next()),
}));

// Mock cache middleware
jest.mock('../../../src/utils/cache.utils', () => ({
  cacheMiddleware: jest.fn(() => (req, res, next) => next()),
}));

// Import after mocks
import userRoutes from '../../../src/routes/route-lists/user.routes';

describe('User Routes', () => {
  it('should export a router', () => {
    expect(userRoutes).toBeDefined();
  });
}); 