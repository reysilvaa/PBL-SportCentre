// @ts-nocheck
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { Response } from 'express';
import { unitTestSetup } from '../../core';
import { User } from '../../../src/middlewares/auth.middleware';
import { PaymentStatus, PaymentMethod } from '../../../src/types';

// Setup unit test untuk controller
const { prismaMock } = unitTestSetup.setupControllerTest();

// Mock Utils
jest.mock('../../../src/utils/booking/booking.utils', () => ({
  sendErrorResponse: jest.fn(),
  validateBookingTime: jest.fn(),
  createBookingWithPayment: jest.fn(),
  processMidtransPayment: jest.fn(),
  emitBookingEvents: jest.fn(),
}));

jest.mock('../../../src/utils/booking/calculateBooking.utils', () => ({
  calculateTotalPrice: jest.fn(),
}));

jest.mock('../../../src/utils/cache/cacheInvalidation.utils', () => ({
  invalidateBookingCache: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../../src/middlewares/security.middleware', () => ({
  trackFailedBooking: jest.fn(),
  resetFailedBookingCounter: jest.fn(),
}));

jest.mock('../../../src/utils/variables/timezone.utils', () => ({
  TIMEZONE: 'Asia/Jakarta',
  formatDateToWIB: jest.fn((date) => date.toString()),
  formatDateToUTC: jest.fn((date) => date.toString()),
  combineDateWithTimeWIB: jest.fn((date, time) => {
    const [hours, minutes] = time.split(':').map(Number);
    const result = new Date(date);
    result.setHours(hours, minutes, 0, 0);
    return result;
  }),
}));

// Import controller setelah menyiapkan mock
import { createBooking, getUserBookings } from '../../../src/controllers/booking/user-booking.controller';

// Import mocked utils
import {
  sendErrorResponse,
  validateBookingTime,
  createBookingWithPayment,
  processMidtransPayment,
  emitBookingEvents,
} from '../../../src/utils/booking/booking.utils';
import { calculateTotalPrice } from '../../../src/utils/booking/calculateBooking.utils';
import { invalidateBookingCache } from '../../../src/utils/cache/cacheInvalidation.utils';

describe('User Booking Controller', () => {
  let mockRequest: Partial<User>;
  let mockResponse: Partial<Response>;
  let responseJson: jest.Mock;
  let responseStatus: jest.Mock;
  
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Setup response mock
    responseJson = jest.fn().mockReturnThis();
    responseStatus = jest.fn().mockReturnValue({ json: responseJson });
    
    mockResponse = {
      status: responseStatus as any,
      json: responseJson as any,
    };
    
    // Setup request mock
    mockRequest = {
      body: {
        userId: 1,
        fieldId: 1,
        bookingDate: '2023-07-15',
        startTime: '10:00',
        endTime: '12:00',
      },
      user: {
        id: 1,
        name: 'Test User',
        email: 'test@example.com',
        role: 'user',
      },
      ip: '127.0.0.1',
      socket: {
        remoteAddress: '127.0.0.1'
      }
    };
    
    // Mock console methods
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('createBooking', () => {
    it('seharusnya membuat booking baru dengan sukses', async () => {
      // Mock data
      const mockField = {
        id: 1,
        name: 'Lapangan A',
        priceDay: 100000,
        priceNight: 150000,
        branchId: 1,
        branch: {
          id: 1,
          name: 'Branch A',
        },
      };
      
      const mockUser = {
        id: 1,
        name: 'Test User',
        email: 'test@example.com',
        phone: '08123456789',
      };
      
      const mockBooking = {
        id: 1,
        userId: 1,
        fieldId: 1,
        bookingDate: new Date('2023-07-15'),
        startTime: new Date('2023-07-15T10:00:00'),
        endTime: new Date('2023-07-15T12:00:00'),
        status: 'pending',
        createdAt: new Date(),
      };
      
      const mockPayment = {
        id: 1,
        bookingId: 1,
        amount: 200000,
        method: PaymentMethod.MIDTRANS,
        status: PaymentStatus.PENDING,
        createdAt: new Date(),
      };
      
      const mockPaymentResult = {
        success: true,
        transaction: {
          transaction_id: 'test-transaction-123',
          redirect_url: 'https://midtrans.com/payment/test-123',
        },
        expiryDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 jam dari sekarang
      };
      
      // Setup mocks
      (validateBookingTime as jest.Mock).mockResolvedValue({ valid: true });
      (prismaMock.field.findUnique as jest.Mock).mockResolvedValue(mockField);
      (prismaMock.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (calculateTotalPrice as jest.Mock).mockReturnValue(200000);
      (createBookingWithPayment as jest.Mock).mockResolvedValue({ booking: mockBooking, payment: mockPayment });
      (processMidtransPayment as jest.Mock).mockResolvedValue(mockPaymentResult);
      (prismaMock.payment.update as jest.Mock).mockResolvedValue({
        ...mockPayment,
        transactionId: mockPaymentResult.transaction.transaction_id,
        paymentUrl: mockPaymentResult.transaction.redirect_url,
      });
      
      // Call function
      await createBooking(mockRequest as User, mockResponse as Response);
      
      // Assertions
      expect(validateBookingTime).toHaveBeenCalled();
      expect(prismaMock.field.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        include: { branch: true },
      });
      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        select: { name: true, email: true, phone: true },
      });
      expect(calculateTotalPrice).toHaveBeenCalled();
      expect(createBookingWithPayment).toHaveBeenCalled();
      expect(processMidtransPayment).toHaveBeenCalled();
      expect(emitBookingEvents).toHaveBeenCalled();
      expect(invalidateBookingCache).toHaveBeenCalled();
      expect(responseStatus).toHaveBeenCalledWith(201);
      expect(responseJson).toHaveBeenCalledWith(expect.objectContaining({
        booking: expect.objectContaining({
          field: expect.any(Object),
          payment: expect.objectContaining({
            paymentUrl: mockPaymentResult.transaction.redirect_url,
          }),
        }),
      }));
    });
    
    it('seharusnya mengembalikan error jika validasi gagal', async () => {
      // Force validation error
      mockRequest.body = {
        userId: 1,
        // Missing required fields
      };
      
      // Call function
      await createBooking(mockRequest as User, mockResponse as Response);
      
      // Assertions
      expect(sendErrorResponse).toHaveBeenCalled();
      expect(createBookingWithPayment).not.toHaveBeenCalled();
    });
    
    it('seharusnya mengembalikan error jika validasi waktu booking gagal', async () => {
      // Setup validation failure
      (validateBookingTime as jest.Mock).mockResolvedValue({
        valid: false,
        message: 'Waktu booking tidak tersedia',
        details: { reason: 'Sudah ada booking di waktu tersebut' },
      });
      
      // Call function
      await createBooking(mockRequest as User, mockResponse as Response);
      
      // Assertions
      expect(validateBookingTime).toHaveBeenCalled();
      expect(sendErrorResponse).toHaveBeenCalledWith(
        mockResponse,
        400,
        'Waktu booking tidak tersedia',
        expect.any(Object)
      );
      expect(createBookingWithPayment).not.toHaveBeenCalled();
    });
  });
  
  describe('getUserBookings', () => {
    it('seharusnya mengembalikan daftar booking untuk user tertentu', async () => {
      // Setup request
      mockRequest.params = { userId: '1' };
      
      // Mock data
      const mockBookings = [
        {
          id: 1,
          userId: 1,
          fieldId: 1,
          bookingDate: new Date('2023-07-15'),
          startTime: new Date('2023-07-15T10:00:00'),
          endTime: new Date('2023-07-15T12:00:00'),
          status: 'completed',
          field: {
            id: 1,
            name: 'Lapangan A',
            branch: {
              id: 1,
              name: 'Branch A',
              location: 'Malang',
              imageUrl: 'https://example.com/image.jpg',
            },
            type: {
              id: 1,
              name: 'Futsal',
            },
          },
          payment: {
            id: 1,
            bookingId: 1,
            amount: 200000,
            status: PaymentStatus.PAID,
          },
        },
      ];
      
      // Setup mock
      (prismaMock.booking.findMany as jest.Mock).mockResolvedValue(mockBookings);
      
      // Call function
      await getUserBookings(mockRequest as User, mockResponse as Response);
      
      // Assertions
      expect(prismaMock.booking.findMany).toHaveBeenCalledWith({
        where: { userId: 1 },
        include: expect.any(Object),
        orderBy: { bookingDate: 'desc' },
      });
      expect(responseJson).toHaveBeenCalledWith(mockBookings);
    });
    
    it('seharusnya mengembalikan error untuk ID user yang tidak valid', async () => {
      // Setup request with invalid ID
      mockRequest.params = { userId: 'invalid' };
      
      // Call function
      await getUserBookings(mockRequest as User, mockResponse as Response);
      
      // Assertions
      expect(sendErrorResponse).toHaveBeenCalledWith(
        mockResponse,
        400,
        'Invalid user ID'
      );
      expect(prismaMock.booking.findMany).not.toHaveBeenCalled();
    });
  });
}); 




