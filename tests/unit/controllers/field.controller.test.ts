import { Request, Response } from 'express';
import { jest, describe, it, beforeEach, expect } from '@jest/globals';
import * as FieldController from '../../../src/controllers/field.controller';
import prisma from '../../../src/config/services/database';
import * as CacheUtils from '../../../src/utils/cache/cacheInvalidation.utils';
import * as CloudinaryUtils from '../../../src/utils/cloudinary.utils';
import { Role } from '../../../src/types';
import { MulterRequest } from '../../../src/middlewares/multer.middleware';

// Mock dependencies
jest.mock('../../../src/config/services/database', () => ({
  field: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  branch: {
    findUnique: jest.fn(),
  },
  activityLog: {
    create: jest.fn(),
  },
  fieldType: {
    findUnique: jest.fn(),
  },
}));

jest.mock('../../../src/utils/cache/cacheInvalidation.utils', () => ({
  invalidateFieldCache: jest.fn(),
}));

jest.mock('../../../src/utils/cloudinary.utils', () => ({
  cleanupUploadedFile: jest.fn(),
}));

describe('Field Controller', () => {
  let mockReq: Partial<Request> & Partial<MulterRequest>;
  let mockRes: Partial<Response>;
  
  beforeEach(() => {
    mockReq = {
      query: {},
      params: {},
      body: {},
      user: { id: 1, role: Role.USER },
      userBranch: { id: 1 },
      ip: '192.168.1.1',
      file: undefined,
    };
    
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      headersSent: false,
    } as unknown as Response;

    jest.clearAllMocks();
  });

  describe('getAllFields', () => {
    const mockFields = [
      {
        id: 1,
        name: 'Lapangan Futsal 1',
        branchId: 1,
        typeId: 1,
        priceDay: 100000,
        priceNight: 150000,
        branch: {
          id: 1,
          name: 'Cabang 1',
        },
        type: {
          id: 1,
          name: 'Futsal',
        },
      },
    ];

    it('should return all fields with pagination', async () => {
      // Arrange
      mockReq.query = { page: '1', limit: '10' };
      
      (prisma.field.count as jest.Mock).mockResolvedValue(1);
      (prisma.field.findMany as jest.Mock).mockResolvedValue(mockFields);

      // Act
      await FieldController.getAllFields(mockReq as Request, mockRes as Response);

      // Assert
      expect(prisma.field.count).toHaveBeenCalled();
      expect(prisma.field.findMany).toHaveBeenCalledWith({
        where: {},
        skip: 0,
        take: 10,
        include: {
          branch: {
            select: {
              id: true,
              name: true,
            },
          },
          type: true,
        },
      });
      expect(mockRes.json).toHaveBeenCalledWith({
        data: mockFields,
        meta: {
          page: 1,
          limit: 10,
          totalItems: 1,
          totalPages: 1,
          hasNextPage: false,
          hasPrevPage: false,
        },
      });
    });

    it('should filter by search query', async () => {
      // Arrange
      mockReq.query = { q: 'futsal' };
      
      (prisma.field.count as jest.Mock).mockResolvedValue(1);
      (prisma.field.findMany as jest.Mock).mockResolvedValue(mockFields);

      // Act
      await FieldController.getAllFields(mockReq as Request, mockRes as Response);

      // Assert
      const expectedWhereCondition = {
        OR: [
          { name: { contains: 'futsal' } },
          { type: { name: { contains: 'futsal' } } },
          { branch: { name: { contains: 'futsal' } } },
        ],
      };
      
      expect(prisma.field.count).toHaveBeenCalledWith({
        where: expectedWhereCondition,
      });
      expect(prisma.field.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expectedWhereCondition,
        })
      );
    });

    it('should filter by branchId', async () => {
      // Arrange
      mockReq.query = { branchId: '2' };
      
      (prisma.field.count as jest.Mock).mockResolvedValue(1);
      (prisma.field.findMany as jest.Mock).mockResolvedValue(mockFields);

      // Act
      await FieldController.getAllFields(mockReq as Request, mockRes as Response);

      // Assert
      const expectedWhereCondition = {
        AND: [
          { branchId: 2 },
        ],
      };
      
      expect(prisma.field.count).toHaveBeenCalledWith({
        where: expectedWhereCondition,
      });
      expect(prisma.field.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expectedWhereCondition,
        })
      );
    });

    it('should handle error', async () => {
      // Arrange
      (prisma.field.count as jest.Mock).mockRejectedValue(new Error('Database error'));

      // Act
      await FieldController.getAllFields(mockReq as Request, mockRes as Response);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Internal Server Error',
      });
    });
  });

  describe('getBranchFields', () => {
    const mockFields = [
      {
        id: 1,
        name: 'Lapangan Futsal 1',
        branchId: 1,
        typeId: 1,
        branch: {
          id: 1,
          name: 'Cabang 1',
        },
        type: {
          id: 1,
          name: 'Futsal',
        },
      },
    ];

    it('should return fields by branch ID', async () => {
      // Arrange
      mockReq.params = { id: '1' };
      mockReq.query = { page: '1', limit: '10' };
      
      (prisma.branch.findUnique as jest.Mock).mockResolvedValue({ id: 1, name: 'Cabang 1' });
      (prisma.field.count as jest.Mock).mockResolvedValue(1);
      (prisma.field.findMany as jest.Mock).mockResolvedValue(mockFields);

      // Act
      await FieldController.getBranchFields(mockReq as Request, mockRes as Response);

      // Assert
      expect(prisma.branch.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
      });
      
      const whereCondition = { AND: [{ branchId: 1 }] };
      expect(prisma.field.count).toHaveBeenCalledWith({
        where: whereCondition,
      });
      
      expect(prisma.field.findMany).toHaveBeenCalledWith({
        where: whereCondition,
        skip: 0,
        take: 10,
        include: {
          branch: {
            select: {
              id: true,
              name: true,
            },
          },
          type: true,
        },
      });
      
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: true,
        message: 'Berhasil mendapatkan daftar lapangan untuk cabang',
        data: mockFields,
        meta: {
          page: 1,
          limit: 10,
          totalItems: 1,
          totalPages: 1,
          hasNextPage: false,
          hasPrevPage: false,
        },
      });
    });

    it('should return 400 for invalid branch ID', async () => {
      // Arrange
      mockReq.params = { id: 'invalid' };

      // Act
      await FieldController.getBranchFields(mockReq as Request, mockRes as Response);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: false,
        message: 'ID cabang tidak valid',
      });
    });

    it('should return 404 if branch not found', async () => {
      // Arrange
      mockReq.params = { id: '999' };
      
      (prisma.branch.findUnique as jest.Mock).mockResolvedValue(null);

      // Act
      await FieldController.getBranchFields(mockReq as Request, mockRes as Response);

      // Assert
      expect(prisma.branch.findUnique).toHaveBeenCalledWith({
        where: { id: 999 },
      });
      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: false,
        message: 'Cabang tidak ditemukan',
      });
    });

    it('should handle errors', async () => {
      // Arrange
      mockReq.params = { id: '1' };
      
      (prisma.branch.findUnique as jest.Mock).mockRejectedValue(new Error('Database error'));

      // Act
      await FieldController.getBranchFields(mockReq as Request, mockRes as Response);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: false,
        message: 'Internal Server Error',
      });
    });
  });

  describe('createField', () => {
    const fieldData = {
      name: 'Lapangan Futsal Baru',
      typeId: 1,
      priceDay: 100000,
      priceNight: 150000,
      description: 'Lapangan futsal baru dengan kualitas rumput sintetis terbaik',
    };

    const mockBranch = {
      id: 1,
      name: 'Cabang 1',
    };

    const mockField = {
      id: 1,
      ...fieldData,
      branchId: 1,
      imageUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should create a new field successfully for branch admin', async () => {
      // Arrange
      mockReq.body = fieldData;
      mockReq.userBranch = { id: 1 };
      mockReq.user = { id: 1, role: Role.ADMIN_CABANG };
      
      (prisma.branch.findUnique as jest.Mock).mockResolvedValue(mockBranch);
      (prisma.field.create as jest.Mock).mockResolvedValue(mockField);

      // Act
      await FieldController.createField(mockReq as any, mockRes as Response);

      // Assert
      expect(prisma.branch.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        select: { name: true },
      });
      expect(prisma.field.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: fieldData.name,
          typeId: fieldData.typeId,
          branchId: 1,
          imageUrl: null,
        }),
      });
      expect(CacheUtils.invalidateFieldCache).toHaveBeenCalled();
      expect(prisma.activityLog.create).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(201);
    });

    it('should create a new field with image successfully', async () => {
      // Arrange
      mockReq.body = fieldData;
      mockReq.userBranch = { id: 1 };
      mockReq.file = { path: 'uploads/field-image.jpg' } as any;
      
      (prisma.branch.findUnique as jest.Mock).mockResolvedValue(mockBranch);
      (prisma.field.create as jest.Mock).mockResolvedValue({
        ...mockField,
        imageUrl: 'uploads/field-image.jpg',
      });

      // Act
      await FieldController.createField(mockReq as any, mockRes as Response);

      // Assert
      expect(prisma.field.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          imageUrl: 'uploads/field-image.jpg',
        }),
      });
      expect(mockRes.status).toHaveBeenCalledWith(201);
    });

    it('should allow super admin to specify branch ID', async () => {
      // Arrange
      mockReq.body = { ...fieldData, branchId: '2' };
      mockReq.user = { id: 1, role: 'super_admin' };
      mockReq.userBranch = undefined;
      
      (prisma.branch.findUnique as jest.Mock).mockResolvedValue({ id: 2, name: 'Cabang 2' });
      (prisma.field.create as jest.Mock).mockResolvedValue({
        ...mockField,
        branchId: 2,
      });

      // Act
      await FieldController.createField(mockReq as any, mockRes as Response);

      // Assert
      expect(prisma.branch.findUnique).toHaveBeenCalledWith({
        where: { id: 2 },
      });
      expect(prisma.field.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          branchId: 2,
        }),
      });
      expect(mockRes.status).toHaveBeenCalledWith(201);
    });

    it('should return 400 if branch ID is missing', async () => {
      // Arrange
      mockReq.body = fieldData;
      mockReq.userBranch = undefined;
      mockReq.user = { id: 1, role: Role.ADMIN_CABANG };

      // Act
      await FieldController.createField(mockReq as any, mockRes as Response);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: false,
        message: 'Branch ID is required',
      });
    });

    it('should return 400 if validation fails', async () => {
      // Arrange
      mockReq.body = { name: 'Too short' }; // Missing required fields
      mockReq.userBranch = { id: 1 };

      // Act
      await FieldController.createField(mockReq as any, mockRes as Response);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: false,
          message: 'Validasi gagal',
        })
      );
    });

    it('should clean up uploaded file if an error occurs', async () => {
      // Arrange
      mockReq.body = fieldData;
      mockReq.userBranch = { id: 1 };
      mockReq.file = { path: 'uploads/field-image.jpg' } as any;
      
      (prisma.branch.findUnique as jest.Mock).mockResolvedValue(mockBranch);
      (prisma.field.create as jest.Mock).mockRejectedValue(new Error('Database error'));

      // Act
      await FieldController.createField(mockReq as any, mockRes as Response);

      // Assert
      expect(CloudinaryUtils.cleanupUploadedFile).toHaveBeenCalledWith('uploads/field-image.jpg');
      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });
}); 