import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import express, { Request, Response, NextFunction } from 'express';
import notificationRoutes from '../../../src/routes/route-lists/notification.routes';
import * as NotificationController from '../../../src/controllers/webhook/notification.controller';

// Mock the controllers
jest.mock('../../../src/controllers/webhook/notification.controller', () => ({
  getNotifications: jest.fn((req: Request, res: Response) => res.json({ 
    status: true, 
    message: 'Berhasil mendapatkan notifikasi',
    data: [] 
  })),
  readNotification: jest.fn((req: Request, res: Response) => res.json({ 
    status: true, 
    message: 'Notifikasi ditandai sebagai telah dibaca',
    data: {}
  })),
}));

// Mock the middlewares
jest.mock('../../../src/middlewares/auth.middleware', () => ({
  auth: jest.fn(() => (req: Request, res: Response, next: NextFunction) => {
    req.user = { id: 1, role: 'user' } as any;
    next();
  }),
}));

describe('Notification Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    
    // Create a new Express app and use the notification routes
    app = express();
    app.use(express.json());
    app.use('/notifications', notificationRoutes);
  });

  describe('GET /user/:userId', () => {
    it('should call getNotifications controller', async () => {
      // Act
      const response = await request(app).get('/notifications/user/1');
      
      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ 
        status: true, 
        message: 'Berhasil mendapatkan notifikasi',
        data: [] 
      });
      expect(NotificationController.getNotifications).toHaveBeenCalled();
    });
  });

  describe('PATCH /:id/read', () => {
    it('should call readNotification controller', async () => {
      // Act
      const response = await request(app).patch('/notifications/1/read');
      
      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ 
        status: true, 
        message: 'Notifikasi ditandai sebagai telah dibaca',
        data: {}
      });
      expect(NotificationController.readNotification).toHaveBeenCalled();
    });
  });
}); 