import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import express, { Request, Response, NextFunction } from 'express';
import branchRoutes from '../../../src/routes/route-lists/branch.routes';
import * as BranchController from '../../../src/controllers/branch.controller';
import * as FieldController from '../../../src/controllers/field.controller';

// Mock the controllers
jest.mock('../../../src/controllers/branch.controller', () => ({
  getBranches: jest.fn((req: Request, res: Response) => res.status(200).json({ status: true, branches: [] })),
  createBranch: jest.fn((req: Request, res: Response) => res.status(201).json({ status: true, message: 'Branch created' })),
  updateBranch: jest.fn((req: Request, res: Response) => res.status(200).json({ status: true, message: 'Branch updated' })),
  deleteBranch: jest.fn((req: Request, res: Response) => res.status(200).json({ status: true, message: 'Branch deleted' })),
  getUserBranches: jest.fn((req: Request, res: Response) => res.status(200).json({ status: true, branches: [] })),
  getBranchAdmins: jest.fn((req: Request, res: Response) => res.status(200).json({ status: true, admins: [] })),
  addBranchAdmin: jest.fn((req: Request, res: Response) => res.status(201).json({ status: true, message: 'Branch admin added' })),
  deleteBranchAdmin: jest.fn((req: Request, res: Response) => res.status(200).json({ status: true, message: 'Branch admin deleted' })),
  getBranchAdminById: jest.fn((req: Request, res: Response) => res.status(200).json({ status: true, admin: {} })),
}));

jest.mock('../../../src/controllers/field.controller', () => ({
  getBranchFields: jest.fn((req: Request, res: Response) => res.status(200).json({ status: true, fields: [] })),
}));

// Mock the middlewares
jest.mock('../../../src/middlewares/auth.middleware', () => ({
  auth: jest.fn(() => (req: Request, res: Response, next: NextFunction) => {
    req.user = { id: 1, role: 'super_admin' } as any;
    next();
  }),
  superAdminAuth: jest.fn(() => (req: Request, res: Response, next: NextFunction) => {
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

jest.mock('../../../src/middlewares/multer.middleware', () => ({
  branchUpload: {
    single: jest.fn(() => (req: Request, res: Response, next: NextFunction) => {
      req.file = {
        path: 'uploads/test-image.jpg',
        filename: 'test-image.jpg'
      } as any;
      next();
    }),
  },
}));

describe('Branch Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    
    // Create a new Express app and use the branch routes
    app = express();
    app.use(express.json());
    app.use('/branches', branchRoutes);
  });

  describe('GET /', () => {
    it('should call getBranches controller', async () => {
      // Act
      const response = await request(app).get('/branches');
      
      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: true, branches: [] });
      expect(BranchController.getBranches).toHaveBeenCalled();
    });
  });

  describe('GET /owner-branches', () => {
    it('should call getUserBranches controller', async () => {
      // Act
      const response = await request(app).get('/branches/owner-branches');
      
      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: true, branches: [] });
      expect(BranchController.getUserBranches).toHaveBeenCalled();
    });
  });

  describe('GET /:id', () => {
    it('should call getBranches controller with id', async () => {
      // Act
      const response = await request(app).get('/branches/1');
      
      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: true, branches: [] });
      expect(BranchController.getBranches).toHaveBeenCalled();
    });
  });

  describe('GET /:id/admins', () => {
    it('should call getBranchAdmins controller', async () => {
      // Act
      const response = await request(app).get('/branches/1/admins');
      
      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: true, admins: [] });
      expect(BranchController.getBranchAdmins).toHaveBeenCalled();
    });
  });

  describe('GET /:id/fields', () => {
    it('should call getBranchFields controller', async () => {
      // Act
      const response = await request(app).get('/branches/1/fields');
      
      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: true, fields: [] });
      expect(FieldController.getBranchFields).toHaveBeenCalled();
    });
  });

  describe('POST /', () => {
    it('should call createBranch controller', async () => {
      // Arrange
      const branchData = {
        name: 'Test Branch',
        address: '123 Test Street',
        ownerId: 1
      };
      
      // Act
      const response = await request(app)
        .post('/branches')
        .send(branchData);
      
      // Assert
      expect(response.status).toBe(201);
      expect(response.body).toEqual({ status: true, message: 'Branch created' });
      expect(BranchController.createBranch).toHaveBeenCalled();
    });
  });

  describe('PUT /:id', () => {
    it('should call updateBranch controller', async () => {
      // Arrange
      const branchData = {
        name: 'Updated Branch',
        address: '456 Updated Street'
      };
      
      // Act
      const response = await request(app)
        .put('/branches/1')
        .send(branchData);
      
      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: true, message: 'Branch updated' });
      expect(BranchController.updateBranch).toHaveBeenCalled();
    });
  });

  describe('DELETE /:id', () => {
    it('should call deleteBranch controller', async () => {
      // Act
      const response = await request(app).delete('/branches/1');
      
      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: true, message: 'Branch deleted' });
      expect(BranchController.deleteBranch).toHaveBeenCalled();
    });
  });

  describe('POST /:id/admins/:userId', () => {
    it('should call addBranchAdmin controller', async () => {
      // Act
      const response = await request(app).post('/branches/1/admins/2');
      
      // Assert
      expect(response.status).toBe(201);
      expect(response.body).toEqual({ status: true, message: 'Branch admin added' });
      expect(BranchController.addBranchAdmin).toHaveBeenCalled();
    });
  });

  describe('DELETE /:id/admins/:userId', () => {
    it('should call deleteBranchAdmin controller', async () => {
      // Act
      const response = await request(app).delete('/branches/1/admins/2');
      
      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: true, message: 'Branch admin deleted' });
      expect(BranchController.deleteBranchAdmin).toHaveBeenCalled();
    });
  });

  describe('GET /:id/admins/:userId', () => {
    it('should call getBranchAdminById controller', async () => {
      // Act
      const response = await request(app).get('/branches/1/admins/2');
      
      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: true, admin: {} });
      expect(BranchController.getBranchAdminById).toHaveBeenCalled();
    });
  });
}); 