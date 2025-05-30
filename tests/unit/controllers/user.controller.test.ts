// @ts-nocheck
import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { getUsers, createUser, updateUser, deleteUser, getUserProfile } from '../../../src/controllers/user.controller';

// Mock the database
jest.mock('../../../src/config/services/database', () => ({
  __esModule: true,
  default: {
    user: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
    },
    branch: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    booking: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    branchAdmin: {
      deleteMany: jest.fn(),
      create: jest.fn(),
    },
    activityLog: {
      create: jest.fn(),
    },
  },
}));

// Mock password utils
jest.mock('../../../src/utils/password.utils', () => ({
  hashPassword: jest.fn().mockReturnValue('hashedPassword'),
  comparePassword: jest.fn().mockReturnValue(true),
}));

// Mock cache invalidation
jest.mock('../../../src/utils/cache/cacheInvalidation.utils', () => ({
  invalidateUserCache: jest.fn(),
}));

describe('User Controller', () => {
  let req, res;
  
  beforeEach(() => {
    req = {
      query: {},
      params: {},
      body: {},
      user: { id: 1, role: 'super_admin' },
      ip: '127.0.0.1',
    };
    
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    
    jest.clearAllMocks();
  });
  
  describe('getUsers', () => {
    it('should return all users for super_admin', async () => {
      const mockUsers = [
        { id: 1, name: 'User 1', email: 'user1@example.com' },
        { id: 2, name: 'User 2', email: 'user2@example.com' },
      ];
      
      const prisma = require('../../../src/config/services/database').default;
      prisma.user.findMany.mockResolvedValue(mockUsers);
      
      await getUsers(req, res);
      
      expect(prisma.user.findMany).toHaveBeenCalledWith({
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          phone: true,
          createdAt: true,
        },
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        status: true,
        message: 'Daftar user berhasil diambil',
        data: mockUsers,
      });
    });
    
    it('should handle errors', async () => {
      const prisma = require('../../../src/config/services/database').default;
      prisma.user.findMany.mockRejectedValue(new Error('Database error'));
      
      await getUsers(req, res);
      
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        status: false,
        message: 'Terjadi kesalahan server internal',
      });
    });
  });
  
  describe('getUserProfile', () => {
    it('should return user profile by ID', async () => {
      req.params.id = '1';
      
      const mockUser = { id: 1, name: 'User 1', email: 'user1@example.com', role: 'user', phone: '123456789', createdAt: new Date() };
      
      const prisma = require('../../../src/config/services/database').default;
      prisma.user.findUnique.mockResolvedValue(mockUser);
      
      await getUserProfile(req, res);
      
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          phone: true,
          createdAt: true,
        },
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        status: true,
        message: 'Profil user berhasil didapatkan',
        data: mockUser,
      });
    });
    
    it('should return 404 if user not found', async () => {
      req.params.id = '999';
      
      const prisma = require('../../../src/config/services/database').default;
      prisma.user.findUnique.mockResolvedValue(null);
      
      await getUserProfile(req, res);
      
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        status: false,
        message: 'User tidak ditemukan',
      });
    });
    
    it('should handle errors', async () => {
      req.params.id = '1';
      
      const prisma = require('../../../src/config/services/database').default;
      prisma.user.findUnique.mockRejectedValue(new Error('Database error'));
      
      await getUserProfile(req, res);
      
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        status: false,
        message: 'Terjadi kesalahan server internal',
      });
    });
  });
  
  describe('createUser', () => {
    it('should create a new user', async () => {
      req.body = {
        name: 'New User',
        email: 'newuser@example.com',
        password: 'password123',
        role: 'user',
      };
      
      const mockUser = { id: 3, ...req.body, password: 'hashedPassword' };
      
      const prisma = require('../../../src/config/services/database').default;
      prisma.user.findUnique.mockResolvedValue(null); // Email tidak digunakan
      prisma.user.create.mockResolvedValue(mockUser);
      
      await createUser(req, res);
      
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          name: 'New User',
          email: 'newuser@example.com',
          password: 'hashedPassword',
          role: 'user',
          phone: undefined,
        },
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        status: true,
        message: 'User berhasil dibuat',
        data: expect.objectContaining({
          id: 3,
          name: 'New User',
          email: 'newuser@example.com',
        }),
      });
    });
    
    it('should return 400 if email already exists', async () => {
      req.body = {
        name: 'New User',
        email: 'existing@example.com',
        password: 'password123',
      };
      
      const prisma = require('../../../src/config/services/database').default;
      prisma.user.findUnique.mockResolvedValue({ id: 2, email: 'existing@example.com' });
      
      await createUser(req, res);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        status: false,
        message: 'Email sudah digunakan',
      });
    });
  });
  
  describe('updateUser', () => {
    it('should update a user', async () => {
      req.params.id = '1';
      req.body = {
        name: 'Updated User',
        email: 'updated@example.com',
      };
      
      const mockUser = { id: 1, ...req.body };
      
      const prisma = require('../../../src/config/services/database').default;
      prisma.user.findUnique.mockResolvedValue({ id: 1, name: 'Old Name', email: 'old@example.com' });
      prisma.user.findFirst.mockResolvedValue(null); // Email baru tidak digunakan
      prisma.user.update.mockResolvedValue(mockUser);
      
      await updateUser(req, res);
      
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: req.body,
      });
    });
    
    it('should return 404 if user not found', async () => {
      req.params.id = '999';
      req.body = {
        name: 'Updated User',
      };
      
      const prisma = require('../../../src/config/services/database').default;
      prisma.user.findUnique.mockResolvedValue(null);
      
      await updateUser(req, res);
      
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        status: false,
        message: 'User tidak ditemukan',
      });
    });
    
    it('should handle email already in use', async () => {
      req.params.id = '1';
      req.body = {
        email: 'existing@example.com',
      };
      
      const prisma = require('../../../src/config/services/database').default;
      prisma.user.findUnique.mockResolvedValue({ id: 1, name: 'Old Name', email: 'old@example.com' });
      prisma.user.findFirst.mockResolvedValue({ id: 2, email: 'existing@example.com' });
      
      await updateUser(req, res);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        status: false,
        message: 'Email sudah digunakan oleh pengguna lain',
      });
    });
  });
  
  describe('deleteUser', () => {
    it('should delete a user', async () => {
      req.params.id = '1';
      req.user.id = 2; // User yang sedang login berbeda dengan yang dihapus
      
      const mockUser = { id: 1, name: 'User 1', email: 'user1@example.com', role: 'user' };
      
      const prisma = require('../../../src/config/services/database').default;
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.booking.findFirst.mockResolvedValue(null); // Tidak ada booking
      prisma.branchAdmin.deleteMany.mockResolvedValue({ count: 0 });
      prisma.user.delete.mockResolvedValue(mockUser);
      
      await deleteUser(req, res);
      
      expect(prisma.branchAdmin.deleteMany).toHaveBeenCalledWith({
        where: { userId: 1 },
      });
      expect(prisma.user.delete).toHaveBeenCalledWith({
        where: { id: 1 },
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        status: true,
        message: 'User berhasil dihapus',
      });
    });
    
    it('should return 404 if user not found', async () => {
      req.params.id = '999';
      
      const prisma = require('../../../src/config/services/database').default;
      prisma.user.findUnique.mockResolvedValue(null);
      
      await deleteUser(req, res);
      
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        status: false,
        message: 'User tidak ditemukan',
      });
    });
    
    it('should handle errors', async () => {
      req.params.id = '1';
      req.user.id = 2; // User yang sedang login berbeda dengan yang dihapus
      
      const mockUser = { id: 1, name: 'User 1', email: 'user1@example.com', role: 'user' };
      
      const prisma = require('../../../src/config/services/database').default;
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.booking.findFirst.mockResolvedValue(null);
      prisma.branchAdmin.deleteMany.mockResolvedValue({ count: 0 });
      prisma.user.delete.mockImplementation(() => {
        throw new Error('Database error');
      });
      
      await deleteUser(req, res);
      
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        status: false,
        message: 'Terjadi kesalahan server internal',
      });
    });
  });
}); 