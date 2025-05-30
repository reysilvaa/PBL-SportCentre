import { describe, it, expect } from '@jest/globals';
import { createFieldTypeSchema, updateFieldTypeSchema } from '../../../src/zod-schemas/fieldType.schema';

describe('FieldType Schema Validation', () => {
  describe('createFieldTypeSchema', () => {
    it('should validate valid field type data', () => {
      // Arrange
      const validData = {
        name: 'Futsal',
      };

      // Act & Assert
      expect(() => createFieldTypeSchema.parse(validData)).not.toThrow();
      expect(createFieldTypeSchema.parse(validData)).toEqual(validData);
    });

    it('should reject empty name', () => {
      // Arrange
      const invalidData = {
        name: '',
      };

      // Act & Assert
      expect(() => createFieldTypeSchema.parse(invalidData)).toThrow();
    });

    it('should reject name longer than 100 characters', () => {
      // Arrange
      const invalidData = {
        name: 'a'.repeat(101), // 101 characters
      };

      // Act & Assert
      expect(() => createFieldTypeSchema.parse(invalidData)).toThrow();
    });

    it('should accept name with exactly 100 characters', () => {
      // Arrange
      const validData = {
        name: 'a'.repeat(100), // 100 characters
      };

      // Act & Assert
      expect(() => createFieldTypeSchema.parse(validData)).not.toThrow();
    });

    it('should reject missing required fields', () => {
      // Arrange
      const invalidData = {
        // Missing name
      };

      // Act & Assert
      expect(() => createFieldTypeSchema.parse(invalidData)).toThrow();
    });
  });

  describe('updateFieldTypeSchema', () => {
    it('should validate valid field type data for update', () => {
      // Arrange
      const validData = {
        name: 'Basketball',
      };

      // Act & Assert
      expect(() => updateFieldTypeSchema.parse(validData)).not.toThrow();
      expect(updateFieldTypeSchema.parse(validData)).toEqual(validData);
    });

    it('should reject empty name for update', () => {
      // Arrange
      const invalidData = {
        name: '',
      };

      // Act & Assert
      expect(() => updateFieldTypeSchema.parse(invalidData)).toThrow();
    });

    it('should reject name longer than 100 characters for update', () => {
      // Arrange
      const invalidData = {
        name: 'a'.repeat(101), // 101 characters
      };

      // Act & Assert
      expect(() => updateFieldTypeSchema.parse(invalidData)).toThrow();
    });
  });
}); 