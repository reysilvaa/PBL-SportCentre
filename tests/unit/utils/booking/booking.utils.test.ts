// @ts-nocheck
import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import * as bookingUtils from '../../../../src/utils/booking/booking.utils';
import { calculateTotalPrice } from '../../../../src/utils/booking/calculateBooking.utils';
import { isWithinInterval } from 'date-fns';

// Mock date-fns
jest.mock('date-fns', () => ({
  isWithinInterval: jest.fn().mockReturnValue(true),
}));

// Mock timezone utils
jest.mock('../../../../src/utils/variables/timezone.utils', () => ({
  combineDateWithTimeWIB: jest.fn().mockImplementation((date, timeString) => {
    const [hours, minutes] = timeString.split(':').map(Number);
    const newDate = new Date(date);
    newDate.setHours(hours, minutes, 0, 0);
    return newDate;
  }),
  formatDateToWIB: jest.fn().mockImplementation(date => date.toISOString()),
}));

// Mock database
jest.mock('../../../../src/config/services/database', () => ({
  __esModule: true,
  default: {
    booking: {
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
    },
    field: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    payment: {
      findMany: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
  },
}));

// Mock queue
jest.mock('../../../../src/config/services/queue', () => ({
  bookingCleanupQueue: {
    add: jest.fn(),
    process: jest.fn(),
  },
}));

describe('Booking Utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('calculateTotalPrice', () => {
    it('should calculate total price correctly for daytime bookings', () => {
      const startTime = new Date('2023-08-01T10:00:00Z');
      const endTime = new Date('2023-08-01T12:00:00Z');
      const dayPrice = 100000;
      const nightPrice = 150000;
      
      // Mock isWithinInterval to simulate daytime booking
      isWithinInterval.mockImplementation(() => true);
      
      const result = calculateTotalPrice(startTime, endTime, dayPrice, nightPrice);
      
      // 2 hours * 100000 = 200000
      expect(result).toBe(200000);
    });
    
    it('should calculate total price correctly for nighttime bookings', () => {
      const startTime = new Date('2023-08-01T19:00:00Z');
      const endTime = new Date('2023-08-01T21:00:00Z');
      const dayPrice = 100000;
      const nightPrice = 150000;
      
      // Mock isWithinInterval to simulate nighttime booking
      isWithinInterval.mockImplementation(() => false);
      
      const result = calculateTotalPrice(startTime, endTime, dayPrice, nightPrice);
      
      // 2 hours * 150000 = 300000
      expect(result).toBe(300000);
    });
  });
  
  describe('validateBookingTime', () => {
    it('should validate booking time correctly', async () => {
      const fieldId = 1;
      const bookingDate = new Date('2023-08-01');
      const startTime = new Date('2023-08-01T10:00:00Z');
      const endTime = new Date('2023-08-01T12:00:00Z');
      
      // Mock the isFieldAvailable function to return true
      const mockIsFieldAvailable = jest.spyOn(require('../../../../src/utils/booking/checkAvailability.utils'), 'isFieldAvailable').mockResolvedValue(true);
      
      const result = await bookingUtils.validateBookingTime(fieldId, bookingDate, startTime, endTime);
      
      expect(result.valid).toBe(true);
      expect(mockIsFieldAvailable).toHaveBeenCalledWith(fieldId, bookingDate, startTime, endTime);
    });
    
    it('should reject when end time is before start time', async () => {
      const fieldId = 1;
      const bookingDate = new Date('2023-08-01');
      const startTime = new Date('2023-08-01T12:00:00Z');
      const endTime = new Date('2023-08-01T10:00:00Z');
      
      const result = await bookingUtils.validateBookingTime(fieldId, bookingDate, startTime, endTime);
      
      expect(result.valid).toBe(false);
      expect(result.message).toBe('Waktu selesai harus setelah waktu mulai');
    });
  });
  
  describe('verifyFieldBranch', () => {
    it('should verify field belongs to branch', async () => {
      const fieldId = 1;
      const branchId = 1;
      const mockField = { id: 1, name: 'Test Field', branchId: 1 };
      
      const prisma = require('../../../../src/config/services/database').default;
      prisma.field.findFirst.mockResolvedValue(mockField);
      
      const result = await bookingUtils.verifyFieldBranch(fieldId, branchId);
      
      expect(result).toEqual(mockField);
      expect(prisma.field.findFirst).toHaveBeenCalledWith({
        where: {
          id: fieldId,
          branchId: branchId,
        },
      });
    });
    
    it('should return null if field does not belong to branch', async () => {
      const fieldId = 1;
      const branchId = 2; // Different branch
      
      const prisma = require('../../../../src/config/services/database').default;
      prisma.field.findFirst.mockResolvedValue(null);
      
      const result = await bookingUtils.verifyFieldBranch(fieldId, branchId);
      
      expect(result).toBeNull();
    });
  });
  
  describe('createBookingWithPayment', () => {
    it('should create booking and payment records', async () => {
      const userId = 1;
      const fieldId = 1;
      const bookingDate = new Date('2023-08-01');
      const startTime = new Date('2023-08-01T10:00:00Z');
      const endTime = new Date('2023-08-01T12:00:00Z');
      const paymentStatus = 'pending';
      const paymentMethod = 'cash';
      const amount = 200000;
      
      const mockBooking = { id: 1, userId, fieldId, bookingDate, startTime, endTime };
      const mockPayment = { id: 1, bookingId: 1, userId, amount, status: paymentStatus, paymentMethod };
      
      const prisma = require('../../../../src/config/services/database').default;
      prisma.booking.create = jest.fn().mockResolvedValue(mockBooking);
      prisma.payment.create = jest.fn().mockResolvedValue(mockPayment);
      
      const result = await bookingUtils.createBookingWithPayment(
        userId, fieldId, bookingDate, startTime, endTime, paymentStatus, paymentMethod, amount
      );
      
      expect(result).toEqual({ booking: mockBooking, payment: mockPayment });
      expect(prisma.booking.create).toHaveBeenCalledWith({
        data: {
          userId,
          fieldId,
          bookingDate,
          startTime,
          endTime,
        },
      });
      expect(prisma.payment.create).toHaveBeenCalledWith({
        data: {
          bookingId: mockBooking.id,
          userId,
          amount,
          status: paymentStatus,
          paymentMethod,
        },
      });
    });
  });
  
  describe('sendErrorResponse', () => {
    it('should send error response correctly', () => {
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      
      bookingUtils.sendErrorResponse(res, 400, 'Bad Request', { field: 'error' });
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Bad Request',
        details: { field: 'error' },
      });
    });
  });
}); 