import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import express, { Request, Response, NextFunction } from 'express';
import bookingRoutes from '../../../src/routes/route-lists/booking.routes';
import * as BookingController from '../../../src/controllers/booking.controller';

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

// Mock controllers
jest.mock('../../../src/controllers/booking.controller', () => ({
  createBooking: jest.fn((req: Request, res: Response) => res.json({ status: true, message: 'Booking created' })),
  getUserBookings: jest.fn((req: Request, res: Response) => res.json({ status: true, bookings: [] })),
  getBookingById: jest.fn((req: Request, res: Response) => res.json({ status: true, booking: { id: '1' } })),
  cancelBooking: jest.fn((req: Request, res: Response) => res.json({ status: true, message: 'Booking cancelled' })),
  getBranchBookings: jest.fn((req: Request, res: Response) => res.json({ status: true, bookings: [] })),
  getBranchBookingById: jest.fn((req: Request, res: Response) => res.json({ status: true, booking: { id: '1' } })),
  updateBranchBookingStatus: jest.fn((req: Request, res: Response) => res.json({ status: true, message: 'Status updated' })),
  createManualBooking: jest.fn((req: Request, res: Response) => res.json({ status: true, message: 'Manual booking created' })),
  getAllBookings: jest.fn((req: Request, res: Response) => res.json({ status: true, bookings: [] })),
  updateBookingPayment: jest.fn((req: Request, res: Response) => res.json({ status: true, message: 'Payment updated' })),
  deleteBooking: jest.fn((req: Request, res: Response) => res.json({ status: true, message: 'Booking deleted' })),
  getBookingStats: jest.fn((req: Request, res: Response) => res.json({ status: true, stats: {} })),
  getRevenueReports: jest.fn((req: Request, res: Response) => res.json({ status: true, reports: [] })),
  getOccupancyReports: jest.fn((req: Request, res: Response) => res.json({ status: true, reports: [] })),
  getBusinessPerformance: jest.fn((req: Request, res: Response) => res.json({ status: true, performance: {} })),
  getBookingForecast: jest.fn((req: Request, res: Response) => res.json({ status: true, forecast: [] })),
}));

// Mock middlewares
jest.mock('../../../src/middlewares/auth.middleware', () => ({
  userAuth: jest.fn(() => (req: Request, res: Response, next: NextFunction) => {
    req.user = { id: 1, role: 'user' } as any;
    next();
  }),
  branchAdminAuth: jest.fn(() => (req: Request, res: Response, next: NextFunction) => {
    req.user = { id: 1, role: 'admin_cabang' } as any;
    req.userBranch = { id: 1, name: 'Test Branch' };
    next();
  }),
  superAdminAuth: jest.fn(() => (req: Request, res: Response, next: NextFunction) => {
    req.user = { id: 1, role: 'super_admin' } as any;
    next();
  }),
  ownerAuth: jest.fn(() => (req: Request, res: Response, next: NextFunction) => {
    req.user = { id: 1, role: 'owner_cabang' } as any;
    req.userBranch = { id: 1, name: 'Test Branch' };
    next();
  }),
}));

jest.mock('../../../src/utils/cache.utils', () => ({
  cacheMiddleware: jest.fn((_key: string, _ttl: number) => (req: Request, res: Response, next: NextFunction) => next()),
}));

jest.mock('../../../src/middlewares/security.middleware', () => ({
  bookingRateLimiter: jest.fn((req: Request, res: Response, next: NextFunction) => next()),
}));

describe('Booking Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    
    // Create a new Express app and use the booking routes
    app = express();
    app.use(express.json());
    app.use('/bookings', bookingRoutes);
  });

  describe('POST /', () => {
    it('should call createBooking controller', async () => {
      // Arrange
      const bookingData = {
        userId: 1,
        fieldId: 1,
        date: '2023-06-15',
        startTime: '10:00',
        endTime: '12:00',
      };
      
      // Act
      const response = await request(app)
        .post('/bookings')
        .send(bookingData);
      
      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: true, message: 'Booking created' });
      expect(BookingController.createBooking).toHaveBeenCalled();
    });
  });

  describe('GET /users/:userId/bookings', () => {
    it('should call getUserBookings controller', async () => {
      // Act
      const response = await request(app)
        .get('/bookings/users/1/bookings');
      
      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: true, bookings: [] });
      expect(BookingController.getUserBookings).toHaveBeenCalled();
    });
  });

  describe('GET /:id/user', () => {
    it('should call getBookingById controller for user', async () => {
      // Act
      const response = await request(app)
        .get('/bookings/1/user');
      
      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: true, booking: { id: '1' } });
      expect(BookingController.getBookingById).toHaveBeenCalled();
    });
  });

  describe('DELETE /bookings/:id', () => {
    it('should call cancelBooking controller', async () => {
      // Act
      const response = await request(app)
        .delete('/bookings/bookings/1');
      
      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: true, message: 'Booking cancelled' });
      expect(BookingController.cancelBooking).toHaveBeenCalled();
    });
  });

  describe('GET /branches/:branchId/bookings', () => {
    it('should call getBranchBookings controller', async () => {
      // Act
      const response = await request(app)
        .get('/bookings/branches/1/bookings');
      
      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: true, bookings: [] });
      expect(BookingController.getBranchBookings).toHaveBeenCalled();
    });
  });

  describe('PUT /branches/:branchId/bookings/:id/status', () => {
    it('should call updateBranchBookingStatus controller', async () => {
      // Arrange
      const statusData = { status: 'completed' };
      
      // Act
      const response = await request(app)
        .put('/bookings/branches/1/bookings/1/status')
        .send(statusData);
      
      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: true, message: 'Status updated' });
      expect(BookingController.updateBranchBookingStatus).toHaveBeenCalled();
    });
  });

  describe('POST /branches/:branchId/bookings/manual', () => {
    it('should call createManualBooking controller', async () => {
      // Arrange
      const manualBookingData = {
        fieldId: 1,
        date: '2023-06-15',
        startTime: '10:00',
        endTime: '12:00',
        customerName: 'John Doe',
        customerPhone: '123456789',
      };
      
      // Act
      const response = await request(app)
        .post('/bookings/branches/1/bookings/manual')
        .send(manualBookingData);
      
      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: true, message: 'Manual booking created' });
      expect(BookingController.createManualBooking).toHaveBeenCalled();
    });
  });

  describe('GET /admin/bookings', () => {
    it('should call getAllBookings controller', async () => {
      // Act
      const response = await request(app)
        .get('/bookings/admin/bookings');
      
      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: true, bookings: [] });
      expect(BookingController.getAllBookings).toHaveBeenCalled();
    });
  });

  describe('PUT /admin/bookings/:id/payment', () => {
    it('should call updateBookingPayment controller', async () => {
      // Arrange
      const paymentData = { status: 'paid' };
      
      // Act
      const response = await request(app)
        .put('/bookings/admin/bookings/1/payment')
        .send(paymentData);
      
      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: true, message: 'Payment updated' });
      expect(BookingController.updateBookingPayment).toHaveBeenCalled();
    });
  });

  describe('GET /owner/reports/revenue', () => {
    it('should call getRevenueReports controller', async () => {
      // Act
      const response = await request(app)
        .get('/bookings/owner/reports/revenue');
      
      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: true, reports: [] });
      expect(BookingController.getRevenueReports).toHaveBeenCalled();
    });
  });
}); 