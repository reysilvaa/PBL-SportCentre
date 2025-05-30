import { Request, Response } from 'express';
import { jest, describe, it, beforeEach, expect } from '@jest/globals';
import * as FieldTypeController from '../../../src/controllers/fieldType.controller';
import prisma from '../../../src/config/services/database';
import * as CacheUtils from '../../../src/utils/cache/cacheInvalidation.utils';

// Mock dependencies
jest.mock('../../../src/config/services/database', () => ({
  fieldType: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  field: {
    findFirst: jest.fn(),
  },
  activityLog: {
    create: jest.fn(),
  },
}));

jest.mock('../../../src/utils/cache/cacheInvalidation.utils', () => ({
  invalidateFieldTypeCache: jest.fn(),
}));

describe('Field Type Controller', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  
  beforeEach(() => {
    mockReq = {
      body: {},
      params: {},
      user: {
        id: 1,
        role: 'admin',
      },
      ip: '192.168.1.1',
    };
    
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;

    jest.clearAllMocks();
  });

  describe('getFieldTypes', () => {
    const mockFieldTypes = [
      {
        id: 1,
        name: 'Futsal',
        Fields: [
          {
            id: 1,
            name: 'Lapangan Futsal 1',
            branch: {
              name: 'Cabang 1',
            },
          },
        ],
      },
      {
        id: 2,
        name: 'Badminton',
        Fields: [],
      },
    ];

    it('should return all field types', async () => {
      // Arrange
      (prisma.fieldType.findMany as jest.Mock).mockResolvedValue(mockFieldTypes);

      // Act
      await FieldTypeController.getFieldTypes(mockReq as Request, mockRes as Response);

      // Assert
      expect(prisma.fieldType.findMany).toHaveBeenCalledWith({
        include: {
          Fields: {
            select: {
              id: true,
              name: true,
              branch: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      });
      expect(mockRes.json).toHaveBeenCalledWith(mockFieldTypes);
    });

    it('should handle errors', async () => {
      // Arrange
      (prisma.fieldType.findMany as jest.Mock).mockRejectedValue(new Error('Database error'));

      // Act
      await FieldTypeController.getFieldTypes(mockReq as Request, mockRes as Response);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Internal Server Error',
      });
    });
  });

  describe('createFieldType', () => {
    const validFieldTypeData = {
      name: 'Tenis',
    };

    it('should create a new field type successfully', async () => {
      // Arrange
      mockReq.body = validFieldTypeData;
      
      const createdFieldType = {
        id: 3,
        name: 'Tenis',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      (prisma.fieldType.create as jest.Mock).mockResolvedValue(createdFieldType);

      // Act
      await FieldTypeController.createFieldType(mockReq as any, mockRes as Response);

      // Assert
      expect(prisma.fieldType.create).toHaveBeenCalledWith({
        data: {
          name: validFieldTypeData.name,
        },
      });
      expect(CacheUtils.invalidateFieldTypeCache).toHaveBeenCalled();
      expect(prisma.activityLog.create).toHaveBeenCalledWith({
        data: {
          userId: mockReq.user!.id,
          action: 'CREATE_FIELD_TYPE',
          details: `Membuat tipe lapangan baru "${validFieldTypeData.name}"`,
          ipAddress: mockReq.ip,
        },
      });
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: true,
        message: 'Berhasil membuat tipe lapangan baru',
        data: createdFieldType,
      });
    });

    it('should return 400 if validation fails', async () => {
      // Arrange
      mockReq.body = { name: '' }; // Empty name will fail validation

      // Act
      await FieldTypeController.createFieldType(mockReq as any, mockRes as Response);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: false,
          message: 'Validasi gagal',
        })
      );
    });

    it('should handle database errors', async () => {
      // Arrange
      mockReq.body = validFieldTypeData;
      
      (prisma.fieldType.create as jest.Mock).mockRejectedValue(new Error('Database error'));

      // Act
      await FieldTypeController.createFieldType(mockReq as any, mockRes as Response);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: false,
        message: 'Internal Server Error',
      });
    });
  });

  describe('updateFieldType', () => {
    const existingFieldType = {
      id: 1,
      name: 'Futsal',
    };

    const updateData = {
      name: 'Futsal Indoor',
    };

    it('should update a field type successfully', async () => {
      // Arrange
      mockReq.params = { id: '1' };
      mockReq.body = updateData;
      
      const updatedFieldType = {
        ...existingFieldType,
        name: updateData.name,
        updatedAt: new Date(),
      };
      
      (prisma.fieldType.findUnique as jest.Mock).mockResolvedValue(existingFieldType);
      (prisma.fieldType.update as jest.Mock).mockResolvedValue(updatedFieldType);

      // Act
      await FieldTypeController.updateFieldType(mockReq as any, mockRes as Response);

      // Assert
      expect(prisma.fieldType.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
      });
      expect(prisma.fieldType.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          name: updateData.name,
        },
      });
      expect(CacheUtils.invalidateFieldTypeCache).toHaveBeenCalled();
      expect(prisma.activityLog.create).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: true,
        message: 'Berhasil memperbarui tipe lapangan',
        data: updatedFieldType,
      });
    });

    it('should return 400 for invalid ID', async () => {
      // Arrange
      mockReq.params = { id: 'invalid' };
      mockReq.body = updateData;

      // Act
      await FieldTypeController.updateFieldType(mockReq as any, mockRes as Response);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: false,
        message: 'ID tipe lapangan tidak valid',
      });
    });

    it('should return 400 if validation fails', async () => {
      // Arrange
      mockReq.params = { id: '1' };
      mockReq.body = { name: '' }; // Empty name will fail validation

      // Act
      await FieldTypeController.updateFieldType(mockReq as any, mockRes as Response);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: false,
          message: 'Validasi gagal',
        })
      );
    });

    it('should return 404 if field type is not found', async () => {
      // Arrange
      mockReq.params = { id: '999' };
      mockReq.body = updateData;
      
      (prisma.fieldType.findUnique as jest.Mock).mockResolvedValue(null);

      // Act
      await FieldTypeController.updateFieldType(mockReq as any, mockRes as Response);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: false,
        message: 'Tipe lapangan tidak ditemukan',
      });
    });

    it('should handle database errors', async () => {
      // Arrange
      mockReq.params = { id: '1' };
      mockReq.body = updateData;
      
      (prisma.fieldType.findUnique as jest.Mock).mockResolvedValue(existingFieldType);
      (prisma.fieldType.update as jest.Mock).mockRejectedValue(new Error('Database error'));

      // Act
      await FieldTypeController.updateFieldType(mockReq as any, mockRes as Response);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: false,
        message: 'Internal Server Error',
      });
    });
  });

  describe('deleteFieldType', () => {
    const existingFieldType = {
      id: 1,
      name: 'Futsal',
    };

    it('should delete a field type successfully', async () => {
      // Arrange
      mockReq.params = { id: '1' };
      
      (prisma.fieldType.findUnique as jest.Mock).mockResolvedValue(existingFieldType);
      (prisma.field.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.fieldType.delete as jest.Mock).mockResolvedValue(existingFieldType);

      // Act
      await FieldTypeController.deleteFieldType(mockReq as any, mockRes as Response);

      // Assert
      expect(prisma.fieldType.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
      });
      expect(prisma.field.findFirst).toHaveBeenCalledWith({
        where: { typeId: 1 },
      });
      expect(prisma.fieldType.delete).toHaveBeenCalledWith({
        where: { id: 1 },
      });
      expect(CacheUtils.invalidateFieldTypeCache).toHaveBeenCalled();
      expect(prisma.activityLog.create).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: true,
        message: 'Berhasil menghapus tipe lapangan',
      });
    });

    it('should return 400 for invalid ID', async () => {
      // Arrange
      mockReq.params = { id: 'invalid' };

      // Act
      await FieldTypeController.deleteFieldType(mockReq as any, mockRes as Response);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: false,
        message: 'ID tipe lapangan tidak valid',
      });
    });

    it('should return 404 if field type is not found', async () => {
      // Arrange
      mockReq.params = { id: '999' };
      
      (prisma.fieldType.findUnique as jest.Mock).mockResolvedValue(null);

      // Act
      await FieldTypeController.deleteFieldType(mockReq as any, mockRes as Response);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: false,
        message: 'Tipe lapangan tidak ditemukan',
      });
    });

    it('should return 400 if field type is in use', async () => {
      // Arrange
      mockReq.params = { id: '1' };
      
      const fieldUsingType = {
        id: 1,
        name: 'Lapangan A',
        typeId: 1,
      };
      
      (prisma.fieldType.findUnique as jest.Mock).mockResolvedValue(existingFieldType);
      (prisma.field.findFirst as jest.Mock).mockResolvedValue(fieldUsingType);

      // Act
      await FieldTypeController.deleteFieldType(mockReq as any, mockRes as Response);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: false,
        message: 'Tidak dapat menghapus tipe lapangan yang sedang digunakan',
      });
    });

    it('should handle database errors', async () => {
      // Arrange
      mockReq.params = { id: '1' };
      
      (prisma.fieldType.findUnique as jest.Mock).mockRejectedValue(new Error('Database error'));

      // Act
      await FieldTypeController.deleteFieldType(mockReq as any, mockRes as Response);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: false,
        message: 'Internal Server Error',
      });
    });
  });
}); 