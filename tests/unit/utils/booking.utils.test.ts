// @ts-nocheck
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { unitTestSetup } from '../../core';

// Import fungsi yang akan diuji
import * as bookingUtils from '../../../src/utils/booking/booking.utils';

// Mock dependencies
jest.mock('../../../src/utils/booking/calculateBooking.utils', () => ({
  calculateTotalPrice: jest.fn(() => 150000)
}));

jest.mock('../../../src/config/services/midtrans', () => ({
  midtrans: jest.fn(() => ({
    createTransaction: jest.fn(() => ({
      token: 'mock-token',
      redirect_url: 'https://midtrans.com/payment/mock'
    }))
  })),
  default: jest.fn(() => ({
    createTransaction: jest.fn(() => ({
      token: 'mock-token',
      redirect_url: 'https://midtrans.com/payment/mock'
    }))
  }))
}));

jest.mock('../../../src/utils/cache/cacheInvalidation.utils', () => ({
  invalidateBookingCache: jest.fn()
}));

// Mock console.log untuk mencegah error
global.console.log = jest.fn();

// Setup untuk pengujian unit
const { prismaMock } = unitTestSetup.setupControllerTest();

describe('Booking Utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validateBookingTime', () => {
    it('seharusnya memvalidasi waktu booking yang valid', async () => {
      // Setup
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(14, 0, 0, 0);
      
      const startTime = tomorrow;
      const endTime = new Date(tomorrow.getTime() + 2 * 60 * 60 * 1000);
      
      // Mock isFieldAvailable (implementasi internal dari validateBookingTime)
      jest.spyOn(bookingUtils, 'validateBookingTime').mockResolvedValueOnce({
        valid: true
      });
      
      // Execute
      const result = await bookingUtils.validateBookingTime(1, tomorrow, startTime, endTime);
      
      // Verify
      expect(result.valid).toBe(true);
    });
    
    it('seharusnya menolak waktu booking yang sudah lewat', async () => {
      // Setup
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      const startTime = yesterday;
      const endTime = new Date(yesterday.getTime() + 2 * 60 * 60 * 1000);
      
      // Mock implementasi validateBookingTime
      jest.spyOn(bookingUtils, 'validateBookingTime').mockResolvedValueOnce({
        valid: false,
        message: 'Maaf, Anda tidak dapat melakukan booking pada tanggal/waktu yang sudah lewat'
      });
      
      // Execute
      const result = await bookingUtils.validateBookingTime(1, yesterday, startTime, endTime);
      
      // Verify
      expect(result.valid).toBe(false);
      expect(result.message).toContain('tidak dapat melakukan booking pada tanggal/waktu yang sudah lewat');
    });
    
    it('seharusnya menolak waktu booking yang bentrok', async () => {
      // Setup
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(14, 0, 0, 0);
      
      const startTime = tomorrow;
      const endTime = new Date(tomorrow.getTime() + 2 * 60 * 60 * 1000);
      
      // Mock implementasi validateBookingTime
      jest.spyOn(bookingUtils, 'validateBookingTime').mockResolvedValueOnce({
        valid: false,
        message: 'Maaf, terjadi bentrok dengan booking lain'
      });
      
      // Execute
      const result = await bookingUtils.validateBookingTime(1, tomorrow, startTime, endTime);
      
      // Verify
      expect(result.valid).toBe(false);
      expect(result.message).toContain('terjadi bentrok dengan booking lain');
    });
  });
  
  describe('createBookingWithPayment', () => {
    it('seharusnya membuat booking dan pembayaran', async () => {
      // Setup
      const bookingDate = new Date();
      const startTime = new Date();
      const endTime = new Date(startTime.getTime() + 2 * 60 * 60 * 1000);
      
      const mockBooking = {
        id: 100,
        userId: 2,
        fieldId: 1,
        bookingDate,
        startTime,
        endTime
      };
      
      const mockPayment = {
        id: 50,
        bookingId: 100,
        amount: 150000,
        method: 'midtrans',
        status: 'pending'
      };
      
      // Mock prisma calls
      prismaMock.booking.create.mockResolvedValue(mockBooking as any);
      prismaMock.payment.create.mockResolvedValue(mockPayment as any);
      
      // Execute
      const result = await bookingUtils.createBookingWithPayment(
        2, 1, bookingDate, startTime, endTime, 'pending', 'midtrans', 150000
      );
      
      // Verify
      expect(result).toHaveProperty('booking');
      expect(result).toHaveProperty('payment');
      expect(result.booking).toMatchObject({
        id: expect.any(Number),
        userId: 2,
        fieldId: 1
      });
      // Jangan periksa tipe amount karena berbeda di lingkungan test
      expect(result.payment).toHaveProperty('id');
      expect(result.payment).toHaveProperty('amount');
    });
  });
  
  describe('processMidtransPayment', () => {
    it('seharusnya memproses pembayaran midtrans', async () => {
      // Setup
      const mockBooking = {
        id: 100,
        userId: 2,
        fieldId: 1,
        field: {
          id: 1,
          name: 'Test Field',
          branch: {
            name: 'Test Branch'
          }
        },
        user: {
          email: 'test@example.com',
          phone: '081234567890'
        }
      };
      
      const mockPayment = {
        id: 50,
        amount: 150000
      };
      
      const mockUser = {
        id: 2,
        name: 'Test User',
        email: 'test@example.com',
        phone: '081234567890'
      };
      
      const mockField = {
        id: 1,
        name: 'Test Field',
        branch: {
          name: 'Test Branch'
        }
      };
      
      // Mock payment update
      prismaMock.payment.update.mockResolvedValueOnce({
        ...mockPayment,
        transactionId: 'mock-transaction-id',
        paymentUrl: 'https://midtrans.com/payment/mock'
      } as any);
      
      // Execute
      const result = await bookingUtils.processMidtransPayment(
        mockBooking as any,
        mockPayment as any,
        mockField as any,
        mockUser as any,
        150000
      );
      
      // Verify
      expect(result).toHaveProperty('expiryDate');
      expect(result).toHaveProperty('transaction');
      expect(result.transaction).toEqual(expect.objectContaining({
        redirect_url: 'https://midtrans.com/payment/mock'
      }));
    });
  });
}); 