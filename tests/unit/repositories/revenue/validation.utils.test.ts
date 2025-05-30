import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { validateDateRange, validateReportParams } from '../../../../src/repositories/revenue/validation.utils';
import { Response } from 'express';

describe('Revenue Validation Utils', () => {
  let mockRes: Partial<Response>;
  let originalConsoleError: any;

  beforeEach(() => {
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as Partial<Response>;
    // Menyimpan fungsi console.error asli dan mock-nya
    originalConsoleError = console.error;
    console.error = jest.fn();
  });

  afterEach(() => {
    // Mengembalikan fungsi console.error asli
    console.error = originalConsoleError;
  });

  describe('validateDateRange', () => {
    it('should return true for valid date range', () => {
      // Arrange
      const startDate = '2023-01-01';
      const endDate = '2023-01-31';

      // Act
      const result = validateDateRange(startDate, endDate, mockRes as Response);

      // Assert
      expect(result).toBe(true);
      expect(mockRes.status).not.toHaveBeenCalled();
      expect(mockRes.json).not.toHaveBeenCalled();
    });

    it('should return false if startDate is missing', () => {
      // Arrange
      const startDate = '';
      const endDate = '2023-01-31';

      // Act
      const result = validateDateRange(startDate, endDate, mockRes as Response);

      // Assert
      expect(result).toBe(false);
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: false,
        message: 'Parameter startDate dan endDate harus disediakan',
      });
    });

    it('should return false if endDate is missing', () => {
      // Arrange
      const startDate = '2023-01-01';
      const endDate = '';

      // Act
      const result = validateDateRange(startDate, endDate, mockRes as Response);

      // Assert
      expect(result).toBe(false);
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: false,
        message: 'Parameter startDate dan endDate harus disediakan',
      });
    });

    it('should return false for invalid date format', () => {
      // Arrange
      const startDate = 'not-a-date';
      const endDate = '2023-01-31';

      // Act
      const result = validateDateRange(startDate, endDate, mockRes as Response);

      // Assert
      expect(result).toBe(false);
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: false,
        message: 'Format tanggal tidak valid',
      });
    });

    it('should return false if endDate is before startDate', () => {
      // Arrange
      const startDate = '2023-01-31';
      const endDate = '2023-01-01';

      // Act
      const result = validateDateRange(startDate, endDate, mockRes as Response);

      // Assert
      expect(result).toBe(false);
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: false,
        message: 'endDate tidak boleh sebelum startDate',
      });
    });

    it('should return false if date range is more than 1 year', () => {
      // Arrange
      const startDate = '2023-01-01';
      const endDate = '2024-01-02'; // 367 days

      // Act
      const result = validateDateRange(startDate, endDate, mockRes as Response);

      // Assert
      expect(result).toBe(false);
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: false,
        message: 'Rentang waktu maksimal adalah 1 tahun',
      });
    });

    it('should return false and log error when an exception occurs', () => {
      // Arrange
      // Membuat objek Date yang akan melemparkan error saat konstruksi
      const originalDateConstructor = global.Date;
      global.Date = jest.fn(() => {
        throw new Error('Date constructor error');
      }) as any;
      global.Date.now = originalDateConstructor.now;

      const startDate = '2023-01-01';
      const endDate = '2023-01-31';

      // Act
      const result = validateDateRange(startDate, endDate, mockRes as Response);

      // Assert
      expect(result).toBe(false);
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: false,
        message: 'Format tanggal tidak valid',
      });
      expect(console.error).toHaveBeenCalled();
      
      // Restore original Date constructor
      global.Date = originalDateConstructor;
    });
  });

  describe('validateReportParams', () => {
    it('should return true for valid report type', () => {
      // Arrange
      const validTypes = ['daily', 'monthly', 'yearly'];

      // Act & Assert
      validTypes.forEach(type => {
        jest.clearAllMocks();
        const result = validateReportParams(type, mockRes as Response);
        expect(result).toBe(true);
        expect(mockRes.status).not.toHaveBeenCalled();
        expect(mockRes.json).not.toHaveBeenCalled();
      });
    });

    it('should return false for invalid report type', () => {
      // Arrange
      const type = 'invalid-type';

      // Act
      const result = validateReportParams(type, mockRes as Response);

      // Assert
      expect(result).toBe(false);
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: false,
        message: 'Parameter type harus berupa salah satu dari: daily, monthly, yearly',
      });
    });

    it('should return false if type is missing', () => {
      // Arrange
      const type = '';

      // Act
      const result = validateReportParams(type, mockRes as Response);

      // Assert
      expect(result).toBe(false);
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: false,
        message: 'Parameter type harus berupa salah satu dari: daily, monthly, yearly',
      });
    });
  });
}); 