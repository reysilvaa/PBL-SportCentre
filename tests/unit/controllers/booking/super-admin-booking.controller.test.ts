import { Request, Response } from 'express';
import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import * as SuperAdminBookingController from '../../../../src/controllers/booking/super-admin-booking.controller';
import prisma from '../../../../src/config/services/database';
import * as CacheUtils from '../../../../src/utils/cache/cacheInvalidation.utils';
import * as BookingUtils from '../../../../src/utils/booking/booking.utils';

// Mock the dependencies
jest.mock('../../../../src/config/services/database', () => ({
  booking: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
  },
  payment: {
    update: jest.fn(),
  },
  activityLog: {
    create: jest.fn(),
  },
}));

// Mock the cache invalidation utils
jest.mock('../../../../src/utils/cache/cacheInvalidation.utils', () => ({
  invalidateBookingCache: jest.fn().mockResolvedValue(true),
  invalidatePaymentCache: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../../../src/utils/booking/booking.utils', () => ({
  emitBookingEvents: jest.fn(),
}));

describe('Super Admin Booking Controller', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  
  beforeEach(() => {
    mockReq = {
      query: {},
      params: {},
      body: {},
      user: {
        id: 1,
        role: 'super_admin',
      },
    };
    
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as any;
    
    jest.clearAllMocks();
  });

  describe('getAllBookings', () => {
    const mockBookings = [
      {
        id: 1,
        userId: 42,
        fieldId: 10,
        bookingDate: new Date('2025-06-01'),
        startTime: new Date('2025-06-01T08:00:00'),
        endTime: new Date('2025-06-01T10:00:00'),
        status: 'confirmed',
        createdAt: new Date(),
        updatedAt: new Date(),
        user: {
          id: 42,
          name: 'John Doe',
          email: 'john@example.com',
        },
        field: {
          id: 10,
          name: 'Lapangan Futsal A',
          branch: {
            id: 1,
            name: 'Cabang Utama',
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
      {
        id: 2,
        userId: 43,
        fieldId: 11,
        bookingDate: new Date('2025-06-02'),
        startTime: new Date('2025-06-02T15:00:00'),
        endTime: new Date('2025-06-02T17:00:00'),
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
        user: {
          id: 43,
          name: 'Jane Smith',
          email: 'jane@example.com',
        },
        field: {
          id: 11,
          name: 'Lapangan Badminton B',
          branch: {
            id: 2,
            name: 'Cabang Selatan',
          },
          type: {
            id: 2,
            name: 'Badminton',
          },
        },
        payment: {
          id: 2,
          amount: 150000,
          status: 'pending',
        },
      },
    ];

    it('should return all bookings without filters', async () => {
      // Arrange
      (prisma.booking.findMany as jest.Mock).mockResolvedValueOnce(mockBookings);

      // Act
      await SuperAdminBookingController.getAllBookings(mockReq as Request, mockRes as Response);

      // Assert
      expect(prisma.booking.findMany).toHaveBeenCalledWith({
        where: {},
        include: {
          user: { select: { id: true, name: true, email: true } },
          field: { include: { branch: true, type: true } },
          payment: true,
        },
        orderBy: { bookingDate: 'desc' },
      });
      
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: true,
        message: 'Berhasil mendapatkan data semua booking',
        data: mockBookings,
      });
    });

    it('should apply date range filters correctly', async () => {
      // Arrange
      mockReq.query = { 
        startDate: '2025-06-01', 
        endDate: '2025-06-30' 
      };
      
      (prisma.booking.findMany as jest.Mock).mockResolvedValueOnce(mockBookings);

      // Act
      await SuperAdminBookingController.getAllBookings(mockReq as Request, mockRes as Response);

      // Assert
      expect(prisma.booking.findMany).toHaveBeenCalledWith({
        where: {
          bookingDate: {
            gte: new Date('2025-06-01'),
            lte: new Date('2025-06-30'),
          },
        },
        include: {
          user: { select: { id: true, name: true, email: true } },
          field: { include: { branch: true, type: true } },
          payment: true,
        },
        orderBy: { bookingDate: 'desc' },
      });
    });

    it('should apply branch filter correctly', async () => {
      // Arrange
      mockReq.query = { branchId: '1' };
      (prisma.booking.findMany as jest.Mock).mockResolvedValueOnce([mockBookings[0]]);

      // Act
      await SuperAdminBookingController.getAllBookings(mockReq as Request, mockRes as Response);

      // Assert
      expect(prisma.booking.findMany).toHaveBeenCalledWith({
        where: {
          field: {
            branchId: 1,
          },
        },
        include: {
          user: { select: { id: true, name: true, email: true } },
          field: { include: { branch: true, type: true } },
          payment: true,
        },
        orderBy: { bookingDate: 'desc' },
      });
    });

    it('should apply payment status filter correctly', async () => {
      // Arrange
      mockReq.query = { status: 'paid' };
      (prisma.booking.findMany as jest.Mock).mockResolvedValueOnce([mockBookings[0]]);

      // Act
      await SuperAdminBookingController.getAllBookings(mockReq as Request, mockRes as Response);

      // Assert
      expect(prisma.booking.findMany).toHaveBeenCalledWith({
        where: {
          payment: {
            status: 'paid',
          },
        },
        include: {
          user: { select: { id: true, name: true, email: true } },
          field: { include: { branch: true, type: true } },
          payment: true,
        },
        orderBy: { bookingDate: 'desc' },
      });
    });

    it('should apply multiple filters correctly', async () => {
      // Arrange
      mockReq.query = { 
        startDate: '2025-06-01', 
        endDate: '2025-06-30',
        branchId: '1',
        status: 'paid'
      };
      
      (prisma.booking.findMany as jest.Mock).mockResolvedValueOnce([mockBookings[0]]);

      // Act
      await SuperAdminBookingController.getAllBookings(mockReq as Request, mockRes as Response);

      // Assert
      expect(prisma.booking.findMany).toHaveBeenCalledWith({
        where: {
          bookingDate: {
            gte: new Date('2025-06-01'),
            lte: new Date('2025-06-30'),
          },
          field: {
            branchId: 1,
          },
          payment: {
            status: 'paid',
          },
        },
        include: {
          user: { select: { id: true, name: true, email: true } },
          field: { include: { branch: true, type: true } },
          payment: true,
        },
        orderBy: { bookingDate: 'desc' },
      });
    });

    it('should handle database errors', async () => {
      // Arrange
      (prisma.booking.findMany as jest.Mock).mockRejectedValueOnce(new Error('Database error'));

      // Act
      await SuperAdminBookingController.getAllBookings(mockReq as Request, mockRes as Response);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: false,
        message: 'Internal Server Error',
      });
    });
  });

  describe('updateBookingPayment', () => {
    const mockBooking = {
      id: 1,
      userId: 42,
      fieldId: 10,
      bookingDate: new Date('2025-06-01'),
      field: {
        id: 10,
        name: 'Lapangan Futsal A',
        branchId: 1,
      },
      payment: {
        id: 1,
        amount: 200000,
        status: 'pending',
      },
    };

    const validUpdateData = {
      paymentStatus: 'paid',
    };

    it('should update payment status successfully', async () => {
      // Arrange
      mockReq.params = { id: '1' };
      mockReq.body = validUpdateData;
      
      (prisma.booking.findUnique as jest.Mock).mockResolvedValueOnce(mockBooking);
      (prisma.payment.update as jest.Mock).mockResolvedValueOnce({
        ...mockBooking.payment,
        status: 'paid',
        amount: 200000,
      });
      
      // Act
      await SuperAdminBookingController.updateBookingPayment(mockReq as Request, mockRes as Response);

      // Assert
      expect(prisma.booking.findUnique).toHaveBeenCalled();
      expect(prisma.payment.update).toHaveBeenCalled();
      
      // Check that the cache invalidation functions were called
      expect(CacheUtils.invalidatePaymentCache).toHaveBeenCalled();
      expect(BookingUtils.emitBookingEvents).toHaveBeenCalled();
      
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: true,
        message: 'Berhasil memperbarui pembayaran booking',
        data: expect.any(Object),
      });
    });

    it('should handle invalid booking ID', async () => {
      // Arrange
      mockReq.params = { id: 'invalid' };
      mockReq.body = validUpdateData;
      
      // Mock the implementation for this specific test
      (prisma.booking.findUnique as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Invalid booking ID');
      });

      // Act
      await SuperAdminBookingController.updateBookingPayment(mockReq as Request, mockRes as Response);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: false,
        message: 'Gagal memperbarui pembayaran booking',
      });
    });

    it('should handle booking not found', async () => {
      // Arrange
      mockReq.params = { id: '999' };
      mockReq.body = validUpdateData;
      
      (prisma.booking.findUnique as jest.Mock).mockResolvedValueOnce(null);

      // Act
      await SuperAdminBookingController.updateBookingPayment(mockReq as Request, mockRes as Response);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: false,
        message: 'Booking tidak ditemukan',
      });
    });

    it('should handle invalid payment status', async () => {
      // Arrange
      mockReq.params = { id: '1' };
      mockReq.body = { paymentStatus: 'invalid_status' };
      
      // Act
      await SuperAdminBookingController.updateBookingPayment(mockReq as Request, mockRes as Response);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: false,
        message: 'Validasi gagal',
        errors: expect.any(Object)
      });
    });

    it('should handle database errors', async () => {
      // Arrange
      mockReq.params = { id: '1' };
      mockReq.body = validUpdateData;
      
      (prisma.booking.findUnique as jest.Mock).mockRejectedValueOnce(new Error('Database error'));

      // Act
      await SuperAdminBookingController.updateBookingPayment(mockReq as Request, mockRes as Response);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        status: false,
        message: 'Gagal memperbarui pembayaran booking',
      }));
    });
  });
}); 