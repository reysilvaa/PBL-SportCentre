import { Request, Response } from 'express';
import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import * as AdminBookingController from '../../../../src/controllers/booking/admin-booking.controller';
import prisma from '../../../../src/config/services/database';
import * as BookingUtils from '../../../../src/utils/booking/booking.utils';
import { PaymentStatus } from '../../../../src/types/enums';

// Mock dependencies
jest.mock('../../../../src/config/services/database', () => ({
  booking: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
  },
  field: {
    findUnique: jest.fn(),
  },
  branch: {
    findUnique: jest.fn(),
  },
  branchAdmin: {
    findFirst: jest.fn(),
  },
  payment: {
    update: jest.fn(),
  },
}));

jest.mock('../../../../src/utils/booking/booking.utils', () => ({
  sendErrorResponse: jest.fn(),
  validateBookingTime: jest.fn(),
  createBookingWithPayment: jest.fn(),
  emitBookingEvents: jest.fn(),
  getCompleteBooking: jest.fn(),
  verifyFieldBranch: jest.fn(),
}));

jest.mock('../../../../src/utils/cache/cacheInvalidation.utils', () => ({
  invalidateBookingCache: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../../../src/utils/booking/calculateBooking.utils', () => ({
  calculateTotalPrice: jest.fn(),
  combineDateWithTime: jest.fn(),
}));

describe('Admin Booking Controller', () => {
  let mockReq: Partial<Request & { user?: any; userBranch?: any }>;
  let mockRes: Partial<Response>;
  
  beforeEach(() => {
    mockReq = {
      query: {},
      params: {},
      body: {},
      user: {
        id: 1,
        role: 'admin_cabang',
      },
      userBranch: {
        id: 1,
      },
    };
    
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    
    jest.clearAllMocks();
  });
  
  describe('getBranchBookings', () => {
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
          status: PaymentStatus.paid,
        },
      },
    ];

    it('should return bookings for branch admin', async () => {
      // Arrange
      mockReq.userBranch = {
        id: 1,
      };
      
      (prisma.booking.findMany as jest.Mock).mockResolvedValueOnce(mockBookings);

      // Act
      await AdminBookingController.getBranchBookings(mockReq as any, mockRes as Response);

      // Assert
      expect(prisma.booking.findMany).toHaveBeenCalledWith({
        where: { field: { branchId: 1 } },
        include: {
          user: { select: { id: true, name: true, email: true, phone: true } },
          field: { 
            include: { 
              branch: {
                select: { id: true, name: true, location: true, imageUrl: true }
              }
            } 
          },
          payment: true,
        },
        orderBy: { bookingDate: 'desc' },
      });
      
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(mockBookings);
    });

    it('should return error if branch ID is not available', async () => {
      // Arrange
      mockReq.userBranch = undefined;

      // Act
      await AdminBookingController.getBranchBookings(mockReq as any, mockRes as Response);

      // Assert
      expect(BookingUtils.sendErrorResponse).toHaveBeenCalledWith(
        mockRes,
        400,
        'Branch ID is required'
      );
    });

    it('should handle database errors', async () => {
      // Arrange
      (prisma.booking.findMany as jest.Mock).mockRejectedValueOnce(new Error('Database error'));
      
      // Act
      await AdminBookingController.getBranchBookings(mockReq as any, mockRes as Response);
      
      // Assert
      expect(BookingUtils.sendErrorResponse).toHaveBeenCalledWith(
        mockRes,
        500,
        'Internal Server Error'
      );
    });
  });
  
  describe('getBranchBookingById', () => {
    it('should return booking by ID for branch admin', async () => {
      // Arrange
      mockReq.params = { id: '42' };
      mockReq.userBranch = { id: 1 };
      
      (prisma.booking.findFirst as jest.Mock).mockResolvedValueOnce({
        id: 42,
        fieldId: 10,
        field: { branchId: 1, name: 'Lapangan A' },
        user: { id: 123, name: 'John Doe', email: 'john@example.com' },
        startTime: new Date(),
        endTime: new Date(),
        status: 'confirmed',
      });

      // Act
      await AdminBookingController.getBranchBookingById(mockReq as any, mockRes as Response);

      // Assert
      expect(prisma.booking.findFirst).toHaveBeenCalledWith({
        where: { id: 42, field: { branchId: 1 } },
        include: {
          user: { select: { id: true, name: true, email: true, phone: true } },
          field: { include: { branch: true, type: true } },
          payment: true,
        },
      });
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('should return 404 if booking is not found', async () => {
      // Arrange
      mockReq.params = { id: '42' };
      mockReq.userBranch = { id: 1 };
      
      (prisma.booking.findFirst as jest.Mock).mockResolvedValueOnce(null);

      // Act
      await AdminBookingController.getBranchBookingById(mockReq as any, mockRes as Response);

      // Assert
      expect(BookingUtils.sendErrorResponse).toHaveBeenCalledWith(
        mockRes,
        404,
        'Booking not found for this branch'
      );
    });

    it('should return error if branch ID is not available', async () => {
      // Arrange
      mockReq.params = { id: '42' };
      mockReq.userBranch = undefined;
      
      // Act
      await AdminBookingController.getBranchBookingById(mockReq as any, mockRes as Response);
      
      // Assert
      expect(BookingUtils.sendErrorResponse).toHaveBeenCalledWith(
        mockRes,
        400,
        'Branch ID is required'
      );
    });

    it('should handle database errors', async () => {
      // Arrange
      mockReq.params = { id: '42' };
      mockReq.userBranch = { id: 1 };
      (prisma.booking.findFirst as jest.Mock).mockRejectedValueOnce(new Error('Database error'));
      
      // Act
      await AdminBookingController.getBranchBookingById(mockReq as any, mockRes as Response);
      
      // Assert
      expect(BookingUtils.sendErrorResponse).toHaveBeenCalledWith(
        mockRes,
        500,
        'Internal Server Error'
      );
    });
  });

  describe('createManualBooking', () => {
    const mockField = {
      id: 10,
      name: 'Lapangan Futsal A',
      branchId: 1,
      priceDay: 100000,
      priceNight: 150000,
    };
    
    const mockBookingResult = {
      booking: {
        id: 42,
        userId: 456,
        fieldId: 10,
        bookingDate: new Date('2025-06-01'),
        startTime: new Date('2025-06-01T01:00:00'),
        endTime: new Date('2025-06-01T03:00:00'),
        status: 'confirmed',
      },
      payment: {
        id: 42,
        bookingId: 42,
        amount: 200000,
        status: 'paid',
        method: 'cash',
      },
    };
    
    const validBookingData = {
      userId: 456,
      fieldId: 10,
      bookingDate: '2025-06-01',
      startTime: '01:00',
      endTime: '03:00',
      paymentStatus: 'paid',
      paymentMethod: 'cash',
      amount: 200000,
    };

    it('should create a manual booking successfully', async () => {
      // Arrange
      mockReq.body = validBookingData;
      mockReq.userBranch = {
        id: 1,
      };
      
      (BookingUtils.verifyFieldBranch as jest.Mock).mockResolvedValueOnce(mockField);
      (BookingUtils.validateBookingTime as jest.Mock).mockResolvedValueOnce({ valid: true });
      (BookingUtils.createBookingWithPayment as jest.Mock).mockResolvedValueOnce(mockBookingResult);
      
      // Act
      await AdminBookingController.createManualBooking(mockReq as any, mockRes as Response);

      // Assert
      expect(BookingUtils.verifyFieldBranch).toHaveBeenCalledWith(10, 1);
      expect(BookingUtils.validateBookingTime).toHaveBeenCalled();
      expect(BookingUtils.createBookingWithPayment).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: true,
        message: 'Booking manual berhasil dibuat dengan pembayaran cash',
        data: mockBookingResult,
      });
    });

    it('should return error if branch ID is not available', async () => {
      // Arrange
      mockReq.body = validBookingData;
      mockReq.userBranch = undefined;
      
      // Act
      await AdminBookingController.createManualBooking(mockReq as any, mockRes as Response);
      
      // Assert
      expect(BookingUtils.sendErrorResponse).toHaveBeenCalledWith(
        mockRes,
        400,
        'Branch ID is required'
      );
    });

    it('should return 404 if field is not found in branch', async () => {
      // Arrange
      mockReq.body = validBookingData;
      mockReq.userBranch = { id: 1 };
      (BookingUtils.verifyFieldBranch as jest.Mock).mockResolvedValueOnce(null);
      
      // Act
      await AdminBookingController.createManualBooking(mockReq as any, mockRes as Response);
      
      // Assert
      expect(BookingUtils.sendErrorResponse).toHaveBeenCalledWith(
        mockRes,
        404,
        'Field not found in this branch'
      );
    });

    it('should return 400 if booking time validation fails', async () => {
      // Arrange
      mockReq.body = validBookingData;
      mockReq.userBranch = { id: 1 };
      (BookingUtils.verifyFieldBranch as jest.Mock).mockResolvedValueOnce(mockField);
      (BookingUtils.validateBookingTime as jest.Mock).mockResolvedValueOnce({
        valid: false,
        message: 'Time slot not available',
        details: { conflict: 'Overlapping booking' },
      });
      
      // Act
      await AdminBookingController.createManualBooking(mockReq as any, mockRes as Response);
      
      // Assert
      expect(BookingUtils.sendErrorResponse).toHaveBeenCalledWith(
        mockRes,
        400,
        'Time slot not available',
        { conflict: 'Overlapping booking' }
      );
    });

    it('should handle database errors', async () => {
      // Arrange
      mockReq.body = validBookingData;
      mockReq.userBranch = {
        id: 1,
      };
      
      (BookingUtils.verifyFieldBranch as jest.Mock).mockRejectedValueOnce(new Error('Database error'));

      // Act
      await AdminBookingController.createManualBooking(mockReq as any, mockRes as Response);

      // Assert
      expect(BookingUtils.sendErrorResponse).toHaveBeenCalledWith(
        mockRes,
        500,
        'Internal Server Error'
      );
    });
  });
}); 