import { describe, it, expect } from '@jest/globals';
import { createFieldSchema, updateFieldSchema } from '../../../src/zod-schemas/field.schema';
import { FieldStatus } from '../../../src/types';

describe('Field Schema Validation', () => {
  describe('createFieldSchema', () => {
    it('should validate valid field data with numeric IDs', () => {
      // Arrange
      const validData = {
        branchId: 1,
        typeId: 2,
        name: 'Lapangan A',
        priceDay: 100000,
        priceNight: 150000,
      };

      // Act
      const result = createFieldSchema.parse(validData);

      // Assert
      expect(result).toEqual({
        ...validData,
        status: FieldStatus.AVAILABLE, // Default status should be added
      });
    });

    it('should validate valid field data with string IDs (converted to numbers)', () => {
      // Arrange
      const validData = {
        branchId: '1',
        typeId: '2',
        name: 'Lapangan A',
        priceDay: 100000,
        priceNight: 150000,
      };

      // Act
      const result = createFieldSchema.parse(validData);

      // Assert
      expect(result).toEqual({
        branchId: 1, // String converted to number
        typeId: 2, // String converted to number
        name: 'Lapangan A',
        priceDay: 100000,
        priceNight: 150000,
        status: FieldStatus.AVAILABLE,
      });
    });

    it('should validate valid field data with string prices (converted to numbers)', () => {
      // Arrange
      const validData = {
        branchId: 1,
        typeId: 2,
        name: 'Lapangan A',
        priceDay: '100000',
        priceNight: '150000',
      };

      // Act
      const result = createFieldSchema.parse(validData);

      // Assert
      expect(result).toEqual({
        branchId: 1,
        typeId: 2,
        name: 'Lapangan A',
        priceDay: 100000, // String converted to number
        priceNight: 150000, // String converted to number
        status: FieldStatus.AVAILABLE,
      });
    });

    it('should validate field data with custom status', () => {
      // Arrange
      const validData = {
        branchId: 1,
        typeId: 2,
        name: 'Lapangan A',
        priceDay: 100000,
        priceNight: 150000,
        status: FieldStatus.MAINTENANCE,
      };

      // Act
      const result = createFieldSchema.parse(validData);

      // Assert
      expect(result).toEqual(validData);
    });

    it('should reject invalid branch ID format', () => {
      // Arrange
      const invalidData = {
        branchId: 'abc', // Not a number
        typeId: 2,
        name: 'Lapangan A',
        priceDay: 100000,
        priceNight: 150000,
      };

      // Act & Assert
      expect(() => createFieldSchema.parse(invalidData)).toThrow();
    });

    it('should reject invalid type ID format', () => {
      // Arrange
      const invalidData = {
        branchId: 1,
        typeId: 'abc', // Not a number
        name: 'Lapangan A',
        priceDay: 100000,
        priceNight: 150000,
      };

      // Act & Assert
      expect(() => createFieldSchema.parse(invalidData)).toThrow();
    });

    it('should reject empty name', () => {
      // Arrange
      const invalidData = {
        branchId: 1,
        typeId: 2,
        name: '', // Empty name
        priceDay: 100000,
        priceNight: 150000,
      };

      // Act & Assert
      expect(() => createFieldSchema.parse(invalidData)).toThrow();
    });

    it('should reject name longer than 100 characters', () => {
      // Arrange
      const invalidData = {
        branchId: 1,
        typeId: 2,
        name: 'a'.repeat(101), // 101 characters
        priceDay: 100000,
        priceNight: 150000,
      };

      // Act & Assert
      expect(() => createFieldSchema.parse(invalidData)).toThrow();
    });

    it('should reject negative prices', () => {
      // Arrange
      const invalidData = {
        branchId: 1,
        typeId: 2,
        name: 'Lapangan A',
        priceDay: -100000, // Negative price
        priceNight: 150000,
      };

      // Act & Assert
      expect(() => createFieldSchema.parse(invalidData)).toThrow();
    });

    it('should reject missing required fields', () => {
      // Arrange
      const invalidData = {
        branchId: 1,
        // Missing typeId, name, priceDay, priceNight
      };

      // Act & Assert
      expect(() => createFieldSchema.parse(invalidData)).toThrow();
    });
  });

  describe('updateFieldSchema', () => {
    it('should validate complete field data for update', () => {
      // Arrange
      const validData = {
        typeId: 2,
        name: 'Lapangan A',
        priceDay: 100000,
        priceNight: 150000,
        status: FieldStatus.MAINTENANCE,
      };

      // Act
      const result = updateFieldSchema.parse(validData);

      // Assert
      expect(result).toEqual(validData);
    });

    it('should validate partial field data for update', () => {
      // Arrange
      const validData = {
        name: 'Lapangan B',
        priceNight: 200000,
      };

      // Act
      const result = updateFieldSchema.parse(validData);

      // Assert
      expect(result).toEqual(validData);
    });

    it('should validate empty object for update (no changes)', () => {
      // Arrange
      const validData = {};

      // Act
      const result = updateFieldSchema.parse(validData);

      // Assert
      expect(result).toEqual(validData);
    });

    it('should reject branchId in update schema', () => {
      // Arrange
      const invalidData = {
        branchId: 1, // Cannot update branchId
        name: 'Lapangan B',
      } as any; // Cast to any to bypass TypeScript checking

      const result = updateFieldSchema.parse(invalidData);
      expect(result).not.toHaveProperty('branchId');
    });

    it('should reject invalid data types in partial update', () => {
      // Arrange
      const invalidData = {
        priceDay: 'abc', // Not a valid number
      };

      // Act & Assert
      expect(() => updateFieldSchema.parse(invalidData)).toThrow();
    });

    it('should reject negative prices in update', () => {
      // Arrange
      const invalidData = {
        priceNight: -150000, // Negative price
      };

      // Act & Assert
      expect(() => updateFieldSchema.parse(invalidData)).toThrow();
    });
  });
}); 