import { describe, it, expect } from '@jest/globals';
import { registerSchema, loginSchema } from '../../../src/zod-schemas/auth.schema';
import { Role } from '../../../src/types';

describe('Auth Schema Validation', () => {
  describe('registerSchema', () => {
    it('should validate a valid registration input', () => {
      // Arrange
      const validData = {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
        phone: '081234567890',
      };

      // Act
      const result = registerSchema.parse(validData);

      // Assert
      expect(result).toEqual({
        ...validData,
        role: Role.USER, // Default role should be added
      });
    });

    it('should validate registration without optional phone number', () => {
      // Arrange
      const validData = {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
      };

      // Act
      const result = registerSchema.parse(validData);

      // Assert
      expect(result).toEqual({
        ...validData,
        role: Role.USER, // Default role should be added
      });
    });

    it('should validate registration with custom role', () => {
      // Arrange
      const validData = {
        email: 'admin@example.com',
        password: 'password123',
        name: 'Admin User',
        phone: '081234567890',
        role: Role.SUPER_ADMIN,
      };

      // Act
      const result = registerSchema.parse(validData);

      // Assert
      expect(result).toEqual(validData);
    });

    it('should reject invalid email format', () => {
      // Arrange
      const invalidData = {
        email: 'not-an-email',
        password: 'password123',
        name: 'Test User',
      };

      // Act & Assert
      expect(() => registerSchema.parse(invalidData)).toThrow();
    });

    it('should reject password shorter than 6 characters', () => {
      // Arrange
      const invalidData = {
        email: 'test@example.com',
        password: '12345', // Too short
        name: 'Test User',
      };

      // Act & Assert
      expect(() => registerSchema.parse(invalidData)).toThrow();
    });

    it('should reject empty name', () => {
      // Arrange
      const invalidData = {
        email: 'test@example.com',
        password: 'password123',
        name: '', // Empty name
      };

      // Act & Assert
      expect(() => registerSchema.parse(invalidData)).toThrow();
    });

    it('should reject invalid phone number format', () => {
      // Arrange
      const invalidData = {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
        phone: '12345', // Invalid format
      };

      // Act & Assert
      expect(() => registerSchema.parse(invalidData)).toThrow();
    });

    it('should accept various valid Indonesian phone number formats', () => {
      // Arrange
      const validFormats = [
        '081234567890',
        '+6281234567890',
        '6281234567890',
        '08123456789',
        '0812345678901', // Some numbers can be longer
      ];

      // Act & Assert
      validFormats.forEach(phone => {
        expect(() => 
          registerSchema.parse({
            email: 'test@example.com',
            password: 'password123',
            name: 'Test User',
            phone,
          })
        ).not.toThrow();
      });
    });
  });

  describe('loginSchema', () => {
    it('should validate login with email', () => {
      // Arrange
      const validData = {
        email: 'test@example.com',
        password: 'password123',
      };

      // Act & Assert
      expect(() => loginSchema.parse(validData)).not.toThrow();
    });

    it('should validate login with phone number in email field', () => {
      // Arrange
      const validData = {
        email: '081234567890', // Phone number in email field
        password: 'password123',
      };

      // Act & Assert
      expect(() => loginSchema.parse(validData)).not.toThrow();
    });

    it('should reject empty email', () => {
      // Arrange
      const invalidData = {
        email: '',
        password: 'password123',
      };

      // Act & Assert
      expect(() => loginSchema.parse(invalidData)).toThrow();
    });

    it('should reject empty password', () => {
      // Arrange
      const invalidData = {
        email: 'test@example.com',
        password: '',
      };

      // Act & Assert
      expect(() => loginSchema.parse(invalidData)).toThrow();
    });

    it('should reject missing required fields', () => {
      // Arrange
      const invalidData = {
        // Missing email and password
      };

      // Act & Assert
      expect(() => loginSchema.parse(invalidData)).toThrow();
    });
  });
}); 