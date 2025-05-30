import { describe, it, expect } from '@jest/globals';
import { updateBookingPaymentSchema } from '../../../src/zod-schemas/bookingPayment.schema';
import { PaymentStatus, PaymentMethod } from '../../../src/types';

describe('BookingPayment Schema Validation', () => {
  describe('updateBookingPaymentSchema', () => {
    it('should validate complete payment update data', () => {
      // Arrange
      const validData = {
        paymentStatus: PaymentStatus.PAID,
        paymentMethod: PaymentMethod.MIDTRANS,
        amount: 150000,
      };

      // Act
      const result = updateBookingPaymentSchema.parse(validData);

      // Assert
      expect(result).toEqual(validData);
    });

    it('should validate partial update with only status', () => {
      // Arrange
      const validData = {
        paymentStatus: PaymentStatus.PAID,
      };

      // Act
      const result = updateBookingPaymentSchema.parse(validData);

      // Assert
      expect(result).toEqual(validData);
    });

    it('should validate partial update with only method', () => {
      // Arrange
      const validData = {
        paymentMethod: PaymentMethod.CASH,
      };

      // Act
      const result = updateBookingPaymentSchema.parse(validData);

      // Assert
      expect(result).toEqual(validData);
    });

    it('should validate partial update with only amount', () => {
      // Arrange
      const validData = {
        amount: 200000,
      };

      // Act
      const result = updateBookingPaymentSchema.parse(validData);

      // Assert
      expect(result).toEqual(validData);
    });

    it('should validate empty object (no changes)', () => {
      // Arrange
      const validData = {};

      // Act
      const result = updateBookingPaymentSchema.parse(validData);

      // Assert
      expect(result).toEqual(validData);
    });

    it('should validate string amount and convert to number', () => {
      // Arrange
      const validData = {
        amount: '150000',
      };

      // Act
      const result = updateBookingPaymentSchema.parse(validData);

      // Assert
      expect(result).toEqual({
        amount: 150000, // String converted to number
      });
    });

    it('should reject invalid payment status', () => {
      // Arrange
      const invalidData = {
        paymentStatus: 'INVALID_STATUS' as any,
      };

      // Act & Assert
      expect(() => updateBookingPaymentSchema.parse(invalidData)).toThrow();
    });

    it('should reject invalid payment method', () => {
      // Arrange
      const invalidData = {
        paymentMethod: 'INVALID_METHOD' as any,
      };

      // Act & Assert
      expect(() => updateBookingPaymentSchema.parse(invalidData)).toThrow();
    });

    it('should reject negative amount', () => {
      // Arrange
      const invalidData = {
        amount: -100,
      };

      // Act & Assert
      expect(() => updateBookingPaymentSchema.parse(invalidData)).toThrow();
    });

    it('should reject non-numeric amount that cannot be converted', () => {
      // Arrange
      const invalidData = {
        amount: 'not-a-number' as any,
      };

      // Act & Assert
      expect(() => updateBookingPaymentSchema.parse(invalidData)).toThrow();
    });

    it('should accept zero amount', () => {
      // Arrange
      const validData = {
        amount: 0,
      };

      // Act
      const result = updateBookingPaymentSchema.parse(validData);

      // Assert
      expect(result).toEqual(validData);
    });

    it('should accept decimal amount', () => {
      // Arrange
      const validData = {
        amount: 150000.50,
      };

      // Act
      const result = updateBookingPaymentSchema.parse(validData);

      // Assert
      expect(result).toEqual(validData);
    });

    it('should accept string decimal amount and convert correctly', () => {
      // Arrange
      const validData = {
        amount: '150000.50',
      };

      // Act
      const result = updateBookingPaymentSchema.parse(validData);

      // Assert
      expect(result).toEqual({
        amount: 150000.50, // String converted to number
      });
    });
  });
}); 