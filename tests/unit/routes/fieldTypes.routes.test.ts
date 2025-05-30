import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import express, { Request, Response, NextFunction } from 'express';
import fieldTypeRoutes from '../../../src/routes/route-lists/fieldTypes.routes';
import * as FieldTypeController from '../../../src/controllers/fieldType.controller';

// Mock the controllers
jest.mock('../../../src/controllers/fieldType.controller', () => ({
  getFieldTypes: jest.fn((req: Request, res: Response) => res.json({ status: true, fieldTypes: [] })),
  createFieldType: jest.fn((req: Request, res: Response) => res.json({ status: true, message: 'Field type created' })),
  updateFieldType: jest.fn((req: Request, res: Response) => res.json({ status: true, message: 'Field type updated' })),
  deleteFieldType: jest.fn((req: Request, res: Response) => res.json({ status: true, message: 'Field type deleted' })),
}));

// Mock the middlewares
jest.mock('../../../src/middlewares/auth.middleware', () => ({
  auth: jest.fn(() => (req: Request, res: Response, next: NextFunction) => {
    req.user = { id: 1, role: 'super_admin' } as any;
    next();
  }),
}));

jest.mock('../../../src/utils/cache.utils', () => ({
  cacheMiddleware: jest.fn((_key: string, _ttl: number) => (req: Request, res: Response, next: NextFunction) => next()),
}));

jest.mock('../../../src/middlewares/parseId.middleware', () => ({
  parseIds: jest.fn((req: Request, res: Response, next: NextFunction) => next()),
}));

describe('Field Type Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    
    // Create a new Express app and use the field type routes
    app = express();
    app.use(express.json());
    app.use('/field-types', fieldTypeRoutes);
  });

  describe('GET /', () => {
    it('should call getFieldTypes controller', async () => {
      // Act
      const response = await request(app).get('/field-types');
      
      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: true, fieldTypes: [] });
      expect(FieldTypeController.getFieldTypes).toHaveBeenCalled();
    });
  });

  describe('POST /', () => {
    it('should call createFieldType controller', async () => {
      // Arrange
      const typeData = {
        name: 'Test Type',
        description: 'A test field type'
      };
      
      // Act
      const response = await request(app)
        .post('/field-types')
        .send(typeData);
      
      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: true, message: 'Field type created' });
      expect(FieldTypeController.createFieldType).toHaveBeenCalled();
    });
  });

  describe('PUT /:id', () => {
    it('should call updateFieldType controller', async () => {
      // Arrange
      const typeData = {
        name: 'Updated Type',
        description: 'An updated field type'
      };
      
      // Act
      const response = await request(app)
        .put('/field-types/1')
        .send(typeData);
      
      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: true, message: 'Field type updated' });
      expect(FieldTypeController.updateFieldType).toHaveBeenCalled();
    });
  });

  describe('DELETE /:id', () => {
    it('should call deleteFieldType controller', async () => {
      // Act
      const response = await request(app).delete('/field-types/1');
      
      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: true, message: 'Field type deleted' });
      expect(FieldTypeController.deleteFieldType).toHaveBeenCalled();
    });
  });
}); 