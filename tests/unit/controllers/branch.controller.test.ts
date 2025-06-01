// @ts-nocheck
import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { getBranches, createBranch, updateBranch, deleteBranch } from '../../../src/controllers/branch.controller';

// Mock zod schema
jest.mock('../../../src/zod-schemas/branch.schema', () => ({
  branchSchema: {
    safeParse: jest.fn().mockImplementation((data) => {
      // Default to success
      return {
        success: true,
        data: { ...data, status: data.status || 'active' },
      };
    }),
  },
  updateBranchSchema: {
    safeParse: jest.fn().mockImplementation((data) => {
      // Default to success
      return {
        success: true,
        data: { ...data, status: data.status || 'active' },
      };
    }),
  },
}));

// Mock the database
jest.mock('../../../src/config/services/database', () => ({
  __esModule: true,
  default: {
    branch: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    field: {
      findFirst: jest.fn(),
    },
    branchAdmin: {
      findFirst: jest.fn(),
    },
    activityLog: {
      create: jest.fn(),
    },
  },
}));

// Mock the cache invalidation
jest.mock('../../../src/utils/cache/cacheInvalidation.utils', () => ({
  invalidateBranchCache: jest.fn(),
}));

// Mock cloudinary utils
jest.mock('../../../src/utils/cloudinary.utils', () => ({
  cleanupUploadedFile: jest.fn(),
}));

describe('Branch Controller', () => {
  let req, res;
  
  beforeEach(() => {
    req = {
      query: {},
      params: {},
      body: {},
      user: { id: 1, role: 'super_admin' },
      userBranch: { id: 1 },
      file: null,
      ip: '127.0.0.1',
    };
    
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      headersSent: false,
    };
    
    jest.clearAllMocks();
    
    // Reset mock implementations for zod schemas
    const branchSchema = require('../../../src/zod-schemas/branch.schema').branchSchema;
    branchSchema.safeParse.mockImplementation((data) => {
      return {
        success: true,
        data: { ...data, status: data.status || 'active' },
      };
    });
    
    const updateBranchSchema = require('../../../src/zod-schemas/branch.schema').updateBranchSchema;
    updateBranchSchema.safeParse.mockImplementation((data) => {
      return {
        success: true,
        data: { ...data, status: data.status || 'active' },
      };
    });
  });
  
  describe('getBranches', () => {
    it('should return all branches for super_admin', async () => {
      const mockBranches = [
        { id: 1, name: 'Branch 1' },
        { id: 2, name: 'Branch 2' },
      ];
      
      const prisma = require('../../../src/config/services/database').default;
      prisma.branch.findMany.mockResolvedValue(mockBranches);
      prisma.branch.count.mockResolvedValue(mockBranches.length);
      
      await getBranches(req, res);
      
      expect(prisma.branch.findMany).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        status: true,
        message: 'Berhasil mendapatkan daftar cabang',
        data: mockBranches,
        meta: {
          page: 1,
          limit: 15,
          totalItems: 2,
          totalPages: 1,
          hasNextPage: false,
          hasPrevPage: false,
        },
      });
    });
    
    it('should return branches for owner_cabang', async () => {
      req.user.role = 'owner_cabang';
      req.query = { q: 'test', page: '1', limit: '10' };
      
      const mockBranches = [{ id: 1, name: 'Branch 1' }];
      
      const prisma = require('../../../src/config/services/database').default;
      prisma.branch.findMany.mockResolvedValue(mockBranches);
      prisma.branch.count.mockResolvedValue(mockBranches.length);
      
      await getBranches(req, res);
      
      expect(prisma.branch.findMany).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        status: true,
        message: 'Berhasil mendapatkan daftar cabang',
        data: mockBranches,
        meta: expect.any(Object),
      });
    });
    
    it('should handle errors', async () => {
      const prisma = require('../../../src/config/services/database').default;
      prisma.branch.findMany.mockRejectedValue(new Error('Database error'));
      
      await getBranches(req, res);
      
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        status: false,
        message: 'Internal Server Error',
      });
    });
    
    it('should return a specific branch by ID', async () => {
      req.params.id = '1';
      
      const mockBranch = { id: 1, name: 'Branch 1' };
      
      const prisma = require('../../../src/config/services/database').default;
      prisma.branch.findUnique.mockResolvedValue(mockBranch);
      
      await getBranches(req, res);
      
      expect(prisma.branch.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        include: {
          owner: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        status: true,
        message: 'Berhasil mendapatkan data cabang',
        data: mockBranch,
      });
    });
    
    it('should return 404 if branch not found by ID', async () => {
      req.params.id = '999';
      
      const prisma = require('../../../src/config/services/database').default;
      prisma.branch.findUnique.mockResolvedValue(null);
      
      await getBranches(req, res);
      
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        status: false,
        message: 'Cabang tidak ditemukan',
      });
    });
  });
  
  describe('createBranch', () => {
    it('should create a new branch', async () => {
      req.body = {
        name: 'New Branch',
        location: 'New Location',
        ownerId: 2,
        status: 'active',
      };
      
      const mockBranch = { 
        id: 3, 
        name: 'New Branch',
        location: 'New Location',
        ownerId: 2,
        status: 'active',
        imageUrl: null,
      };
      
      const prisma = require('../../../src/config/services/database').default;
      prisma.branch.create.mockResolvedValue(mockBranch);
      
      await createBranch(req, res);
      
      expect(prisma.branch.create).toHaveBeenCalledWith({
        data: {
          name: 'New Branch',
          location: 'New Location',
          ownerId: 2,
          status: 'active',
          imageUrl: null,
        },
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        status: true,
        message: 'Berhasil membuat cabang baru',
        data: mockBranch,
      });
    });
    
    it('should handle validation errors', async () => {
      req.body = {
        // Missing required fields
      };
      
      // Mock validation error for this test
      const branchSchema = require('../../../src/zod-schemas/branch.schema').branchSchema;
      branchSchema.safeParse.mockReturnValueOnce({
        success: false,
        error: {
          format: () => ({ name: { _errors: ['Name is required'] } }),
        },
      });
      
      await createBranch(req, res);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json.mock.calls[0][0].status).toBe(false);
    });
    
    it('should handle errors', async () => {
      req.body = {
        name: 'New Branch',
        location: 'New Location',
        ownerId: 2,
        status: 'active',
      };
      
      const prisma = require('../../../src/config/services/database').default;
      prisma.branch.create.mockRejectedValue(new Error('Database error'));
      
      await createBranch(req, res);
      
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        status: false,
        message: 'Internal Server Error',
      });
    });
  });
  
  describe('updateBranch', () => {
    it('should update a branch', async () => {
      req.params.id = '1';
      req.body = {
        name: 'Updated Branch',
        location: 'Updated Location',
        status: 'active',
      };
      
      const existingBranch = {
        id: 1,
        name: 'Old Branch',
        location: 'Old Location',
        ownerId: 2,
        status: 'active',
        imageUrl: null,
      };
      
      const updatedBranch = {
        ...existingBranch,
        name: 'Updated Branch',
        location: 'Updated Location',
      };
      
      const prisma = require('../../../src/config/services/database').default;
      prisma.branch.findUnique.mockResolvedValue(existingBranch);
      prisma.branch.findFirst.mockResolvedValue(existingBranch);
      prisma.branch.update.mockResolvedValue(updatedBranch);
      
      await updateBranch(req, res);
      
      expect(prisma.branch.update).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        status: true,
        message: expect.any(String),
        data: updatedBranch,
      });
    });
    
    it('should return 400 for invalid ID', async () => {
      req.params.id = 'invalid';
      
      await updateBranch(req, res);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json.mock.calls[0][0].status).toBe(false);
    });
    
    it('should return 404 if branch not found', async () => {
      req.params.id = '999';
      req.body = {
        name: 'Updated Branch',
      };
      
      const prisma = require('../../../src/config/services/database').default;
      prisma.branch.findUnique.mockResolvedValue(null);
      
      await updateBranch(req, res);
      
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json.mock.calls[0][0].status).toBe(false);
    });
    
    it('should handle errors', async () => {
      req.params.id = '1';
      req.body = {
        name: 'Updated Branch',
      };
      
      const prisma = require('../../../src/config/services/database').default;
      prisma.branch.findUnique.mockRejectedValue(new Error('Database error'));
      
      await updateBranch(req, res);
      
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        status: false,
        message: 'Internal Server Error',
      });
    });
  });
  
  describe('deleteBranch', () => {
    it('should delete a branch', async () => {
      req.params.id = '1';
      
      const existingBranch = {
        id: 1,
        name: 'Branch to delete',
        ownerId: 2,
        imageUrl: null,
      };
      
      const prisma = require('../../../src/config/services/database').default;
      prisma.branch.findUnique.mockResolvedValue(existingBranch);
      prisma.field.findFirst.mockResolvedValue(null);
      prisma.branchAdmin.findFirst.mockResolvedValue(null);
      prisma.branch.delete.mockResolvedValue(existingBranch);
      
      await deleteBranch(req, res);
      
      expect(prisma.branch.delete).toHaveBeenCalledWith({
        where: { id: 1 },
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json.mock.calls[0][0].status).toBe(true);
    });
    
    it('should return 400 for invalid ID', async () => {
      req.params.id = 'invalid';
      
      await deleteBranch(req, res);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json.mock.calls[0][0].status).toBe(false);
    });
    
    it('should return 404 if branch not found', async () => {
      req.params.id = '999';
      
      const prisma = require('../../../src/config/services/database').default;
      prisma.branch.findUnique.mockResolvedValue(null);
      
      await deleteBranch(req, res);
      
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json.mock.calls[0][0].status).toBe(false);
    });
    
    it('should handle errors', async () => {
      req.params.id = '1';
      
      const prisma = require('../../../src/config/services/database').default;
      prisma.branch.findUnique.mockRejectedValue(new Error('Database error'));
      
      await deleteBranch(req, res);
      
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        status: false,
        message: 'Internal Server Error',
      });
    });
  });
}); 