import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { Request, Response } from 'express';
import { unitTestSetup } from '../../core';
import * as fieldTypeController from '../../../src/controllers/fieldType.controller';

// Setup untuk pengujian unit
const { prismaMock } = unitTestSetup.setupControllerTest();

// Mock cache invalidation
jest.mock('../../../src/utils/cache/cacheInvalidation.utils', () => ({
  invalidateFieldTypeCache: jest.fn(() => Promise.resolve())
}));

// Mock zod schema
jest.mock('../../../src/zod-schemas/fieldType.schema', () => ({
  createFieldTypeSchema: {
    safeParse: jest.fn().mockImplementation((data: any) => {
      if (data && data.name) {
        return { success: true, data };
      }
      return { 
        success: false, 
        error: { 
          format: () => ({ name: { _errors: ['Name is required'] } }) 
        } 
      };
    })
  },
  updateFieldTypeSchema: {
    safeParse: jest.fn().mockImplementation((data: any) => {
      if (data && data.name) {
        return { success: true, data };
      }
      return { 
        success: false, 
        error: { 
          format: () => ({ name: { _errors: ['Name is required'] } }) 
        } 
      };
    })
  }
}));

describe('Field Type Controller', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn().mockReturnThis();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });

    mockRequest = {
      body: {},
      // @ts-ignore - mengabaikan masalah tipe pada header
      header: jest.fn(),
      params: {},
      ip: '127.0.0.1',
      user: { id: 1, role: 'SUPER_ADMIN' },
    };

    mockResponse = {
      // @ts-ignore - mengabaikan masalah tipe pada json dan status
      json: jsonMock,
      // @ts-ignore - mengabaikan masalah tipe pada json dan status
      status: statusMock,
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getFieldTypes', () => {
    it('seharusnya mengembalikan semua tipe lapangan yang tersedia', async () => {
      // Setup
      const mockFieldTypes = [
        { id: 1, name: 'Futsal', Fields: [] },
        { id: 2, name: 'Badminton', Fields: [] },
      ];
      prismaMock.fieldType.findMany.mockResolvedValue(mockFieldTypes as any);

      // Execute
      await fieldTypeController.getFieldTypes(mockRequest as Request, mockResponse as Response);

      // Verify
      expect(jsonMock).toHaveBeenCalledWith(expect.any(Array));
    });

    it('seharusnya menangani error saat mengambil tipe lapangan', async () => {
      // Setup - menggunakan pendekatan berbeda untuk simulasi error
      prismaMock.fieldType.findMany.mockRejectedValue(new Error('Database error'));

      // Execute
      await fieldTypeController.getFieldTypes(mockRequest as Request, mockResponse as Response);

      // Verify - sesuaikan dengan implementasi sebenarnya
      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Internal Server Error' });
    });
  });

  describe('createFieldType', () => {
    it('seharusnya membuat tipe lapangan baru', async () => {
      // Setup
      const newFieldType = { name: 'Tennis' };
      mockRequest.body = newFieldType;
      
      const createdFieldType = { id: 3, ...newFieldType };
      
      prismaMock.fieldType.create.mockResolvedValue(createdFieldType as any);
      prismaMock.activityLog.create.mockResolvedValue({ id: 1 } as any);

      // Execute
      await fieldTypeController.createFieldType(mockRequest as any, mockResponse as Response);

      // Verify - sesuaikan dengan implementasi sebenarnya
      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({
        status: true,
        message: 'Berhasil membuat tipe lapangan baru',
        data: expect.anything()
      }));
    });

    it('seharusnya menangani error validasi data', async () => {
      // Setup
      mockRequest.body = {}; // Missing required name
      
      // Execute
      await fieldTypeController.createFieldType(mockRequest as any, mockResponse as Response);

      // Verify
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({
        status: false,
        message: 'Validasi gagal'
      }));
    });
  });

  describe('updateFieldType', () => {
    it('seharusnya mengupdate tipe lapangan yang ada', async () => {
      // Setup
      const updateData = { name: 'Updated Tennis' };
      mockRequest.params = { id: '3' };
      mockRequest.body = updateData;
      
      const existingFieldType = { id: 3, name: 'Tennis' };
      const updatedFieldType = { id: 3, ...updateData };
      
      prismaMock.fieldType.findUnique.mockResolvedValue(existingFieldType as any);
      prismaMock.fieldType.update.mockResolvedValue(updatedFieldType as any);
      prismaMock.activityLog.create.mockResolvedValue({ id: 2 } as any);

      // Execute
      await fieldTypeController.updateFieldType(mockRequest as any, mockResponse as Response);

      // Verify
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({
        status: true,
        message: 'Berhasil memperbarui tipe lapangan',
        data: expect.anything()
      }));
    });

    it('seharusnya mengembalikan 404 jika tipe lapangan tidak ditemukan', async () => {
      // Setup
      mockRequest.params = { id: '999' };
      mockRequest.body = { name: 'Not Found Type' };
      prismaMock.fieldType.findUnique.mockResolvedValue(null);

      // Execute
      await fieldTypeController.updateFieldType(mockRequest as any, mockResponse as Response);

      // Verify
      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({
        status: false,
        message: 'Tipe lapangan tidak ditemukan'
      }));
    });
  });

  describe('deleteFieldType', () => {
    it('seharusnya menghapus tipe lapangan', async () => {
      // Setup
      mockRequest.params = { id: '3' };
      const deletedFieldType = { id: 3, name: 'Tennis' };
      
      prismaMock.fieldType.findUnique.mockResolvedValue(deletedFieldType as any);
      prismaMock.field.findFirst.mockResolvedValue(null); // Tidak ada lapangan yang menggunakan tipe ini
      prismaMock.fieldType.delete.mockResolvedValue(deletedFieldType as any);
      prismaMock.activityLog.create.mockResolvedValue({ id: 3 } as any);
      
      // Execute
      await fieldTypeController.deleteFieldType(mockRequest as any, mockResponse as Response);

      // Verify - sesuaikan dengan implementasi sebenarnya
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({
        status: true,
        message: 'Berhasil menghapus tipe lapangan'
      }));
    });

    it('seharusnya menolak jika tipe lapangan sedang digunakan', async () => {
      // Setup
      mockRequest.params = { id: '3' };
      const existingFieldType = { id: 3, name: 'Tennis' };
      const fieldUsingType = { id: 1, name: 'Tennis Court', typeId: 3 };
      
      prismaMock.fieldType.findUnique.mockResolvedValue(existingFieldType as any);
      prismaMock.field.findFirst.mockResolvedValue(fieldUsingType as any);
      
      // Execute
      await fieldTypeController.deleteFieldType(mockRequest as any, mockResponse as Response);

      // Verify
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({
        status: false,
        message: 'Tidak dapat menghapus tipe lapangan yang sedang digunakan'
      }));
    });

    it('seharusnya mengembalikan 404 jika tipe lapangan tidak ditemukan', async () => {
      // Setup
      mockRequest.params = { id: '999' };
      prismaMock.fieldType.findUnique.mockResolvedValue(null);

      // Execute
      await fieldTypeController.deleteFieldType(mockRequest as any, mockResponse as Response);

      // Verify
      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({
        status: false,
        message: 'Tipe lapangan tidak ditemukan'
      }));
    });
  });
}); 