import { describe, it, expect } from '@jest/globals';
import { createBookingSchema, updateBookingSchema } from '../../../src/zod-schemas/booking.schema';

describe('Booking Schema Validation', () => {
  describe('createBookingSchema', () => {
    it('seharusnya valid dengan data booking yang benar', () => {
      // Arrange
      const validData = {
        userId: 1,
        fieldId: 1,
        bookingDate: '2023-06-15',
        startTime: '10:00',
        endTime: '12:00',
      };

      // Act & Assert
      expect(() => createBookingSchema.parse(validData)).not.toThrow();
    });

    it('seharusnya valid dengan string numbers untuk userId dan fieldId', () => {
      // Arrange
      const validData = {
        userId: '1',
        fieldId: '1',
        bookingDate: '2023-06-15',
        startTime: '10:00',
        endTime: '12:00',
      };

      // Act
      const result = createBookingSchema.parse(validData);

      // Assert
      expect(result.userId).toBe(1);
      expect(result.fieldId).toBe(1);
      expect(result.bookingDate).toBe('2023-06-15');
      expect(result.startTime).toBe('10:00');
      expect(result.endTime).toBe('12:00');
    });

    it('seharusnya error ketika userId bukan angka', () => {
      // Arrange
      const invalidData = {
        userId: 'abc',
        fieldId: 1,
        bookingDate: '2023-06-15',
        startTime: '10:00',
        endTime: '12:00',
      };

      // Act & Assert
      expect(() => createBookingSchema.parse(invalidData)).toThrow();
    });

    it('seharusnya error ketika fieldId bukan angka', () => {
      // Arrange
      const invalidData = {
        userId: 1,
        fieldId: 'abc',
        bookingDate: '2023-06-15',
        startTime: '10:00',
        endTime: '12:00',
      };

      // Act & Assert
      expect(() => createBookingSchema.parse(invalidData)).toThrow();
    });

    it('seharusnya error ketika bookingDate tidak valid', () => {
      // Arrange
      const invalidData = {
        userId: 1,
        fieldId: 1,
        bookingDate: 'bukan-tanggal',
        startTime: '10:00',
        endTime: '12:00',
      };

      // Act & Assert
      expect(() => createBookingSchema.parse(invalidData)).toThrow();
    });

    it('seharusnya error ketika startTime format tidak valid', () => {
      // Arrange
      const invalidData = {
        userId: 1,
        fieldId: 1,
        bookingDate: '2023-06-15',
        startTime: '25:00', // Jam tidak valid
        endTime: '12:00',
      };

      // Act & Assert
      expect(() => createBookingSchema.parse(invalidData)).toThrow();
    });

    it('seharusnya error ketika endTime format tidak valid', () => {
      // Arrange
      const invalidData = {
        userId: 1,
        fieldId: 1,
        bookingDate: '2023-06-15',
        startTime: '10:00',
        endTime: '10:70', // Menit tidak valid
      };

      // Act & Assert
      expect(() => createBookingSchema.parse(invalidData)).toThrow();
    });

    it('seharusnya error ketika field wajib tidak ada', () => {
      // Arrange
      const invalidData = {
        userId: 1,
        fieldId: 1,
        // bookingDate hilang
        startTime: '10:00',
        endTime: '12:00',
      };

      // Act & Assert
      expect(() => createBookingSchema.parse(invalidData)).toThrow();
    });
  });

  describe('updateBookingSchema', () => {
    it('seharusnya valid dengan data lengkap', () => {
      // Arrange
      const validData = {
        userId: 1,
        fieldId: 1,
        bookingDate: '2023-06-15',
        startTime: '10:00',
        endTime: '12:00',
      };

      // Act & Assert
      expect(() => updateBookingSchema.parse(validData)).not.toThrow();
    });

    it('seharusnya valid dengan data sebagian (partial)', () => {
      // Arrange
      const validData = {
        startTime: '11:00',
        endTime: '13:00',
      };

      // Act & Assert
      expect(() => updateBookingSchema.parse(validData)).not.toThrow();
    });

    it('seharusnya valid dengan objek kosong', () => {
      // Arrange
      const validData = {};

      // Act & Assert
      expect(() => updateBookingSchema.parse(validData)).not.toThrow();
    });

    it('seharusnya error ketika field opsional tidak valid', () => {
      // Arrange
      const invalidData = {
        startTime: '24:00', // Jam tidak valid
      };

      // Act & Assert
      expect(() => updateBookingSchema.parse(invalidData)).toThrow();
    });
  });
}); 