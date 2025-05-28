// @ts-nocheck
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { Request, Response } from 'express';
import { unitTestSetup } from '../../core';

// Setup unit test untuk controller
const { prismaMock } = unitTestSetup.setupControllerTest();

// Import controller setelah menyiapkan mock
import { getAllFields, getBranchFields, getFieldById } from '../../../src/controllers/field.controller';

describe('Field Controller', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let responseJson: jest.Mock;
  let responseStatus: jest.Mock;
  
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Setup response mock
    responseJson = jest.fn().mockReturnThis();
    responseStatus = jest.fn().mockReturnThis();
    
    mockResponse = {
      json: responseJson as any,
      status: responseStatus as any,
      headersSent: false
    };
    
    mockRequest = {
      params: {},
      query: {},
      body: {}
    };
  });

  describe('getAllFields', () => {
    it('seharusnya mengembalikan semua field dengan pagination default', async () => {
      // Mock data
      const mockFields = [
        { id: 1, name: 'Lapangan A', branchId: 1, typeId: 1 },
        { id: 2, name: 'Lapangan B', branchId: 1, typeId: 2 }
      ];
      
      // Mock implementations
      (prismaMock.field.count as jest.Mock).mockResolvedValue(2);
      (prismaMock.field.findMany as jest.Mock).mockResolvedValue(mockFields);
      
      // Call function
      await getAllFields(mockRequest as Request, mockResponse as Response);
      
      // Assertions
      expect(prismaMock.field.count).toHaveBeenCalled();
      expect(prismaMock.field.findMany).toHaveBeenCalled();
      expect(responseJson).toHaveBeenCalledWith({
        data: mockFields,
        meta: {
          page: 1,
          limit: 1000,
          totalItems: 2,
          totalPages: 1,
          hasNextPage: false,
          hasPrevPage: false,
        },
      });
    });
    
    it('seharusnya menerapkan filter pencarian berdasarkan parameter query', async () => {
      // Setup request with query params
      mockRequest.query = { q: 'Futsal', branchId: '1', page: '2', limit: '10' };
      
      // Mock data
      const mockFields = [{ id: 3, name: 'Lapangan Futsal', branchId: 1, typeId: 1 }];
      
      // Mock implementations
      (prismaMock.field.count as jest.Mock).mockResolvedValue(15); // Total 15 fields
      (prismaMock.field.findMany as jest.Mock).mockResolvedValue(mockFields);
      
      // Call function
      await getAllFields(mockRequest as Request, mockResponse as Response);
      
      // Assertions
      expect(prismaMock.field.count).toHaveBeenCalledWith({
        where: expect.objectContaining({
          AND: expect.any(Array)
        })
      });
      
      expect(prismaMock.field.findMany).toHaveBeenCalledWith(expect.objectContaining({
        skip: 10, // Page 2 with limit 10
        take: 10,
        where: expect.any(Object)
      }));
      
      expect(responseJson).toHaveBeenCalledWith({
        data: mockFields,
        meta: {
          page: 2,
          limit: 10,
          totalItems: 15,
          totalPages: 2,
          hasNextPage: false,
          hasPrevPage: true,
        },
      });
    });
    
    it('seharusnya menangani error dengan respons 500', async () => {
      // Mock error
      (prismaMock.field.count as jest.Mock).mockRejectedValue(new Error('Database error'));
      
      // Mock console.error
      jest.spyOn(console, 'error').mockImplementation(() => {});
      
      // Call function
      await getAllFields(mockRequest as Request, mockResponse as Response);
      
      // Assertions
      expect(responseStatus).toHaveBeenCalledWith(500);
      expect(responseJson).toHaveBeenCalledWith({ error: 'Internal Server Error' });
    });
  });

  describe('getBranchFields', () => {
    it('seharusnya mengembalikan daftar lapangan pada cabang tertentu', async () => {
      // Setup request with params
      mockRequest.params = { id: '1' };
      
      // Mock data
      const mockBranch = { id: 1, name: 'Cabang A', location: 'Malang' };
      const mockFields = [
        { id: 1, name: 'Lapangan A', branchId: 1, typeId: 1 },
        { id: 2, name: 'Lapangan B', branchId: 1, typeId: 2 }
      ];
      
      // Mock implementations
      (prismaMock.branch.findUnique as jest.Mock).mockResolvedValue(mockBranch);
      (prismaMock.field.findMany as jest.Mock).mockResolvedValue(mockFields);
      
      // Call function
      await getBranchFields(mockRequest as Request, mockResponse as Response);
      
      // Assertions
      expect(prismaMock.branch.findUnique).toHaveBeenCalledWith({
        where: { id: 1 }
      });
      expect(prismaMock.field.findMany).toHaveBeenCalledWith({
        where: { branchId: 1 },
        include: expect.any(Object)
      });
      expect(responseJson).toHaveBeenCalledWith(mockFields);
    });
    
    it('seharusnya mengembalikan error 400 untuk ID cabang tidak valid', async () => {
      // Setup request with invalid ID
      mockRequest.params = { id: 'invalid' };
      
      // Call function
      await getBranchFields(mockRequest as Request, mockResponse as Response);
      
      // Assertions
      expect(responseStatus).toHaveBeenCalledWith(400);
      expect(responseJson).toHaveBeenCalledWith({
        status: false,
        message: 'ID cabang tidak valid'
      });
    });
    
    it('seharusnya mengembalikan error 404 jika cabang tidak ditemukan', async () => {
      // Setup request
      mockRequest.params = { id: '999' };
      
      // Mock implementation
      (prismaMock.branch.findUnique as jest.Mock).mockResolvedValue(null);
      
      // Call function
      await getBranchFields(mockRequest as Request, mockResponse as Response);
      
      // Assertions
      expect(responseStatus).toHaveBeenCalledWith(404);
      expect(responseJson).toHaveBeenCalledWith({
        status: false,
        message: 'Cabang tidak ditemukan'
      });
    });
  });

  describe('getFieldById', () => {
    it('seharusnya mengembalikan detail lapangan berdasarkan ID', async () => {
      // Setup request with params
      mockRequest.params = { id: '1' };
      
      // Mock data
      const mockField = {
        id: 1,
        name: 'Lapangan A',
        branchId: 1,
        typeId: 1,
        type: { id: 1, name: 'Futsal' },
        branch: { id: 1, name: 'Cabang A' }
      };
      
      // Mock implementations
      (prismaMock.field.findUnique as jest.Mock).mockResolvedValue(mockField);
      
      // Call function
      await getFieldById(mockRequest as Request, mockResponse as Response);
      
      // Assertions
      expect(prismaMock.field.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        include: expect.any(Object)
      });

      // Format response sesuai dengan controller
      expect(responseJson).toHaveBeenCalledWith({
        status: true,
        message: 'Berhasil mendapatkan data lapangan',
        data: mockField
      });
    });
    
    it('seharusnya mengembalikan error 404 jika lapangan tidak ditemukan', async () => {
      // Setup request
      mockRequest.params = { id: '999' };
      
      // Mock implementation
      (prismaMock.field.findUnique as jest.Mock).mockResolvedValue(null);
      
      // Call function
      await getFieldById(mockRequest as Request, mockResponse as Response);
      
      // Assertions
      expect(responseStatus).toHaveBeenCalledWith(404);
      expect(responseJson).toHaveBeenCalledWith({
        status: false,
        message: 'Lapangan tidak ditemukan'
      });
    });
  });
}); 