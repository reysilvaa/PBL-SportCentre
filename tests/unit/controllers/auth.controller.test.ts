import { Request, Response } from 'express';
import { jest } from '@jest/globals';
import * as AuthController from '../../../src/controllers/auth.controller';
import prisma from '../../../src/config/services/database';
import * as AuthUtils from '../../../src/utils/auth.utils';
import * as PasswordUtils from '../../../src/utils/password.utils';
import * as JwtUtils from '../../../src/utils/jwt.utils';
import jwt from 'jsonwebtoken';

// Mock dependencies
jest.mock('jsonwebtoken', () => ({
  sign: jest.fn().mockReturnValue('mocked-token'),
  verify: jest.fn().mockReturnValue({ id: 1, email: 'test@example.com', role: 'user' }),
}));

jest.mock('../../../src/config/services/database', () => ({
  user: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
  },
  branchAdmin: {
    findMany: jest.fn(),
  },
}));

jest.mock('../../../src/utils/auth.utils', () => ({
  blacklistToken: jest.fn(),
  setAuthCookie: jest.fn(),
  setRefreshTokenCookie: jest.fn(),
  clearAuthCookie: jest.fn(),
  clearRefreshTokenCookie: jest.fn(),
  getAuthToken: jest.fn(),
  isTokenBlacklisted: jest.fn(),
  setCookie: jest.fn(),
  getCookie: jest.fn(),
  clearCookie: jest.fn(),
  hasCookie: jest.fn(),
  hasAuthCookie: jest.fn(),
  getRefreshToken: jest.fn(),
  removeFromBlacklist: jest.fn(),
}));

jest.mock('../../../src/utils/password.utils', () => ({
  hashPassword: jest.fn().mockResolvedValue('hashed-password'),
  verifyPassword: jest.fn(),
}));

jest.mock('../../../src/utils/jwt.utils', () => ({
  verifyToken: jest.fn(),
  generateToken: jest.fn().mockReturnValue('mocked-token'),
  generateRefreshToken: jest.fn().mockReturnValue('mocked-refresh-token'),
  verifyRefreshToken: jest.fn(),
}));

describe('Auth Controller', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  
  beforeEach(() => {
    mockReq = {
      body: {},
      header: jest.fn().mockReturnValue(undefined),
      signedCookies: {},
    };
    
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      cookie: jest.fn(),
      clearCookie: jest.fn(),
    } as unknown as Response;

    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      // Arrange
      const userData = {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
        role: 'user',
        phone: '08123456789',
      };
      
      mockReq.body = userData;
      
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.user.create as jest.Mock).mockResolvedValue({
        id: 1,
        ...userData,
        password: 'hashed-password',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Act
      await AuthController.register(mockReq as Request, mockRes as Response);

      // Assert
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: userData.email },
      });
      expect(PasswordUtils.hashPassword).toHaveBeenCalledWith(userData.password);
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          email: userData.email,
          password: 'hashed-password',
          name: userData.name,
          role: userData.role,
          phone: userData.phone,
        },
      });
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          user: expect.objectContaining({
            id: 1,
            email: userData.email,
            name: userData.name,
            role: userData.role,
          }),
        })
      );
    });

    it('should return 409 if email already exists', async () => {
      // Arrange
      const userData = {
        email: 'existing@example.com',
        password: 'password123',
        name: 'Existing User',
        role: 'user',
        phone: '08123456789',
      };
      
      mockReq.body = userData;
      
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 1,
        email: userData.email,
      });

      // Act
      await AuthController.register(mockReq as Request, mockRes as Response);

      // Assert
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: userData.email },
      });
      expect(prisma.user.create).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(409);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Email sudah terdaftar',
      });
    });

    it('should return 400 for validation errors', async () => {
      // Arrange
      mockReq.body = { email: 'invalid-email' }; // Missing required fields

      // Act
      await AuthController.register(mockReq as Request, mockRes as Response);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Validasi gagal',
        })
      );
    });
  });

  describe('login', () => {
    const validCredentials = {
      email: 'user@example.com',
      password: 'password123',
    };

    const mockUser = {
      id: 1,
      email: 'user@example.com',
      password: 'hashed-password',
      name: 'Test User',
      role: 'user',
      phone: '08123456789',
    };

    it('should login user successfully with email', async () => {
      // Arrange
      mockReq.body = validCredentials;
      
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (PasswordUtils.verifyPassword as jest.Mock).mockResolvedValue(true);

      // Act
      await AuthController.login(mockReq as Request, mockRes as Response);

      // Assert
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: validCredentials.email },
      });
      expect(PasswordUtils.verifyPassword).toHaveBeenCalledWith(
        validCredentials.password,
        mockUser.password
      );
      expect(jwt.sign).toHaveBeenCalledTimes(2);
      expect(AuthUtils.setAuthCookie).toHaveBeenCalled();
      expect(AuthUtils.setRefreshTokenCookie).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          token: 'mocked-token',
          user: expect.objectContaining({
            id: mockUser.id,
            email: mockUser.email,
            name: mockUser.name,
            role: mockUser.role,
          }),
        })
      );
    });

    it('should login user successfully with phone number', async () => {
      // Arrange
      const phoneCredentials = {
        email: '08123456789', // Nomor telepon dikirimkan sebagai email
        password: 'password123',
      };
      
      mockReq.body = phoneCredentials;
      
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(mockUser);
      (PasswordUtils.verifyPassword as jest.Mock).mockResolvedValue(true);

      // Act
      await AuthController.login(mockReq as Request, mockRes as Response);

      // Assert
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: phoneCredentials.email },
      });
      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: { phone: phoneCredentials.email },
      });
      expect(PasswordUtils.verifyPassword).toHaveBeenCalledWith(
        phoneCredentials.password,
        mockUser.password
      );
      expect(AuthUtils.setAuthCookie).toHaveBeenCalled();
      expect(AuthUtils.setRefreshTokenCookie).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalled();
    });

    it('should return 401 if user not found', async () => {
      // Arrange
      mockReq.body = validCredentials;
      
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);

      // Act
      await AuthController.login(mockReq as Request, mockRes as Response);

      // Assert
      expect(prisma.user.findUnique).toHaveBeenCalled();
      expect(prisma.user.findFirst).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Kredensial tidak valid',
      });
    });

    it('should return 401 if password is invalid', async () => {
      // Arrange
      mockReq.body = validCredentials;
      
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (PasswordUtils.verifyPassword as jest.Mock).mockResolvedValue(false);

      // Act
      await AuthController.login(mockReq as Request, mockRes as Response);

      // Assert
      expect(prisma.user.findUnique).toHaveBeenCalled();
      expect(PasswordUtils.verifyPassword).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Kredensial tidak valid',
      });
    });

    it('should return 400 for validation errors', async () => {
      // Arrange
      mockReq.body = { email: 'invalid-email' }; // Missing password

      // Act
      await AuthController.login(mockReq as Request, mockRes as Response);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Validasi gagal',
        })
      );
    });
  });

  describe('logout', () => {
    it('should logout user successfully with token from cookie', async () => {
      // Arrange
      mockReq.signedCookies = { 
        'auth_token': 'token-from-cookie', 
        'refresh_token': 'refresh-token-from-cookie' 
      };
      
      (JwtUtils.verifyToken as jest.Mock).mockReturnValue({ 
        exp: Math.floor(Date.now() / 1000) + 3600 // Expire in 1 hour
      });

      // Act
      await AuthController.logout(mockReq as Request, mockRes as Response);

      // Assert
      expect(AuthUtils.blacklistToken).toHaveBeenCalledTimes(2);
      expect(AuthUtils.clearAuthCookie).toHaveBeenCalled();
      expect(AuthUtils.clearRefreshTokenCookie).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Logout berhasil',
      });
    });

    it('should logout user successfully with token from header', async () => {
      // Arrange
      mockReq.header = jest.fn().mockReturnValue('Bearer token-from-header');
      
      (JwtUtils.verifyToken as jest.Mock).mockReturnValue({ 
        exp: Math.floor(Date.now() / 1000) + 3600 // Expire in 1 hour
      });

      // Act
      await AuthController.logout(mockReq as Request, mockRes as Response);

      // Assert
      expect(AuthUtils.blacklistToken).toHaveBeenCalled();
      expect(AuthUtils.clearAuthCookie).toHaveBeenCalled();
      expect(AuthUtils.clearRefreshTokenCookie).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Logout berhasil',
      });
    });

    it('should handle logout without tokens', async () => {
      // Act
      await AuthController.logout(mockReq as Request, mockRes as Response);

      // Assert
      expect(AuthUtils.blacklistToken).not.toHaveBeenCalled();
      expect(AuthUtils.clearAuthCookie).toHaveBeenCalled();
      expect(AuthUtils.clearRefreshTokenCookie).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Logout berhasil',
      });
    });
  });

  describe('refreshToken', () => {
    it('should refresh token successfully', async () => {
      // Arrange
      mockReq.signedCookies = { 'refresh_token': 'valid-refresh-token' };
      
      (AuthUtils.isTokenBlacklisted as jest.Mock).mockResolvedValue(false);
      (JwtUtils.verifyToken as jest.Mock).mockReturnValue({ id: 1 });
      
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 1,
        email: 'user@example.com',
        role: 'user',
        name: 'Test User',
      });

      // Act
      await AuthController.refreshToken(mockReq as Request, mockRes as Response);

      // Assert
      expect(AuthUtils.isTokenBlacklisted).toHaveBeenCalledWith('valid-refresh-token');
      expect(JwtUtils.verifyToken).toHaveBeenCalledWith('valid-refresh-token');
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
      });
      expect(jwt.sign).toHaveBeenCalledTimes(2); // Access token and refresh token
      expect(AuthUtils.setAuthCookie).toHaveBeenCalled();
      expect(AuthUtils.setRefreshTokenCookie).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          token: 'mocked-token',
        })
      );
    });

    it('should return 401 if refresh token is missing', async () => {
      // Arrange
      mockReq.signedCookies = {};

      // Act
      await AuthController.refreshToken(mockReq as Request, mockRes as Response);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Refresh token tidak ditemukan',
      });
    });

    it('should return 401 if refresh token is blacklisted', async () => {
      // Arrange
      mockReq.signedCookies = { 'refresh_token': 'blacklisted-token' };
      
      (AuthUtils.isTokenBlacklisted as jest.Mock).mockResolvedValue(true);

      // Act
      await AuthController.refreshToken(mockReq as Request, mockRes as Response);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(AuthUtils.clearAuthCookie).toHaveBeenCalled();
      expect(AuthUtils.clearRefreshTokenCookie).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Refresh token telah dicabut atau tidak valid',
      });
    });

    it('should return 401 if user not found', async () => {
      // Arrange
      mockReq.signedCookies = { 'refresh_token': 'valid-token' };
      
      (AuthUtils.isTokenBlacklisted as jest.Mock).mockResolvedValue(false);
      (JwtUtils.verifyToken as jest.Mock).mockReturnValue({ id: 999 }); // ID pengguna tidak ditemukan
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      // Act
      await AuthController.refreshToken(mockReq as Request, mockRes as Response);

      // Assert
      expect(JwtUtils.verifyToken).toHaveBeenCalled();
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 999 },
      });
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'User tidak ditemukan',
      });
    });
  });

  describe('getAuthStatus', () => {
    it('should return user status when authenticated with valid token from cookie', async () => {
      // Arrange
      mockReq.signedCookies = { 'auth_token': 'valid-token' };
      (AuthUtils.getAuthToken as jest.Mock).mockReturnValue('valid-token');
      (AuthUtils.isTokenBlacklisted as jest.Mock).mockResolvedValue(false);
      
      const mockUser = {
        id: 1,
        email: 'user@example.com',
        name: 'Test User',
        role: 'user',
        password: 'hashed-password',
      };
      
      (JwtUtils.verifyToken as jest.Mock).mockReturnValue({
        id: 1,
        email: 'user@example.com',
        role: 'user'
      });
      
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      // Act
      await AuthController.getAuthStatus(mockReq as Request, mockRes as Response);

      // Assert
      expect(JwtUtils.verifyToken).toHaveBeenCalledWith('valid-token');
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
      });
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          user: expect.objectContaining({
            id: 1,
            email: 'user@example.com',
            name: 'Test User',
            role: 'user',
          }),
          token: 'valid-token',
        })
      );
    });

    it('should return user status with branch data for admin_cabang role', async () => {
      // Arrange
      mockReq.header = jest.fn().mockReturnValue('Bearer valid-token');
      (AuthUtils.getAuthToken as jest.Mock).mockReturnValue(null);
      (AuthUtils.isTokenBlacklisted as jest.Mock).mockResolvedValue(false);
      
      const mockUser = {
        id: 1,
        email: 'admin@example.com',
        name: 'Admin User',
        role: 'admin_cabang',
        password: 'hashed-password',
      };
      
      const mockBranchAdmins = [
        {
          userId: 1,
          branchId: 101,
          branch: {
            id: 101,
            name: 'Branch 1',
          }
        }
      ];
      
      (JwtUtils.verifyToken as jest.Mock).mockReturnValue({
        id: 1,
        email: 'admin@example.com',
        role: 'admin_cabang'
      });
      
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.branchAdmin.findMany as jest.Mock).mockResolvedValue(mockBranchAdmins);

      // Act
      await AuthController.getAuthStatus(mockReq as Request, mockRes as Response);

      // Assert
      expect(JwtUtils.verifyToken).toHaveBeenCalledWith('valid-token');
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
      });
      expect(prisma.branchAdmin.findMany).toHaveBeenCalledWith({
        where: { userId: 1 },
        include: { branch: true }
      });
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          user: expect.objectContaining({
            id: 1,
            email: 'admin@example.com',
            name: 'Admin User',
            role: 'admin_cabang',
            branches: expect.arrayContaining([
              expect.objectContaining({
                userId: 1,
                branchId: 101,
                branch: expect.objectContaining({
                  id: 101,
                  name: 'Branch 1'
                })
              })
            ])
          }),
        })
      );
    });

    it('should return 401 if token is not found', async () => {
      // Arrange
      (AuthUtils.getAuthToken as jest.Mock).mockReturnValue(null);
      mockReq.header = jest.fn().mockReturnValue(null);

      // Act
      await AuthController.getAuthStatus(mockReq as Request, mockRes as Response);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: false,
        message: 'Tidak terautentikasi',
        authenticated: false,
      });
    });

    it('should return 401 if token is blacklisted', async () => {
      // Arrange
      mockReq.header = jest.fn().mockReturnValue('Bearer blacklisted-token');
      (AuthUtils.getAuthToken as jest.Mock).mockReturnValue(null);
      (AuthUtils.isTokenBlacklisted as jest.Mock).mockResolvedValue(true);

      // Act
      await AuthController.getAuthStatus(mockReq as Request, mockRes as Response);

      // Assert
      expect(AuthUtils.isTokenBlacklisted).toHaveBeenCalledWith('blacklisted-token');
      expect(AuthUtils.clearAuthCookie).toHaveBeenCalled();
      expect(AuthUtils.clearRefreshTokenCookie).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: false,
        message: 'Token telah dicabut',
        authenticated: false,
      });
    });

    it('should return 401 if user not found', async () => {
      // Arrange
      mockReq.header = jest.fn().mockReturnValue('Bearer valid-token');
      (AuthUtils.getAuthToken as jest.Mock).mockReturnValue(null);
      (AuthUtils.isTokenBlacklisted as jest.Mock).mockResolvedValue(false);
      (JwtUtils.verifyToken as jest.Mock).mockReturnValue({ id: 999 });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      // Act
      await AuthController.getAuthStatus(mockReq as Request, mockRes as Response);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'User tidak ditemukan'
      });
    });
  });
});