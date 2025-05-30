import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import express, { Request, Response, NextFunction } from 'express';
import authRoutes from '../../../src/routes/route-lists/auth.routes';
import * as AuthController from '../../../src/controllers/auth.controller';

// Mock the controllers
jest.mock('../../../src/controllers/auth.controller', () => ({
  login: jest.fn((_req: Request, res: Response) => res.json({ status: true, user: {}, token: 'test-token' })),
  register: jest.fn((_req: Request, res: Response) => res.json({ status: true, user: {}, token: 'test-token' })),
  logout: jest.fn((_req: Request, res: Response) => res.json({ status: true, message: 'Logout successful' })),
  refreshToken: jest.fn((_req: Request, res: Response) => res.json({ status: true, token: 'new-test-token' })),
  getAuthStatus: jest.fn((_req: Request, res: Response) => res.json({ status: true, isAuthenticated: true })),
}));

// Mock the middlewares
jest.mock('../../../src/middlewares/auth.middleware', () => ({
  auth: jest.fn(() => (req: Request, res: Response, next: NextFunction) => {
    req.user = { id: 1, role: 'user' } as any;
    next();
  }),
}));

jest.mock('../../../src/middlewares/security.middleware', () => ({
  loginRateLimiter: jest.fn((req: Request, res: Response, next: NextFunction) => next()),
  registerRateLimiter: jest.fn((req: Request, res: Response, next: NextFunction) => next()),
}));

describe('Auth Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    
    // Create a new Express app and use the auth routes
    app = express();
    app.use(express.json());
    app.use('/auth', authRoutes);
  });

  describe('POST /login', () => {
    it('should call login controller with credentials', async () => {
      // Arrange
      const credentials = { email: 'test@example.com', password: 'password123' };
      
      // Act
      const response = await request(app)
        .post('/auth/login')
        .send(credentials);
      
      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: true, user: {}, token: 'test-token' });
      expect(AuthController.login).toHaveBeenCalled();
    });
  });

  describe('POST /register', () => {
    it('should call register controller with user data', async () => {
      // Arrange
      const userData = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
        phone: '1234567890'
      };
      
      // Act
      const response = await request(app)
        .post('/auth/register')
        .send(userData);
      
      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: true, user: {}, token: 'test-token' });
      expect(AuthController.register).toHaveBeenCalled();
    });
  });

  describe('POST /logout', () => {
    it('should call logout controller', async () => {
      // Act
      const response = await request(app).post('/auth/logout');
      
      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: true, message: 'Logout successful' });
      expect(AuthController.logout).toHaveBeenCalled();
    });
  });

  describe('POST /refresh-token', () => {
    it('should call refreshToken controller', async () => {
      // Act
      const response = await request(app).post('/auth/refresh-token');
      
      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: true, token: 'new-test-token' });
      expect(AuthController.refreshToken).toHaveBeenCalled();
    });
  });

  describe('GET /status', () => {
    it('should call getAuthStatus controller', async () => {
      // Act
      const response = await request(app).get('/auth/status');
      
      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: true, isAuthenticated: true });
      expect(AuthController.getAuthStatus).toHaveBeenCalled();
    });
  });
}); 