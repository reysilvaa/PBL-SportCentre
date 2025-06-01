import { describe, it, expect, jest, beforeAll, beforeEach } from '@jest/globals';
import express, { Application } from 'express';
import request from 'supertest';
import fieldReviewRoutes from '../../../src/routes/route-lists/fieldReview.routes';
import errorMiddleware from '../../../src/middlewares/error.middleware';
import prisma from '../../../src/config/services/database';

// Mock dependencies untuk isolasi test integrasi
jest.mock('../../../src/config/services/database', () => {
  const mockReviews = [
    {
      id: 1,
      fieldId: 1,
      userId: 1,
      rating: 5,
      review: 'Lapangan sangat bagus',
      createdAt: new Date(),
      field: {
        id: 1,
        name: 'Lapangan Futsal A'
      },
      user: {
        id: 1,
        name: 'User Test'
      }
    }
  ];
  
  return {
    fieldReview: {
      findMany: jest.fn().mockResolvedValue(mockReviews),
      findUnique: jest.fn().mockImplementation((args: any) => {
        if (args.where.id === 1) {
          return Promise.resolve({
            id: 1,
            fieldId: 1,
            userId: 1,
            rating: 5,
            review: 'Lapangan sangat bagus',
            createdAt: new Date()
          });
        }
        return Promise.resolve(null);
      }),
      create: jest.fn().mockResolvedValue({
        id: 1,
        fieldId: 1,
        userId: 1,
        rating: 5,
        review: 'Lapangan sangat bagus',
        createdAt: new Date()
      }),
      update: jest.fn().mockResolvedValue({
        id: 1,
        fieldId: 1,
        userId: 1,
        rating: 5,
        review: 'Lapangan sangat bagus setelah diupdate',
        createdAt: new Date()
      }),
      delete: jest.fn().mockResolvedValue({
        id: 1,
        fieldId: 1,
        userId: 1,
        rating: 5,
        review: 'Lapangan sangat bagus',
        createdAt: new Date()
      })
    },
    field: {
      findUnique: jest.fn().mockImplementation((args: any) => {
        if (args.where.id === 999) {
          return Promise.resolve(null);
        }
        return Promise.resolve({
          id: args.where.id,
          name: 'Lapangan Futsal A'
        });
      })
    },
    booking: {
      findFirst: jest.fn().mockImplementation((args: any) => {
        if (args.where.fieldId === 1 && args.where.userId === 1) {
          return Promise.resolve({
            id: 1,
            fieldId: 1,
            userId: 1
          });
        }
        return Promise.resolve(null);
      })
    }
  };
});

// Mock auth middleware
jest.mock('../../../src/middlewares/auth.middleware', () => ({
  auth: jest.fn().mockImplementation(() => (req: any, _res: any, next: any) => {
    req.user = { id: 1, role: 'user' };
    next();
  })
}));

let app: Application;

beforeAll(() => {
  app = express();
  app.use(express.json());
  app.use('/api/field-reviews', fieldReviewRoutes);
  app.use(errorMiddleware as express.ErrorRequestHandler);
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Field Review API Integration Tests', () => {
  describe('GET /api/field-reviews', () => {
    it('should return all field reviews with pagination', async () => {
      const response = await request(app).get('/api/field-reviews');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', true);
      expect(response.body).toHaveProperty('message', 'Berhasil mendapatkan data ulasan lapangan');
      expect(response.body).toHaveProperty('data');
      expect(prisma.fieldReview.findMany).toHaveBeenCalled();
    });
  });
  
  describe('POST /api/field-reviews', () => {
    it('should create a new field review', async () => {
      // Memastikan mock mengembalikan nilai yang benar
      (prisma.fieldReview.create as jest.Mock).mockResolvedValueOnce({
        id: 1,
        fieldId: 1,
        userId: 1,
        rating: 5,
        review: 'Lapangan sangat bagus',
        createdAt: new Date()
      });
      
      const response = await request(app)
        .post('/api/field-reviews')
        .send({
          fieldId: 1,
          rating: 5,
          review: 'Lapangan sangat bagus'
        });
      
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('status', true);
      expect(response.body).toHaveProperty('message', 'Berhasil membuat ulasan lapangan');
      expect(prisma.fieldReview.create).toHaveBeenCalled();
    });
    
    it('should return 404 if field does not exist', async () => {
      // Mock field tidak ditemukan
      (prisma.field.findUnique as jest.Mock).mockResolvedValueOnce(null);
      
      const response = await request(app)
        .post('/api/field-reviews')
        .send({
          fieldId: 999,
          rating: 5,
          review: 'Lapangan tidak ada'
        });
      
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('status', false);
      expect(response.body).toHaveProperty('message', 'Lapangan tidak ditemukan');
    });
  });
  
  describe('PUT /api/field-reviews/:id', () => {
    it('should update a field review', async () => {
      // Mock untuk update berhasil
      (prisma.fieldReview.update as jest.Mock).mockResolvedValueOnce({
        id: 1,
        fieldId: 1,
        userId: 1,
        rating: 5,
        review: 'Lapangan sangat bagus setelah diupdate',
        createdAt: new Date()
      });
      
      const response = await request(app)
        .put('/api/field-reviews/1')
        .send({
          rating: 5,
          review: 'Lapangan sangat bagus setelah diupdate'
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', true);
      expect(response.body).toHaveProperty('message', 'Berhasil memperbarui ulasan lapangan');
      expect(prisma.fieldReview.update).toHaveBeenCalled();
    });
    
    it('should return 404 if field review not found', async () => {
      // Mock review tidak ditemukan
      (prisma.fieldReview.findUnique as jest.Mock).mockResolvedValueOnce(null);
      
      const response = await request(app)
        .put('/api/field-reviews/999')
        .send({
          rating: 5,
          review: 'Update review yang tidak ada'
        });
      
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('status', false);
      expect(response.body).toHaveProperty('message', 'Ulasan tidak ditemukan');
    });
  });
  
  describe('DELETE /api/field-reviews/:id', () => {
    it('should delete a field review', async () => {
      // Mock untuk delete berhasil
      (prisma.fieldReview.findUnique as jest.Mock).mockResolvedValueOnce({
        id: 1,
        fieldId: 1,
        userId: 1,
        rating: 5,
        review: 'Lapangan sangat bagus',
        createdAt: new Date()
      });
      
      (prisma.fieldReview.delete as jest.Mock).mockResolvedValueOnce({
        id: 1,
        fieldId: 1,
        userId: 1,
        rating: 5,
        review: 'Lapangan sangat bagus',
        createdAt: new Date()
      });
      
      const response = await request(app)
        .delete('/api/field-reviews/1');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', true);
      expect(response.body).toHaveProperty('message', 'Berhasil menghapus ulasan lapangan');
      expect(prisma.fieldReview.delete).toHaveBeenCalled();
    });
    
    it('should return 404 if field review not found', async () => {
      // Mock review tidak ditemukan
      (prisma.fieldReview.findUnique as jest.Mock).mockResolvedValueOnce(null);
      
      const response = await request(app)
        .delete('/api/field-reviews/999');
      
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('status', false);
      expect(response.body).toHaveProperty('message', 'Ulasan tidak ditemukan');
    });
  });
}); 