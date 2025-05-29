import { Response } from 'express';
import { jest } from '@jest/globals';
import * as UserBookingController from '../../../../src/controllers/booking/user-booking.controller';
import prisma from '../../../../src/config/services/database';
import * as BookingUtils from '../../../../src/utils/booking/booking.utils';
import * as CalcBookingUtils from '../../../../src/utils/booking/calculateBooking.utils';
import * as CacheUtils from '../../../../src/utils/cache/cacheInvalidation.utils';
import * as SecurityMiddleware from '../../../../src/middlewares/security.middleware';
import { PaymentStatus } from '../../../../src/types';
import { User } from '../../../../src/middlewares/auth.middleware';

// Mock dependencies
jest.mock('../../../../src/config/services/database', () => ({
  field: {
    findUnique: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
  booking: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    delete: jest.fn(),
  },
  payment: {
    update: jest.fn(),
    delete: jest.fn(),
  },
}));

jest.mock('../../../../src/utils/booking/booking.utils', () => ({
  sendErrorResponse: jest.fn(),
  validateBookingTime: jest.fn(),
  createBookingWithPayment: jest.fn(),
  processMidtransPayment: jest.fn(),
  emitBookingEvents: jest.fn(),
}));

jest.mock('../../../../src/utils/booking/calculateBooking.utils', () => ({
  calculateTotalPrice: jest.fn(),
}));

jest.mock('../../../../src/utils/cache/cacheInvalidation.utils', () => ({
  invalidateBookingCache: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../../../src/middlewares/security.middleware', () => ({
  trackFailedBooking: jest.fn(),
  resetFailedBookingCounter: jest.fn(),
}));

describe('User Booking Controller', () => {
  let mockReq: Partial<User>;
  let mockRes: Partial<Response>;
  
  beforeEach(() => {
    mockReq = {
      body: {},
      params: {},
      user: {
        id: 123,
        role: 'user',
      },
      ip: '192.168.1.1',
      socket: { remoteAddress: '192.168.1.1' } as any,
    };
    
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as any;

    jest.clearAllMocks();
  });

  describe('createBooking', () => {
    const validBookingData = {
      userId: 1,
      fieldId: 1,
      bookingDate: '2023-06-01',
      startTime: '08:00',
      endTime: '10:00',
    };

    const mockField = {
      id: 1,
      name: 'Test Field',
      priceDay: 50000,
      priceNight: 75000,
      branch: { id: 1, name: 'Test Branch' },
      branchId: 1,
    };

    const mockUser = {
      name: 'Test User',
      email: 'test@example.com',
      phone: '08123456789',
    };

    const mockBooking = {
      id: 1,
      userId: 1,
      fieldId: 1,
      startTime: new Date(),
      endTime: new Date(),
      status: 'PENDING',
    };

    const mockPayment = {
      id: 1,
      bookingId: 1,
      amount: 100000,
      status: 'PENDING',
      method: 'MIDTRANS',
    };

    const mockPaymentResult = {
      expiryDate: new Date(),
      transaction: {
        transaction_id: 'trx-123',
        redirect_url: 'https://payment.com/redirect',
      },
    };

    it('should create a new booking successfully', async () => {
      // Arrange
      mockReq.body = validBookingData;
      
      (BookingUtils.validateBookingTime as jest.Mock).mockResolvedValueOnce({
        valid: true,
      });
      
      (prisma.field.findUnique as jest.Mock).mockResolvedValueOnce(mockField);
      (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(mockUser);
      
      (CalcBookingUtils.calculateTotalPrice as jest.Mock).mockReturnValueOnce(100000);
      
      (BookingUtils.createBookingWithPayment as jest.Mock).mockResolvedValueOnce({
        booking: mockBooking,
        payment: mockPayment,
      });
      
      (BookingUtils.processMidtransPayment as jest.Mock).mockResolvedValueOnce(mockPaymentResult);
      
      (prisma.payment.update as jest.Mock).mockResolvedValueOnce({
        ...mockPayment,
        expiresDate: mockPaymentResult.expiryDate,
        transactionId: mockPaymentResult.transaction.transaction_id,
        paymentUrl: mockPaymentResult.transaction.redirect_url,
      });

      // Act
      await UserBookingController.createBooking(mockReq as User, mockRes as Response);

      // Assert
      expect(BookingUtils.validateBookingTime).toHaveBeenCalled();
      expect(prisma.field.findUnique).toHaveBeenCalledWith({
        where: { id: validBookingData.fieldId },
        include: { branch: true },
      });
      expect(CalcBookingUtils.calculateTotalPrice).toHaveBeenCalled();
      expect(BookingUtils.createBookingWithPayment).toHaveBeenCalled();
      expect(BookingUtils.processMidtransPayment).toHaveBeenCalled();
      expect(SecurityMiddleware.resetFailedBookingCounter).toHaveBeenCalled();
      expect(BookingUtils.emitBookingEvents).toHaveBeenCalled();
      expect(CacheUtils.invalidateBookingCache).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalled();
    });

    it('should handle validation errors', async () => {
      // Arrange
      mockReq.body = { 
        // data tidak lengkap - akan gagal validasi
        userId: 1
      };

      // Act
      await UserBookingController.createBooking(mockReq as User, mockRes as Response);

      // Assert
      expect(BookingUtils.sendErrorResponse).toHaveBeenCalled();
    });

    it('should handle invalid booking time', async () => {
      // Arrange
      mockReq.body = validBookingData;
      
      (BookingUtils.validateBookingTime as jest.Mock).mockResolvedValueOnce({
        valid: false,
        message: 'Invalid booking time',
        details: { reason: 'Slot not available' },
      });

      // Act
      await UserBookingController.createBooking(mockReq as User, mockRes as Response);

      // Assert
      expect(BookingUtils.sendErrorResponse).toHaveBeenCalledWith(
        mockRes, 
        400, 
        'Invalid booking time', 
        { reason: 'Slot not available' }
      );
    });

    it('should handle field not found', async () => {
      // Arrange
      mockReq.body = validBookingData;
      
      (BookingUtils.validateBookingTime as jest.Mock).mockResolvedValueOnce({
        valid: true,
      });
      
      (prisma.field.findUnique as jest.Mock).mockResolvedValueOnce(null);

      // Act
      await UserBookingController.createBooking(mockReq as User, mockRes as Response);

      // Assert
      expect(BookingUtils.sendErrorResponse).toHaveBeenCalledWith(
        mockRes, 
        404, 
        'Field not found'
      );
    });

    it('should handle payment failure', async () => {
      // Arrange
      mockReq.body = validBookingData;
      
      (BookingUtils.validateBookingTime as jest.Mock).mockResolvedValueOnce({
        valid: true,
      });
      
      (prisma.field.findUnique as jest.Mock).mockResolvedValueOnce(mockField);
      (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(mockUser);
      
      (CalcBookingUtils.calculateTotalPrice as jest.Mock).mockReturnValueOnce(100000);
      
      (BookingUtils.createBookingWithPayment as jest.Mock).mockResolvedValueOnce({
        booking: mockBooking,
        payment: mockPayment,
      });
      
      (BookingUtils.processMidtransPayment as jest.Mock).mockResolvedValueOnce(null);

      // Act
      await UserBookingController.createBooking(mockReq as User, mockRes as Response);

      // Assert
      expect(SecurityMiddleware.trackFailedBooking).toHaveBeenCalled();
      expect(BookingUtils.sendErrorResponse).toHaveBeenCalledWith(
        mockRes, 
        500, 
        'Failed to create payment gateway'
      );
    });
  });

  describe('getUserBookings', () => {
    const mockBookings = [
      {
        id: 1,
        userId: 123,
        fieldId: 10,
        bookingDate: new Date('2025-06-01'),
        startTime: new Date('2025-06-01T08:00:00'),
        endTime: new Date('2025-06-01T10:00:00'),
        status: 'confirmed',
        createdAt: new Date(),
        updatedAt: new Date(),
        user: {
          id: 123,
          name: 'John Doe',
          email: 'john@example.com',
        },
        field: {
          id: 10,
          name: 'Lapangan Futsal A',
          branch: {
            id: 1,
            name: 'Cabang Utama',
            location: 'Jalan Utama No. 1',
            imageUrl: 'https://example.com/branch1.jpg',
          },
          type: {
            id: 1,
            name: 'Futsal',
          },
        },
        payment: {
          id: 1,
          amount: 200000,
          status: 'paid',
        },
      },
    ];

    it('should return bookings for a specific user', async () => {
      // Arrange
      mockReq.params = { userId: '123' };
      
      // First, clear mocks to ensure they are reset
      jest.clearAllMocks();
      
      (prisma.booking.findMany as jest.Mock).mockResolvedValueOnce(mockBookings);

      // Act
      await UserBookingController.getUserBookings(mockReq as User, mockRes as Response);

      // Assert
      expect(prisma.booking.findMany).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(mockBookings);
    });

    it('should handle database errors', async () => {
      // Arrange
      mockReq.params = { userId: '123' };
      
      // Mock database error
      (prisma.booking.findMany as jest.Mock).mockRejectedValueOnce(new Error('Database error'));

      // Act
      await UserBookingController.getUserBookings(mockReq as User, mockRes as Response);

      // Assert
      expect(BookingUtils.sendErrorResponse).toHaveBeenCalledWith(
        mockRes,
        500,
        'Internal Server Error'
      );
    });

    it('should handle invalid user ID', async () => {
      // Arrange
      mockReq.params = { userId: 'invalid' };

      // Act
      await UserBookingController.getUserBookings(mockReq as User, mockRes as Response);

      // Assert
      expect(BookingUtils.sendErrorResponse).toHaveBeenCalledWith(
        mockRes,
        400,
        'Invalid user ID'
      );
      expect(prisma.booking.findMany).not.toHaveBeenCalled();
    });
  });

  describe('getBookingById', () => {
    const mockBooking = {
      id: 42,
      userId: 123,
      fieldId: 5,
      bookingDate: new Date('2025-06-01'),
      startTime: new Date('2025-06-01T15:00:00'),
      endTime: new Date('2025-06-01T17:00:00'),
      status: 'confirmed',
      createdAt: new Date(),
      updatedAt: new Date(),
      user: {
        id: 123,
        name: 'John Doe',
        email: 'john@example.com',
        phone: '+6281234567890',
      },
      field: {
        id: 5,
        name: 'Lapangan Futsal B',
        branch: {
          id: 2,
          name: 'Cabang Selatan',
          location: 'Jakarta Selatan',
          imageUrl: 'https://example.com/branch.jpg',
        },
        type: {
          id: 1,
          name: 'Futsal',
        },
      },
      payment: {
        id: 42,
        bookingId: 42,
        amount: 250000,
        status: PaymentStatus.paid,
        paymentMethod: 'midtrans',
      },
    };

    it('should return booking by ID', async () => {
      // Arrange
      mockReq.params = { id: '42' };
      (prisma.booking.findUnique as jest.Mock).mockResolvedValueOnce(mockBooking);

      // Act
      await UserBookingController.getBookingById(mockReq as User, mockRes as Response);

      // Assert
      expect(prisma.booking.findUnique).toHaveBeenCalledWith({
        where: { id: 42 },
        include: expect.objectContaining({
          user: expect.any(Object),
          field: expect.any(Object),
          payment: true,
        }),
      });
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(mockBooking);
    });

    it('should handle invalid booking ID', async () => {
      // Arrange
      mockReq.params = { id: 'invalid' };

      // Act
      await UserBookingController.getBookingById(mockReq as User, mockRes as Response);

      // Assert
      expect(BookingUtils.sendErrorResponse).toHaveBeenCalledWith(
        mockRes,
        400,
        'ID booking tidak valid'
      );
      expect(prisma.booking.findUnique).not.toHaveBeenCalled();
    });

    it('should handle booking not found', async () => {
      // Arrange
      mockReq.params = { id: '999' };
      (prisma.booking.findUnique as jest.Mock).mockResolvedValueOnce(null);

      // Act
      await UserBookingController.getBookingById(mockReq as User, mockRes as Response);

      // Assert
      expect(BookingUtils.sendErrorResponse).toHaveBeenCalledWith(
        mockRes,
        404,
        'Booking tidak ditemukan'
      );
    });

    it('should handle database errors', async () => {
      // Arrange
      mockReq.params = { id: '42' };
      (prisma.booking.findUnique as jest.Mock).mockRejectedValueOnce(new Error('Database error'));

      // Act
      await UserBookingController.getBookingById(mockReq as User, mockRes as Response);

      // Assert
      expect(BookingUtils.sendErrorResponse).toHaveBeenCalledWith(
        mockRes,
        500,
        'Kesalahan Server Internal'
      );
    });
  });

  describe('cancelBooking', () => {
    const mockBooking = {
      id: 42,
      userId: 123,
      fieldId: 5,
      field: {
        id: 5,
        branchId: 2,
      },
      payment: {
        id: 42,
        status: PaymentStatus.pending,
      },
    };

    it('should successfully cancel a booking', async () => {
      // Arrange
      mockReq.params = { id: '42' };
      (prisma.booking.findUnique as jest.Mock).mockResolvedValueOnce(mockBooking);
      (prisma.payment.delete as jest.Mock).mockResolvedValueOnce({});
      (prisma.booking.delete as jest.Mock).mockResolvedValueOnce({});
      (CacheUtils.invalidateBookingCache as jest.Mock).mockResolvedValueOnce(true);

      // Act
      await UserBookingController.cancelBooking(mockReq as User, mockRes as Response);

      // Assert
      expect(prisma.booking.findUnique).toHaveBeenCalledWith({
        where: { id: 42 },
        include: expect.objectContaining({
          payment: true,
          field: expect.any(Object),
        }),
      });
      expect(prisma.payment.delete).toHaveBeenCalledWith({ where: { id: 42 } });
      expect(prisma.booking.delete).toHaveBeenCalledWith({ where: { id: 42 } });
      expect(CacheUtils.invalidateBookingCache).toHaveBeenCalledWith(42, 5, 2, 123);
      expect(BookingUtils.emitBookingEvents).toHaveBeenCalledWith('booking:cancelled', { bookingId: 42 });
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: true,
        message: 'Booking berhasil dibatalkan',
      });
    });

    it('should not allow cancellation of paid bookings', async () => {
      // Arrange
      mockReq.params = { id: '42' };
      const paidBooking = {
        ...mockBooking,
        payment: {
          id: 42,
          status: PaymentStatus.PAID,
        },
      };
      
      // Clear any existing mocks and set up new ones
      jest.clearAllMocks();
      (prisma.booking.findUnique as jest.Mock).mockResolvedValueOnce(paidBooking);

      // Act
      await UserBookingController.cancelBooking(mockReq as User, mockRes as Response);

      // Assert
      expect(BookingUtils.sendErrorResponse).toHaveBeenCalledWith(
        mockRes,
        400,
        'Cannot cancel a booking that has been paid. Please contact administrator.'
      );
      expect(prisma.payment.delete).not.toHaveBeenCalled();
      expect(prisma.booking.delete).not.toHaveBeenCalled();
    });

    it('should handle booking not found', async () => {
      // Arrange
      mockReq.params = { id: '999' };
      (prisma.booking.findUnique as jest.Mock).mockResolvedValueOnce(null);

      // Act
      await UserBookingController.cancelBooking(mockReq as User, mockRes as Response);

      // Assert
      expect(BookingUtils.sendErrorResponse).toHaveBeenCalledWith(
        mockRes,
        404,
        'Booking not found'
      );
      expect(prisma.payment.delete).not.toHaveBeenCalled();
      expect(prisma.booking.delete).not.toHaveBeenCalled();
    });

    it('should handle invalid booking ID', async () => {
      // Arrange
      mockReq.params = { id: 'invalid' };

      // Act
      await UserBookingController.cancelBooking(mockReq as User, mockRes as Response);

      // Assert
      expect(BookingUtils.sendErrorResponse).toHaveBeenCalledWith(
        mockRes,
        400,
        'Invalid booking ID'
      );
      expect(prisma.booking.findUnique).not.toHaveBeenCalled();
    });

    it('should handle database errors', async () => {
      // Arrange
      mockReq.params = { id: '42' };
      (prisma.booking.findUnique as jest.Mock).mockRejectedValueOnce(new Error('Database error'));

      // Act
      await UserBookingController.cancelBooking(mockReq as User, mockRes as Response);

      // Assert
      expect(BookingUtils.sendErrorResponse).toHaveBeenCalledWith(
        mockRes,
        500,
        'Internal Server Error'
      );
    });
  });
}); 