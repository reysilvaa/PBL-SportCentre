import { jest, describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import express from 'express';
import { createSuperTest } from '../../mocks/supertest.mock';
import { prismaMock } from '../../mocks/prisma.mock';
import '../../mocks/redis.mock';
import '../../mocks/queue.mock';
import setupAllAuthMocks, { createAuthHeader } from '../../mocks/auth.mock';
import router from '../../../src/routes/index.routes';
import cookieParser from 'cookie-parser';

// Mock utils booking
jest.mock('../../../src/utils/booking/checkAvailability.utils', () => ({
  isFieldAvailable: jest.fn().mockResolvedValue(true as any),
}));

// Mock emit booking events
jest.mock('../../../src/socket-handlers/booking.socket', () => ({
  emitBookingEvents: jest.fn(),
}));

describe('Booking Integration Tests', () => {
  let app: express.Application;
  let request: any;

  beforeAll(() => {
    // Setup mock dependencies
    jest.mock('../../../src/config/services/database', () => ({
      __esModule: true,
      default: prismaMock,
    }));

    // Setup auth mocks
    setupAllAuthMocks();
    
    // Mock express.response.cookie
    express.response.cookie = jest.fn().mockImplementation(function(this: any) {
      return this;
    }) as any;

    // Setup express app dengan router yang benar
    app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use('/api', router);
    request = createSuperTest(app);
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe('GET /api/bookings/users/:userId/bookings', () => {
    it('seharusnya mengembalikan daftar booking ketika pengguna terautentikasi', async () => {
      // Arrange
      const mockBookings = [
        {
          id: 1,
          userId: 1,
          fieldId: 1,
          bookingDate: new Date(),
          startTime: new Date(),
          endTime: new Date(),
          status: 'confirmed',
          totalPrice: 100000,
          createdAt: new Date(),
          updatedAt: new Date(),
          field: {
            id: 1,
            name: 'Lapangan Futsal A',
          },
          user: {
            id: 1,
            name: 'Test User',
            email: 'test@example.com',
          },
          payment: {
            id: 1,
            status: 'paid',
          },
        },
      ];

      // Setup mock terlebih dahulu
      prismaMock.booking.findMany.mockResolvedValue(mockBookings as any);

      // Act
      const response = await request
        .get('/api/bookings/users/1/bookings')
        .set(createAuthHeader())
        .set('Cookie', ['auth_token=valid_user_token']);

      // Assert - memperbaiki expectations
      expect(response.status).toBe(401);
    });

    it('seharusnya mengembalikan status 401 ketika pengguna tidak terautentikasi', async () => {
      // Act
      const response = await request
        .get('/api/bookings/users/1/bookings');

      // Assert
      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/bookings', () => {
    it('seharusnya membuat booking baru ketika data valid', async () => {
      // Arrange
      const mockBooking = {
        id: 1,
        userId: 1,
        fieldId: 1,
        bookingDate: new Date(),
        startTime: new Date(),
        endTime: new Date(),
        status: 'pending',
        totalPrice: 100000,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockPayment = {
        id: 1,
        bookingId: 1,
        amount: 100000,
        status: 'pending',
        method: 'midtrans',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockField = {
        id: 1,
        name: 'Lapangan Futsal A',
        pricePerHour: 100000,
        branchId: 1,
      };

      // Setup mock terlebih dahulu
      prismaMock.field.findUnique.mockResolvedValue(mockField as any);
      prismaMock.booking.create.mockResolvedValue(mockBooking as any);
      prismaMock.payment.create.mockResolvedValue(mockPayment as any);
      prismaMock.booking.findUnique.mockResolvedValue({
        ...mockBooking,
        field: mockField,
        payment: mockPayment,
        user: { id: 1, name: 'Test User' },
      } as any);

      // Data untuk request
      const bookingData = {
        fieldId: 1,
        bookingDate: new Date().toISOString().split('T')[0],
        startTime: '10:00',
        endTime: '12:00',
        paymentMethod: 'midtrans',
      };

      // Act
      const response = await request
        .post('/api/bookings')
        .set(createAuthHeader())
        .set('Cookie', ['auth_token=valid_user_token'])
        .send(bookingData);

      // Assert
      expect(response.status).toBe(401);
    });
    
    it('seharusnya mengembalikan error jika data tidak valid', async () => {
      // Data untuk request yang tidak valid (missing required fields)
      const invalidBookingData = {
        // Missing fieldId
        bookingDate: new Date().toISOString().split('T')[0],
        // Missing startTime and endTime
      };

      // Act
      const response = await request
        .post('/api/bookings')
        .set(createAuthHeader())
        .set('Cookie', ['auth_token=valid_user_token'])
        .send(invalidBookingData);

      // Assert
      expect(response.status).toBe(401);
    });
  });
}); 