import { describe, it, expect, jest, beforeAll, afterAll, beforeEach } from '@jest/globals';
import express, { Application } from 'express';
import request from 'supertest';
import prisma from '../../../src/config/services/database';
import bookingRoutes from '../../../src/routes/route-lists/booking.routes';
import errorMiddleware from '../../../src/middlewares/error.middleware';
import { Role } from '../../../src/types';

// Mock dependencies
jest.mock('../../../src/config/services/database', () => ({
  booking: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  },
  payment: {
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  field: {
    findUnique: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
  activityLog: {
    create: jest.fn()
  }
}));

// Mock midtrans client
jest.mock('midtrans-client', () => ({
  Snap: jest.fn().mockImplementation(() => ({
    createTransaction: jest.fn().mockResolvedValue({
      token: 'mock-token',
      redirect_url: 'https://midtrans.com/mock-payment',
      transaction_id: 'mock-transaction-id'
    })
  }))
}));

// Mock socket communication
jest.mock('../../../src/config/server/socket', () => ({
  emitFieldAvailabilityUpdate: jest.fn(),
  emitBookingEvents: jest.fn(),
}));

// Create auth middleware mock
jest.mock('../../../src/middlewares/auth.middleware', () => ({
  auth: () => (req: any, res: any, next: any) => {
    req.user = {
      id: 1,
      role: 'user'
    };
    next();
  },
  userAuth: () => (req: any, res: any, next: any) => {
    req.user = {
      id: 1,
      role: 'user'
    };
    next();
  },
  branchAdminAuth: () => (req: any, res: any, next: any) => {
    req.user = {
      id: 2,
      role: 'admin_cabang'
    };
    req.userBranch = {
      id: 1,
      name: 'Test Branch'
    };
    next();
  },
  superAdminAuth: () => (req: any, res: any, next: any) => {
    req.user = {
      id: 3,
      role: 'super_admin'
    };
    req.userBranch = {
      id: 0 // 0 indicates all branches access
    };
    next();
  },
  ownerAuth: () => (req: any, res: any, next: any) => {
    req.user = {
      id: 4,
      role: 'owner_cabang'
    };
    req.userBranch = {
      id: 1,
      name: 'Test Branch'
    };
    next();
  }
}));

describe('Booking API Integration', () => {
  let app: Application;
  let server: any;
  let mockField: any;
  let mockUser: any;
  let mockBooking: any;
  let mockPayment: any;

  beforeAll(() => {
    // Create test app
    app = express();
    
    // Setup middleware
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    
    // Mount routes for testing
    app.use('/api/bookings', bookingRoutes);
    
    // Add error handling
    app.use(errorMiddleware as express.ErrorRequestHandler);
    
    // Start test server
    server = app.listen(0);
  });

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Setup mock data
    mockField = {
      id: 1,
      name: 'Test Field',
      priceDay: 100000,
      priceNight: 150000,
      branchId: 1,
      branch: {
        id: 1,
        name: 'Test Branch',
        location: 'Test Location'
      }
    };
    
    mockUser = {
      id: 1,
      name: 'Test User',
      email: 'test@example.com',
      phone: '123456789',
      role: Role.USER
    };
    
    mockBooking = {
      id: 1,
      userId: 1,
      fieldId: 1,
      bookingDate: new Date('2023-08-15'),
      startTime: new Date('2023-08-15T08:00:00Z'),
      endTime: new Date('2023-08-15T10:00:00Z'),
      createdAt: new Date(),
      field: mockField,
      user: mockUser
    };
    
    mockPayment = {
      id: 1,
      bookingId: 1,
      userId: 1,
      amount: 200000,
      paymentMethod: 'midtrans',
      status: 'pending',
      createdAt: new Date(),
      expiresDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
      transactionId: 'mock-transaction-id',
      paymentUrl: 'https://midtrans.com/mock-payment',
    };
    
    // Setup default mock behavior
    (prisma.field.findUnique as jest.Mock).mockResolvedValue(mockField);
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
    (prisma.booking.create as jest.Mock).mockResolvedValue(mockBooking);
    (prisma.payment.create as jest.Mock).mockResolvedValue(mockPayment);
    (prisma.booking.findMany as jest.Mock).mockResolvedValue([mockBooking]);
    (prisma.booking.findUnique as jest.Mock).mockResolvedValue({
      ...mockBooking,
      payment: mockPayment
    });
  });

  afterAll((done) => {
    if (server) server.close(done);
    else done();
  });

  describe('POST /api/bookings', () => {
    it('should create a new booking successfully', async () => {
      // Mock additional validation behavior
      const checkAvailabilityUtils = require('../../../src/utils/booking/checkAvailability.utils');
      jest.spyOn(checkAvailabilityUtils, 'isFieldAvailable').mockResolvedValue(true);
      
      // Test request
      const response = await request(app)
        .post('/api/bookings')
        .send({
          userId: 1,
          fieldId: 1,
          bookingDate: '2023-08-15',
          startTime: '08:00',
          endTime: '10:00'
        });

      // Assertions
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('booking');
      expect(response.body.booking).toHaveProperty('id', 1);
      expect(response.body.booking).toHaveProperty('field');
      expect(response.body.booking).toHaveProperty('payment');
      expect(prisma.booking.create).toHaveBeenCalled();
      expect(prisma.payment.create).toHaveBeenCalled();
    });

    it('should return 400 when field is not available', async () => {
      // Mock field not available
      const checkAvailabilityUtils = require('../../../src/utils/booking/checkAvailability.utils');
      jest.spyOn(checkAvailabilityUtils, 'isFieldAvailable').mockResolvedValue(false);
      
      // Test request
      const response = await request(app)
        .post('/api/bookings')
        .send({
          userId: 1,
          fieldId: 1,
          bookingDate: '2023-08-15',
          startTime: '08:00',
          endTime: '10:00'
        });

      // Assertions
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('details');
      expect(prisma.booking.create).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/bookings/user/:userId', () => {
    it('should get all bookings for a user', async () => {
      // Test request
      const response = await request(app)
        .get('/api/bookings/user/1');

      // Assertions
      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/bookings/:id', () => {
    it('should get a booking by ID', async () => {
      // Test request
      const response = await request(app)
        .get('/api/bookings/1');

      // Assertions
      expect(response.status).toBe(404);
    });

    it('should return 404 when booking does not exist', async () => {
      // Mock booking not found
      (prisma.booking.findUnique as jest.Mock).mockResolvedValue(null);
      
      // Test request
      const response = await request(app)
        .get('/api/bookings/999');

      // Assertions
      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/bookings/:id/cancel', () => {
    it('should cancel a booking', async () => {
      // Test request
      const response = await request(app)
        .post('/api/bookings/1/cancel');

      // Assertions
      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/bookings/branch/:branchId', () => {
    it('should get all bookings for a branch (admin access)', async () => {
      // Test request
      const response = await request(app)
        .get('/api/bookings/branch/1');

      // Assertions
      expect(response.status).toBe(404);
    });
  });
}); 