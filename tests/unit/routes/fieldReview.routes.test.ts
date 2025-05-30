import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import express, { Request, Response, NextFunction } from 'express';
import fieldReviewRoutes from '../../../src/routes/route-lists/fieldReview.routes';
import * as FieldReviewController from '../../../src/controllers/fieldReview.controller';

// Mock the controllers
jest.mock('../../../src/controllers/fieldReview.controller', () => ({
  getFieldReviews: jest.fn((req: Request, res: Response) => res.json({ status: true, reviews: [] })),
  createFieldReview: jest.fn((req: Request, res: Response) => res.json({ status: true, message: 'Field review created' })),
  updateFieldReview: jest.fn((req: Request, res: Response) => res.json({ status: true, message: 'Field review updated' })),
  deleteFieldReview: jest.fn((req: Request, res: Response) => res.json({ status: true, message: 'Field review deleted' })),
}));

// Mock the middlewares
jest.mock('../../../src/middlewares/auth.middleware', () => ({
  auth: jest.fn(() => (req: Request, res: Response, next: NextFunction) => {
    req.user = { id: 1, role: 'user' } as any;
    next();
  }),
}));

jest.mock('../../../src/utils/cache.utils', () => ({
  cacheMiddleware: jest.fn((_key: string, _ttl: number) => (req: Request, res: Response, next: NextFunction) => next()),
}));

jest.mock('../../../src/middlewares/parseId.middleware', () => ({
  parseIds: jest.fn((req: Request, res: Response, next: NextFunction) => next()),
}));

describe('Field Review Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    
    // Create a new Express app and use the field review routes
    app = express();
    app.use(express.json());
    app.use('/field-reviews', fieldReviewRoutes);
  });

  describe('GET /', () => {
    it('should call getFieldReviews controller', async () => {
      // Act
      const response = await request(app).get('/field-reviews');
      
      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: true, reviews: [] });
      expect(FieldReviewController.getFieldReviews).toHaveBeenCalled();
    });
  });

  describe('POST /', () => {
    it('should call createFieldReview controller', async () => {
      // Arrange
      const reviewData = {
        fieldId: 1,
        userId: 1,
        rating: 5,
        comment: 'Great field!'
      };
      
      // Act
      const response = await request(app)
        .post('/field-reviews')
        .send(reviewData);
      
      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: true, message: 'Field review created' });
      expect(FieldReviewController.createFieldReview).toHaveBeenCalled();
    });
  });

  describe('PUT /:id', () => {
    it('should call updateFieldReview controller', async () => {
      // Arrange
      const reviewData = {
        rating: 4,
        comment: 'Updated review - Good field!'
      };
      
      // Act
      const response = await request(app)
        .put('/field-reviews/1')
        .send(reviewData);
      
      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: true, message: 'Field review updated' });
      expect(FieldReviewController.updateFieldReview).toHaveBeenCalled();
    });
  });

  describe('DELETE /:id', () => {
    it('should call deleteFieldReview controller', async () => {
      // Act
      const response = await request(app).delete('/field-reviews/1');
      
      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: true, message: 'Field review deleted' });
      expect(FieldReviewController.deleteFieldReview).toHaveBeenCalled();
    });
  });
}); 