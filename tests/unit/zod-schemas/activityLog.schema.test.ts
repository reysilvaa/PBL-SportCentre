import { describe, it, expect } from '@jest/globals';
import { createActivityLogSchema } from '../../../src/zod-schemas/activityLog.schema';

describe('ActivityLog Schema Validation', () => {
  describe('createActivityLogSchema', () => {
    it('should validate valid activity log data with numeric ID', () => {
      // Arrange
      const validData = {
        userId: 1,
        action: 'USER_LOGIN',
        details: 'User logged in successfully',
      };

      // Act
      const result = createActivityLogSchema.parse(validData);

      // Assert
      expect(result).toEqual(validData);
    });

    it('should validate valid activity log data with string ID (converted to number)', () => {
      // Arrange
      const validData = {
        userId: '1',
        action: 'USER_LOGIN',
        details: 'User logged in successfully',
      };

      // Act
      const result = createActivityLogSchema.parse(validData);

      // Assert
      expect(result).toEqual({
        userId: 1, // String converted to number
        action: 'USER_LOGIN',
        details: 'User logged in successfully',
      });
    });

    it('should validate log with relatedId', () => {
      // Arrange
      const validData = {
        userId: 1,
        action: 'BOOKING_CREATED',
        details: 'Booking created successfully',
        relatedId: 42, // Booking ID
      };

      // Act
      const result = createActivityLogSchema.parse(validData);

      // Assert
      expect(result).toEqual(validData);
    });

    it('should validate log with string relatedId (converted to number)', () => {
      // Arrange
      const validData = {
        userId: 1,
        action: 'BOOKING_CREATED',
        details: 'Booking created successfully',
        relatedId: '42', // String ID
      };

      // Act
      const result = createActivityLogSchema.parse(validData);

      // Assert
      expect(result).toEqual({
        userId: 1,
        action: 'BOOKING_CREATED',
        details: 'Booking created successfully',
        relatedId: 42, // String converted to number
      });
    });

    it('should validate log with null relatedId', () => {
      // Arrange
      const validData = {
        userId: 1,
        action: 'SYSTEM_MAINTENANCE',
        details: 'System maintenance performed',
        relatedId: null,
      };

      // Act
      const result = createActivityLogSchema.parse(validData);

      // Assert
      expect(result).toEqual(validData);
    });

    it('should validate log with IP address', () => {
      // Arrange
      const validData = {
        userId: 1,
        action: 'USER_LOGIN',
        details: 'User logged in successfully',
        ipAddress: '192.168.1.1',
      };

      // Act
      const result = createActivityLogSchema.parse(validData);

      // Assert
      expect(result).toEqual(validData);
    });

    it('should validate log with all optional fields', () => {
      // Arrange
      const validData = {
        userId: 1,
        action: 'BOOKING_CREATED',
        details: 'Booking created successfully',
        relatedId: 42,
        ipAddress: '192.168.1.1',
      };

      // Act
      const result = createActivityLogSchema.parse(validData);

      // Assert
      expect(result).toEqual(validData);
    });

    it('should reject invalid userId format', () => {
      // Arrange
      const invalidData = {
        userId: 'abc', // Not a number
        action: 'USER_LOGIN',
        details: 'User logged in successfully',
      };

      // Act & Assert
      expect(() => createActivityLogSchema.parse(invalidData)).toThrow();
    });

    it('should reject empty action', () => {
      // Arrange
      const invalidData = {
        userId: 1,
        action: '', // Empty action
        details: 'User logged in successfully',
      };

      // Act & Assert
      expect(() => createActivityLogSchema.parse(invalidData)).toThrow();
    });

    it('should reject empty details', () => {
      // Arrange
      const invalidData = {
        userId: 1,
        action: 'USER_LOGIN',
        details: '', // Empty details
      };

      // Act & Assert
      expect(() => createActivityLogSchema.parse(invalidData)).toThrow();
    });

    it('should reject invalid relatedId format', () => {
      // Arrange
      const invalidData = {
        userId: 1,
        action: 'BOOKING_CREATED',
        details: 'Booking created successfully',
        relatedId: 'abc', // Not a number or null
      };

      // Act & Assert
      expect(() => createActivityLogSchema.parse(invalidData)).toThrow();
    });

    it('should reject missing required fields', () => {
      // Arrange
      const invalidData = {
        userId: 1,
        // Missing action and details
      };

      // Act & Assert
      expect(() => createActivityLogSchema.parse(invalidData)).toThrow();
    });
  });
}); 