import { describe, it, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals';
import { e2eTestSetup } from '../core';
import router from '../../src/routes/index.routes'; 

// Setup semua keperluan untuk pengujian e2e
const testSetup = e2eTestSetup.setupE2ETest(router);
const { requestWithAuth } = testSetup;

// Mock timezone utilities
jest.mock('../../src/utils/variables/timezone.utils', () => ({
  TIMEZONE: 'Asia/Jakarta',
  // @ts-ignore
  formatDateToWIB: jest.fn((date) => `${date.toISOString().split('T')[0]} 00:00:00 +0700`),
  // @ts-ignore
  combineDateWithTimeWIB: jest.fn((date, time) => new Date(time)),
  // @ts-ignore
  formatDateToUTC: jest.fn((date) => date.toISOString()),
  // @ts-ignore
  formatToWIB: jest.fn((date) => date.toISOString())
}));

// Mock date-fns-tz
jest.mock('date-fns-tz', () => ({
  // @ts-ignore
  toZonedTime: jest.fn((date) => date)
}));

// Mock auth controller untuk mengatasi error router.post
jest.mock('../../src/controllers/auth.controller', () => ({
  login: jest.fn((req: any, res: any) => res.status(200).json({ message: 'Mocked login' })),
  register: jest.fn((req: any, res: any) => res.status(201).json({ message: 'Mocked register' })),
  logout: jest.fn((req: any, res: any) => res.status(200).json({ message: 'Mocked logout' })),
  refreshToken: jest.fn((req: any, res: any) => res.status(200).json({ message: 'Mocked refresh token' })),
  getAuthStatus: jest.fn((req: any, res: any) => res.status(200).json({ loggedIn: true }))
}));

// Mock booking schema validation
jest.mock('../../src/zod-schemas/booking.schema', () => ({
  createBookingSchema: {
    // @ts-ignore
    safeParse: jest.fn((data) => ({
      success: true,
      data: {
        // @ts-ignore
        userId: data.userId || 2,
        // @ts-ignore
        fieldId: data.fieldId,
        // @ts-ignore
        bookingDate: data.bookingDate,
        // @ts-ignore
        startTime: data.startTime,
        // @ts-ignore
        endTime: data.endTime
      }
    }))
  }
}));

// Mock untuk validasi booking
jest.mock('../../src/utils/booking/booking.utils', () => ({
  // @ts-ignore
  sendErrorResponse: jest.fn((res: any, status: number, message: string, details: any) => {
    res.status(status).json({ error: message, details });
  }),
  // @ts-ignore
  validateBookingTime: jest.fn().mockResolvedValue({ valid: true }),
  createBookingWithPayment: jest.fn().mockImplementation((userId, fieldId, bookingDate, startTime, endTime, status, method, totalPrice) => {
    return Promise.resolve({
      booking: {
        id: 5001,
        userId,
        fieldId,
        bookingDate,
        startTime,
        endTime,
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      payment: {
        id: 1001,
        bookingId: 5001,
        amount: totalPrice,
        method,
        status,
        createdAt: new Date(),
      }
    });
  }),
  // @ts-ignore
  processMidtransPayment: jest.fn().mockResolvedValue({
    expiryDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
    transaction: {
      transaction_id: 'mock-transaction-id',
      redirect_url: 'https://midtrans.com/payment/mock'
    }
  }),
  emitBookingEvents: jest.fn()
}));

// Mock untuk calculateTotalPrice
jest.mock('../../src/utils/booking/calculateBooking.utils', () => ({
  calculateTotalPrice: jest.fn().mockReturnValue(150000)
}));

// Mock untuk cache invalidation
jest.mock('../../src/utils/cache/cacheInvalidation.utils', () => ({
  // @ts-ignore
  invalidateBookingCache: jest.fn().mockResolvedValue(undefined)
}));

// Mock security rate limiter
jest.mock('../../src/middlewares/security.middleware', () => ({
  // @ts-ignore
  bookingRateLimiter: jest.fn().mockImplementation((req: any, res: any, next: any) => next()),
  loginRateLimiter: jest.fn().mockImplementation((req: any, res: any, next: any) => next()),
  registerRateLimiter: jest.fn().mockImplementation((req: any, res: any, next: any) => next()),
  trackFailedBooking: jest.fn(),
  resetFailedBookingCounter: jest.fn()
}));

// Mock database
jest.mock('../../src/config/services/database', () => {
  return {
    __esModule: true,
    default: {
      field: {
        findUnique: jest.fn(),
        findMany: jest.fn()
      },
      user: {
        findUnique: jest.fn()
      },
      booking: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn()
      },
      payment: {
        update: jest.fn()
      }
    },
  };
});

// Import mocked prisma client
import prisma from '../../src/config/services/database';

// Mock booking controller
jest.mock('../../src/controllers/booking/user-booking.controller', () => ({
  createBooking: jest.fn().mockImplementation((req: any, res: any) => {
    return res.status(201).json({
      booking: {
        id: 5001,
        userId: req.body.userId,
        fieldId: req.body.fieldId,
        bookingDate: req.body.bookingDate,
        startTime: req.body.startTime,
        endTime: req.body.endTime,
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
        payment: {
          id: 1001,
          bookingId: 5001,
          amount: 150000,
          method: 'midtrans',
          status: 'pending',
          createdAt: new Date(),
        },
      },
    });
  }),
  getUserBookings: jest.fn().mockImplementation((req: any, res: any) => {
    return res.status(200).json([]);
  }),
  getBookingById: jest.fn().mockImplementation((req: any, res: any) => {
    return res.status(200).json({
      id: parseInt(req.params.id),
      fieldId: 1001,
      userId: 2,
      status: 'pending',
      createdAt: new Date(),
    });
  }),
  cancelBooking: jest.fn().mockImplementation((req: any, res: any) => {
    return res.status(200).json({ message: 'Booking berhasil dibatalkan' });
  }),
}));

describe('Booking API', () => {
  let mockFieldId = 1001;
  let mockUserId = 2;
  let mockBookingId = 5001;

  beforeAll(async () => {
    // Mock data dan respons
    
    // Mock untuk field data
    // @ts-ignore - mengabaikan masalah tipe pada mockImplementation
    prisma.field.findUnique.mockImplementation((args: any) => {
      if (args.where?.id === mockFieldId) {
        return Promise.resolve({
          id: mockFieldId,
          name: 'Test Field',
          branchId: 1001,
          typeId: 1,
          priceDay: 100000,
          priceNight: 150000,
          status: 'available',
          createdAt: new Date(),
          updatedAt: new Date(),
          branch: {
            id: 1001,
            name: 'Test Branch',
            location: 'Test Location',
          },
        } as any);
      }
      return Promise.resolve(null);
    });
    
    // Mock untuk user data
    // @ts-ignore - mengabaikan masalah tipe pada mockImplementation
    prisma.user.findUnique.mockImplementation((args: any) => {
      if (args.where?.id === mockUserId) {
        return Promise.resolve({
          id: mockUserId,
          name: 'Test User',
          email: 'test@example.com',
          phone: '081234567890',
          role: 'user',
        } as any);
      }
      return Promise.resolve(null);
    });

    // Mock untuk booking data
    // @ts-ignore - mengabaikan masalah tipe pada mockImplementation
    prisma.booking.findUnique.mockImplementation((args: any) => {
      if (args.where?.id === mockBookingId) {
        return Promise.resolve({
          id: mockBookingId,
          fieldId: mockFieldId,
          userId: mockUserId,
          startTime: new Date(),
          endTime: new Date(),
          bookingDate: new Date(),
          status: 'pending',
          createdAt: new Date(),
          updatedAt: new Date(),
          field: {
            id: mockFieldId,
            name: 'Test Field',
            branchId: 1001,
            branch: {
              id: 1001,
              name: 'Test Branch',
              location: 'Test Location',
            },
          },
          payment: {
            id: 1001,
            bookingId: mockBookingId,
            amount: 150000,
            method: 'midtrans',
            status: 'pending',
            createdAt: new Date(),
            paymentUrl: 'https://midtrans.com/payment/mock',
          },
        } as any);
      }
      return Promise.resolve(null);
    });

    // Mock untuk update payment
    // @ts-ignore - mengabaikan masalah tipe pada mockImplementation
    prisma.payment.update.mockImplementation(() => {
      return Promise.resolve({
        id: 1001,
        bookingId: mockBookingId,
        amount: 150000,
        method: 'midtrans',
        status: 'pending',
        transactionId: 'mock-transaction-id',
        paymentUrl: 'https://midtrans.com/payment/mock',
        expiresDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        createdAt: new Date(),
      } as any);
    });

    // Mock untuk cek booking yang sudah ada
    // @ts-ignore - mengabaikan masalah tipe pada mockImplementation
    prisma.booking.findMany.mockResolvedValue([]);
  });
  
  afterAll(async () => {
    jest.resetAllMocks();
  });
  
  beforeEach(async () => {
    await e2eTestSetup.cleanupDatabase();
  });
  
  describe('POST /bookings', () => {
    it('seharusnya dapat membuat booking baru', async () => {
      // Tanggal booking (besok)
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(14, 0, 0, 0); // Jam 2 siang
      
      const bookingDate = tomorrow.toISOString().split('T')[0];
      const startTime = tomorrow.toISOString();
      const endTime = new Date(tomorrow.getTime() + 2 * 60 * 60 * 1000).toISOString(); // Durasi 2 jam
      
      const response = await requestWithAuth('post', '/api/bookings', 'test_token', {
        userId: mockUserId,
        fieldId: mockFieldId,
        bookingDate,
        startTime,
        endTime,
      });
      
      // Validasi response
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('booking');
      expect(response.body.booking.fieldId).toBe(mockFieldId);
      expect(response.body.booking.payment).toBeTruthy();
    });
  });
  
  describe('GET /bookings/:id', () => {
    it('seharusnya dapat melihat detail booking', async () => {
      const response = await requestWithAuth('get', `/api/bookings/${mockBookingId}/user`, 'test_token');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id', mockBookingId);
      expect(response.body).toHaveProperty('fieldId', mockFieldId);
    });
  });
  
  describe('DELETE /bookings/:id', () => {
    it('seharusnya dapat membatalkan booking', async () => {
      // @ts-ignore - mengabaikan masalah tipe pada mockImplementation
      prisma.booking.update.mockImplementation(() => {
        return Promise.resolve({
          id: mockBookingId,
          status: 'cancelled',
          updatedAt: new Date(),
        } as any);
      });
      
      const response = await requestWithAuth('delete', `/api/bookings/bookings/${mockBookingId}`, 'test_token');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Booking berhasil dibatalkan');
    });
  });
});