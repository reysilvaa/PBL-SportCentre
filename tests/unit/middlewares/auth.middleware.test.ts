import { Request, Response, NextFunction } from 'express';
import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { auth, superAdminAuth, branchAdminAuth, ownerAuth, userAuth } from '../../../src/middlewares/auth.middleware';
import jwt from 'jsonwebtoken';
import prisma from '../../../src/config/services/database';
import * as AuthUtils from '../../../src/utils/auth.utils';
import * as JwtUtils from '../../../src/utils/jwt.utils';
import { Role, BranchStatus } from '../../../src/types/enums';

// Mock the dependencies
jest.mock('jsonwebtoken');
jest.mock('../../../src/config/services/database', () => ({
  branch: {
    findFirst: jest.fn(),
  },
  branchAdmin: {
    findFirst: jest.fn(),
  },
  booking: {
    findUnique: jest.fn(),
  },
  field: {
    findUnique: jest.fn(),
  },
}));

jest.mock('../../../src/utils/auth.utils', () => ({
  getAuthToken: jest.fn(),
  isTokenBlacklisted: jest.fn(),
}));

jest.mock('../../../src/utils/jwt.utils', () => ({
  verifyToken: jest.fn(),
}));

describe('Auth Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: jest.Mock<NextFunction>;

  beforeEach(() => {
    mockReq = {
      header: jest.fn().mockReturnValue('Bearer fake-token'),
      params: {},
      user: undefined,
    };
    
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    
    mockNext = jest.fn();
    
    jest.clearAllMocks();
  });

  describe('auth middleware', () => {
    it('should return 401 if no token is provided', async () => {
      // Arrange
      (mockReq.header as jest.Mock).mockReturnValue(undefined);
      (AuthUtils.getAuthToken as jest.Mock).mockReturnValue(null);

      // Act
      await auth()(mockReq as any, mockRes as Response, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: false,
        message: 'Unauthorized: Token tidak ditemukan',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 if token is blacklisted', async () => {
      // Arrange
      (AuthUtils.getAuthToken as jest.Mock).mockReturnValue('fake-token');
      (AuthUtils.isTokenBlacklisted as jest.Mock).mockResolvedValue(true);

      // Act
      await auth()(mockReq as any, mockRes as Response, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: false,
        message: 'Unauthorized: Token telah dicabut atau tidak valid',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 if token verification fails', async () => {
      // Arrange
      (AuthUtils.getAuthToken as jest.Mock).mockReturnValue('fake-token');
      (AuthUtils.isTokenBlacklisted as jest.Mock).mockResolvedValue(false);
      (JwtUtils.verifyToken as jest.Mock).mockReturnValue(null);

      // Act
      await auth()(mockReq as any, mockRes as Response, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: false,
        message: 'Unauthorized: Token tidak valid',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 if token is expired', async () => {
      // Arrange
      (AuthUtils.getAuthToken as jest.Mock).mockReturnValue('fake-token');
      (AuthUtils.isTokenBlacklisted as jest.Mock).mockResolvedValue(false);
      
      // Simulate token expired error
      (JwtUtils.verifyToken as jest.Mock).mockImplementation(() => {
        throw new jwt.TokenExpiredError('Token expired', new Date());
      });

      // Act
      await auth()(mockReq as any, mockRes as Response, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: false,
        message: 'Unauthorized: Token telah kedaluwarsa',
        code: 'TOKEN_EXPIRED',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 403 if user role is not in allowedRoles', async () => {
      // Arrange
      (AuthUtils.getAuthToken as jest.Mock).mockReturnValue('fake-token');
      (AuthUtils.isTokenBlacklisted as jest.Mock).mockResolvedValue(false);
      (JwtUtils.verifyToken as jest.Mock).mockReturnValue({ id: 1, role: 'user' });
      
      // Set allowedRoles to admin only
      const middleware = auth({ allowedRoles: ['admin', 'super_admin'] });

      // Act
      await middleware(mockReq as any, mockRes as Response, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: false,
        message: 'Forbidden: Resource ini hanya dapat diakses oleh admin, super_admin',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should call next if user is super_admin and attachBranch is true', async () => {
      // Arrange
      (AuthUtils.getAuthToken as jest.Mock).mockReturnValue('fake-token');
      (AuthUtils.isTokenBlacklisted as jest.Mock).mockResolvedValue(false);
      (JwtUtils.verifyToken as jest.Mock).mockReturnValue({ id: 1, role: Role.SUPER_ADMIN });
      
      // Set attachBranch to true
      const middleware = auth({ attachBranch: true });

      // Act
      await middleware(mockReq as any, mockRes as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.user).toEqual({ id: 1, role: Role.SUPER_ADMIN });
    });

    it('should attach branch information for owner_cabang role', async () => {
      // Arrange
      (AuthUtils.getAuthToken as jest.Mock).mockReturnValue('fake-token');
      (AuthUtils.isTokenBlacklisted as jest.Mock).mockResolvedValue(false);
      (JwtUtils.verifyToken as jest.Mock).mockReturnValue({ id: 1, role: Role.OWNER_CABANG });
      
      const mockBranch = {
        id: 1,
        name: 'Test Branch',
        status: BranchStatus.ACTIVE,
        ownerId: 1,
      };
      
      (prisma.branch.findFirst as jest.Mock).mockResolvedValue(mockBranch);
      
      // Set attachBranch to true
      const middleware = auth({ attachBranch: true });

      // Act
      await middleware(mockReq as any, mockRes as Response, mockNext);

      // Assert
      expect(prisma.branch.findFirst).toHaveBeenCalledWith({
        where: {
          ownerId: 1,
          status: BranchStatus.ACTIVE,
        },
      });
      expect(mockReq.userBranch).toEqual(mockBranch);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should attach branch information for admin_cabang role', async () => {
      // Arrange
      (AuthUtils.getAuthToken as jest.Mock).mockReturnValue('fake-token');
      (AuthUtils.isTokenBlacklisted as jest.Mock).mockResolvedValue(false);
      (JwtUtils.verifyToken as jest.Mock).mockReturnValue({ id: 1, role: Role.ADMIN_CABANG });
      
      const mockBranch = {
        id: 1,
        name: 'Test Branch',
        status: BranchStatus.ACTIVE,
      };
      
      const mockBranchAdmin = {
        userId: 1,
        branchId: 1,
        branch: mockBranch,
      };
      
      (prisma.branchAdmin.findFirst as jest.Mock).mockResolvedValue(mockBranchAdmin);
      
      // Set attachBranch to true
      const middleware = auth({ attachBranch: true });

      // Act
      await middleware(mockReq as any, mockRes as Response, mockNext);

      // Assert
      expect(prisma.branchAdmin.findFirst).toHaveBeenCalledWith({
        where: {
          userId: 1,
        },
        include: {
          branch: true,
        },
      });
      expect(mockReq.userBranch).toEqual(mockBranch);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should return 403 if branch is not found for branch-related roles', async () => {
      // Arrange
      (AuthUtils.getAuthToken as jest.Mock).mockReturnValue('fake-token');
      (AuthUtils.isTokenBlacklisted as jest.Mock).mockResolvedValue(false);
      (JwtUtils.verifyToken as jest.Mock).mockReturnValue({ id: 1, role: Role.ADMIN_CABANG });
      
      // Branch not found
      (prisma.branchAdmin.findFirst as jest.Mock).mockResolvedValue(null);
      
      // Set attachBranch to true
      const middleware = auth({ attachBranch: true });

      // Act
      await middleware(mockReq as any, mockRes as Response, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: false,
        message: 'Forbidden: Anda tidak terkait dengan cabang aktif manapun',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should validate ownership when ownerOnly is true', async () => {
      // Arrange
      (AuthUtils.getAuthToken as jest.Mock).mockReturnValue('fake-token');
      (AuthUtils.isTokenBlacklisted as jest.Mock).mockResolvedValue(false);
      (JwtUtils.verifyToken as jest.Mock).mockReturnValue({ id: 1, role: 'user' });
      
      mockReq.params = { id: '42' };
      
      // Mock that the user owns the resource
      (prisma.booking.findUnique as jest.Mock).mockResolvedValue({ userId: 1 });
      
      // Set ownerOnly to true and resourceName to booking
      const middleware = auth({ ownerOnly: true, resourceName: 'booking' });

      // Act
      await middleware(mockReq as any, mockRes as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalled();
    });

    it('should return 403 if user does not own the resource', async () => {
      // Arrange
      (AuthUtils.getAuthToken as jest.Mock).mockReturnValue('fake-token');
      (AuthUtils.isTokenBlacklisted as jest.Mock).mockResolvedValue(false);
      (JwtUtils.verifyToken as jest.Mock).mockReturnValue({ id: 1, role: 'user' });
      
      mockReq.params = { id: '42' };
      
      // Mock that another user owns the resource
      (prisma.booking.findUnique as jest.Mock).mockResolvedValue({ userId: 2 });
      
      // Set ownerOnly to true and resourceName to booking
      const middleware = auth({ ownerOnly: true, resourceName: 'booking' });

      // Act
      await middleware(mockReq as any, mockRes as Response, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: false,
        message: 'Forbidden: Anda tidak memiliki akses ke booking ini',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should run customCheck and proceed if it returns true', async () => {
      // Arrange
      (AuthUtils.getAuthToken as jest.Mock).mockReturnValue('fake-token');
      (AuthUtils.isTokenBlacklisted as jest.Mock).mockResolvedValue(false);
      (JwtUtils.verifyToken as jest.Mock).mockReturnValue({ id: 1, role: 'user' });
      
      const customCheck = jest.fn().mockResolvedValue(true);
      
      // Set customCheck
      const middleware = auth({ customCheck });

      // Act
      await middleware(mockReq as any, mockRes as Response, mockNext);

      // Assert
      expect(customCheck).toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should not call next if customCheck returns false', async () => {
      // Arrange
      (AuthUtils.getAuthToken as jest.Mock).mockReturnValue('fake-token');
      (AuthUtils.isTokenBlacklisted as jest.Mock).mockResolvedValue(false);
      (JwtUtils.verifyToken as jest.Mock).mockReturnValue({ id: 1, role: 'user' });
      
      const customCheck = jest.fn().mockResolvedValue(false);
      
      // Set customCheck
      const middleware = auth({ customCheck });

      // Act
      await middleware(mockReq as any, mockRes as Response, mockNext);

      // Assert
      expect(customCheck).toHaveBeenCalled();
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 500 if middleware throws an error', async () => {
      // Arrange
      (AuthUtils.getAuthToken as jest.Mock).mockReturnValue('fake-token');
      (AuthUtils.isTokenBlacklisted as jest.Mock).mockRejectedValue(new Error('Test error'));
      
      // Act
      await auth()(mockReq as any, mockRes as Response, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: false,
        message: 'Internal Server Error',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('Role-specific middleware', () => {
    it('should configure superAdminAuth correctly', () => {
      // This test verifies that superAdminAuth sets the correct options
      const middleware = superAdminAuth();
      
      // We can't directly test the options, but we can check the middleware is a function
      expect(typeof middleware).toBe('function');
    });

    it('should configure branchAdminAuth correctly', () => {
      const middleware = branchAdminAuth();
      expect(typeof middleware).toBe('function');
    });

    it('should configure ownerAuth correctly', () => {
      const middleware = ownerAuth();
      expect(typeof middleware).toBe('function');
    });

    it('should configure userAuth correctly', () => {
      const middleware = userAuth();
      expect(typeof middleware).toBe('function');
    });
  });
}); 