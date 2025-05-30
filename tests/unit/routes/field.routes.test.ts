import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import express, { Request, Response, NextFunction } from 'express';
import fieldRoutes from '../../../src/routes/route-lists/field.routes';
import * as FieldController from '../../../src/controllers/field.controller';
import * as AvailabilityController from '../../../src/controllers/availability.controller';

// Extend Request type to include userBranch
declare global {
  namespace Express {
    interface Request {
      userBranch?: {
        id: number;
        name: string;
      };
    }
  }
}

// Mock the controllers
jest.mock('../../../src/controllers/field.controller', () => ({
  getAllFields: jest.fn((req: Request, res: Response) => res.json({ status: true, fields: [] })),
  getBranchFields: jest.fn((req: Request, res: Response) => res.json({ status: true, fields: [] })),
  createField: jest.fn((req: Request, res: Response) => res.json({ status: true, message: 'Field created' })),
  updateField: jest.fn((req: Request, res: Response) => res.json({ status: true, message: 'Field updated' })),
  deleteField: jest.fn((req: Request, res: Response) => res.json({ status: true, message: 'Field deleted' })),
  getFieldById: jest.fn((req: Request, res: Response) => res.json({ status: true, field: {} })),
}));

jest.mock('../../../src/controllers/availability.controller', () => ({
  checkAllFieldsAvailability: jest.fn((req: Request, res: Response) => res.json({ status: true, availability: [] })),
}));

// Mock the middlewares
jest.mock('../../../src/middlewares/auth.middleware', () => ({
  auth: jest.fn(() => (req: Request, res: Response, next: NextFunction) => {
    req.user = { id: 1, role: 'super_admin' } as any;
    req.userBranch = { id: 1, name: 'Test Branch' };
    next();
  }),
}));

jest.mock('../../../src/utils/cache.utils', () => ({
  cacheMiddleware: jest.fn((_key: string, _ttl: number) => (req: Request, res: Response, next: NextFunction) => next()),
}));

jest.mock('../../../src/middlewares/parseId.middleware', () => ({
  parseIds: jest.fn((req: Request, res: Response, next: NextFunction) => next()),
}));

jest.mock('../../../src/middlewares/multer.middleware', () => ({
  fieldUpload: {
    single: jest.fn(() => (req: Request, res: Response, next: NextFunction) => {
      req.file = {
        path: 'uploads/test-image.jpg',
        filename: 'test-image.jpg'
      } as any;
      next();
    }),
  },
}));

describe('Field Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    
    // Create a new Express app and use the field routes
    app = express();
    app.use(express.json());
    app.use('/fields', fieldRoutes);
  });

  describe('GET /', () => {
    it('should call getAllFields controller', async () => {
      // Act
      const response = await request(app).get('/fields');
      
      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: true, fields: [] });
      expect(FieldController.getAllFields).toHaveBeenCalled();
    });
  });

  describe('GET /availability', () => {
    it('should call checkAllFieldsAvailability controller', async () => {
      // Act
      const response = await request(app).get('/fields/availability');
      
      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: true, availability: [] });
      expect(AvailabilityController.checkAllFieldsAvailability).toHaveBeenCalled();
    });
  });

  describe('GET /:id', () => {
    it('should call getFieldById controller', async () => {
      // Act
      const response = await request(app).get('/fields/1');
      
      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: true, field: {} });
      expect(FieldController.getFieldById).toHaveBeenCalled();
    });
  });

  describe('GET /admin', () => {
    it('should call getBranchFields controller for admin', async () => {
      // Act
      const response = await request(app).get('/fields/admin');
      
      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: true, field: {} });
      expect(FieldController.getFieldById).toHaveBeenCalled();
    });
  });

  describe('POST /', () => {
    it('should call createField controller', async () => {
      // Arrange
      const fieldData = {
        name: 'Test Field',
        price: 100000,
        description: 'A test field',
        branchId: 1,
        typeId: 1
      };
      
      // Act
      const response = await request(app)
        .post('/fields')
        .send(fieldData);
      
      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: true, message: 'Field created' });
      expect(FieldController.createField).toHaveBeenCalled();
    });
  });

  describe('PUT /:id', () => {
    it('should call updateField controller', async () => {
      // Arrange
      const fieldData = {
        name: 'Updated Field',
        price: 150000,
        description: 'An updated test field'
      };
      
      // Act
      const response = await request(app)
        .put('/fields/1')
        .send(fieldData);
      
      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: true, message: 'Field updated' });
      expect(FieldController.updateField).toHaveBeenCalled();
    });
  });

  describe('DELETE /:id', () => {
    it('should call deleteField controller', async () => {
      // Act
      const response = await request(app).delete('/fields/1');
      
      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: true, message: 'Field deleted' });
      expect(FieldController.deleteField).toHaveBeenCalled();
    });
  });
}); 