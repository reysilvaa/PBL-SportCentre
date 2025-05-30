// @ts-nocheck
import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { getFieldReviews, createFieldReview, updateFieldReview, deleteFieldReview } from '../../../src/controllers/fieldReview.controller';

// Mock the database
jest.mock('../../../src/config/services/database', () => ({
  __esModule: true,
  default: {
    fieldReview: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    field: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    booking: {
      findFirst: jest.fn(),
    },
    activityLog: {
      create: jest.fn(),
    },
  },
}));

// Mock the cache invalidation
jest.mock('../../../src/utils/cache/cacheInvalidation.utils', () => ({
  invalidateFieldReviewCache: jest.fn(),
  invalidateFieldCache: jest.fn(),
}));

// Mock zod schemas
jest.mock('../../../src/zod-schemas/fieldReview.schema', () => ({
  createFieldReviewSchema: {
    safeParse: jest.fn().mockImplementation((data) => ({
      success: true,
      data,
    })),
  },
  updateFieldReviewSchema: {
    safeParse: jest.fn().mockImplementation((data) => ({
      success: true,
      data,
    })),
  },
}));

describe('Field Review Controller', () => {
  let req, res;
  
  beforeEach(() => {
    req = {
      query: {},
      params: {},
      body: {},
      user: { id: 1, role: 'user' },
      ip: '127.0.0.1',
    };
    
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    
    jest.clearAllMocks();
  });
  
  describe('getFieldReviews', () => {
    it('should return all field reviews for a field', async () => {
      req.query = { fieldId: '1' };
      
      const mockReviews = [
        { id: 1, rating: 5, review: 'Great field', userId: 1, fieldId: 1 },
        { id: 2, rating: 4, review: 'Good field', userId: 2, fieldId: 1 },
      ];
      
      const prisma = require('../../../src/config/services/database').default;
      prisma.fieldReview.findMany.mockResolvedValue(mockReviews);
      
      await getFieldReviews(req, res);
      
      expect(prisma.fieldReview.findMany).toHaveBeenCalledWith({
        where: { fieldId: 1 },
        include: {
          user: {
            select: {
              id: true,
              name: true,
            },
          },
          field: {
            select: {
              id: true,
              name: true,
              branch: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        status: true,
        message: 'Berhasil mendapatkan data ulasan lapangan',
        data: mockReviews,
      });
    });
    
    it('should handle errors', async () => {
      req.query = { fieldId: '1' };
      
      const prisma = require('../../../src/config/services/database').default;
      prisma.fieldReview.findMany.mockRejectedValue(new Error('Database error'));
      
      await getFieldReviews(req, res);
      
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        status: false,
        message: 'Internal Server Error',
      });
    });
  });
  
  describe('createFieldReview', () => {
    it('should create a new field review', async () => {
      req.body = {
        fieldId: 1,
        rating: 5,
        review: 'Great field',
      };
      
      const mockField = { id: 1, name: 'Test Field', branchId: 1 };
      const mockBooking = { id: 1, userId: 1, fieldId: 1 };
      const mockReview = { 
        id: 1, 
        fieldId: 1, 
        userId: 1, 
        rating: 5, 
        review: 'Great field',
        user: { name: 'Test User' },
        field: { name: 'Test Field' }
      };
      
      const prisma = require('../../../src/config/services/database').default;
      prisma.field.findUnique.mockResolvedValue(mockField);
      prisma.booking.findFirst.mockResolvedValue(mockBooking);
      prisma.fieldReview.findFirst.mockResolvedValue(null); // No existing review
      prisma.fieldReview.create.mockResolvedValue(mockReview);
      
      await createFieldReview(req, res);
      
      expect(prisma.fieldReview.create).toHaveBeenCalledWith({
        data: {
          fieldId: 1,
          userId: 1,
          rating: 5,
          review: 'Great field',
        },
        include: {
          user: {
            select: {
              name: true,
            },
          },
          field: {
            select: {
              name: true,
            },
          },
        },
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        status: true,
        message: 'Berhasil membuat ulasan lapangan',
        data: mockReview,
      });
    });
    
    it('should return 400 if user has not booked the field', async () => {
      req.body = {
        fieldId: 1,
        rating: 5,
        review: 'Great field',
      };
      
      const mockField = { id: 1, name: 'Test Field', branchId: 1 };
      
      const prisma = require('../../../src/config/services/database').default;
      prisma.field.findUnique.mockResolvedValue(mockField);
      prisma.booking.findFirst.mockResolvedValue(null); // No booking found
      
      await createFieldReview(req, res);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        status: false,
        message: 'Anda harus melakukan booking terlebih dahulu untuk memberikan ulasan',
      });
    });
    
    it('should return 400 if user has already reviewed the field', async () => {
      req.body = {
        fieldId: 1,
        rating: 5,
        review: 'Great field',
      };
      
      const mockField = { id: 1, name: 'Test Field', branchId: 1 };
      const mockBooking = { id: 1, userId: 1, fieldId: 1 };
      const existingReview = { id: 1, userId: 1, fieldId: 1 };
      
      const prisma = require('../../../src/config/services/database').default;
      prisma.field.findUnique.mockResolvedValue(mockField);
      prisma.booking.findFirst.mockResolvedValue(mockBooking);
      prisma.fieldReview.findFirst.mockResolvedValue(existingReview); // Existing review found
      
      await createFieldReview(req, res);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        status: false,
        message: 'Anda sudah memberikan ulasan untuk lapangan ini',
      });
    });
    
    it('should handle errors', async () => {
      req.body = {
        fieldId: 1,
        rating: 5,
        review: 'Great field',
      };
      
      const prisma = require('../../../src/config/services/database').default;
      prisma.field.findUnique.mockRejectedValue(new Error('Database error'));
      
      await createFieldReview(req, res);
      
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        status: false,
        message: 'Internal Server Error',
      });
    });
  });
  
  describe('updateFieldReview', () => {
    it('should update a field review', async () => {
      req.params.id = '1';
      req.body = {
        rating: 4,
        review: 'Updated review',
      };
      
      const existingReview = { id: 1, userId: 1, fieldId: 1, field: { name: 'Test Field' } };
      const updatedReview = { 
        id: 1, 
        userId: 1, 
        fieldId: 1, 
        rating: 4, 
        review: 'Updated review',
        user: { name: 'Test User' },
        field: { name: 'Test Field' }
      };
      
      const prisma = require('../../../src/config/services/database').default;
      prisma.fieldReview.findUnique.mockResolvedValue(existingReview);
      prisma.fieldReview.update.mockResolvedValue(updatedReview);
      
      await updateFieldReview(req, res);
      
      expect(prisma.fieldReview.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          rating: 4,
          review: 'Updated review',
        },
        include: {
          user: {
            select: {
              name: true,
            },
          },
          field: {
            select: {
              name: true,
            },
          },
        },
      });
    });
    
    it('should return 404 if field review not found', async () => {
      req.params.id = '999';
      req.body = {
        rating: 4,
        review: 'Updated review',
      };
      
      const prisma = require('../../../src/config/services/database').default;
      prisma.fieldReview.findUnique.mockResolvedValue(null);
      
      await updateFieldReview(req, res);
      
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        status: false,
        message: 'Ulasan tidak ditemukan',
      });
    });
    
    it('should return 403 if user is not the author of the review', async () => {
      req.params.id = '1';
      req.body = {
        rating: 4,
        review: 'Updated review',
      };
      req.user.id = 2; // Different user
      
      const existingReview = { id: 1, userId: 1, fieldId: 1 };
      
      const prisma = require('../../../src/config/services/database').default;
      prisma.fieldReview.findUnique.mockResolvedValue(existingReview);
      
      await updateFieldReview(req, res);
      
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        status: false,
        message: 'Anda tidak memiliki izin untuk mengubah ulasan ini',
      });
    });
    
    it('should handle errors', async () => {
      req.params.id = '1';
      req.body = {
        rating: 4,
        review: 'Updated review',
      };
      
      const prisma = require('../../../src/config/services/database').default;
      prisma.fieldReview.findUnique.mockRejectedValue(new Error('Database error'));
      
      await updateFieldReview(req, res);
      
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        status: false,
        message: 'Internal Server Error',
      });
    });
  });
  
  describe('deleteFieldReview', () => {
    it('should delete a field review', async () => {
      req.params.id = '1';
      
      const existingReview = { id: 1, userId: 1, fieldId: 1, field: { name: 'Test Field' } };
      
      const prisma = require('../../../src/config/services/database').default;
      prisma.fieldReview.findUnique.mockResolvedValue(existingReview);
      prisma.fieldReview.delete.mockResolvedValue(existingReview);
      
      await deleteFieldReview(req, res);
      
      expect(prisma.fieldReview.delete).toHaveBeenCalledWith({
        where: { id: 1 },
      });
    });
    
    it('should return 404 if field review not found', async () => {
      req.params.id = '999';
      
      const prisma = require('../../../src/config/services/database').default;
      prisma.fieldReview.findUnique.mockResolvedValue(null);
      
      await deleteFieldReview(req, res);
      
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        status: false,
        message: 'Ulasan tidak ditemukan',
      });
    });
    
    it('should handle errors', async () => {
      req.params.id = '1';
      
      const prisma = require('../../../src/config/services/database').default;
      prisma.fieldReview.findUnique.mockRejectedValue(new Error('Database error'));
      
      await deleteFieldReview(req, res);
      
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        status: false,
        message: 'Internal Server Error',
      });
    });
  });
}); 