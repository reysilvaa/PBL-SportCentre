import { describe, it, expect } from '@jest/globals';
import { createFieldReviewSchema, updateFieldReviewSchema } from '../../../src/zod-schemas/fieldReview.schema';

describe('FieldReview Schema Validation', () => {
  describe('createFieldReviewSchema', () => {
    it('should validate valid field review data with numeric IDs', () => {
      // Arrange
      const validData = {
        userId: 1,
        fieldId: 2,
        rating: 4,
        review: 'Great field, very well maintained!',
      };

      // Act
      const result = createFieldReviewSchema.parse(validData);

      // Assert
      expect(result).toEqual(validData);
    });

    it('should validate valid field review data with string IDs (converted to numbers)', () => {
      // Arrange
      const validData = {
        userId: '1',
        fieldId: '2',
        rating: 4,
        review: 'Great field, very well maintained!',
      };

      // Act
      const result = createFieldReviewSchema.parse(validData);

      // Assert
      expect(result).toEqual({
        userId: 1, // String converted to number
        fieldId: 2, // String converted to number
        rating: 4,
        review: 'Great field, very well maintained!',
      });
    });

    it('should validate review with minimum rating (1)', () => {
      // Arrange
      const validData = {
        userId: 1,
        fieldId: 2,
        rating: 1, // Minimum rating
        review: 'Not a good experience.',
      };

      // Act
      const result = createFieldReviewSchema.parse(validData);

      // Assert
      expect(result).toEqual(validData);
    });

    it('should validate review with maximum rating (5)', () => {
      // Arrange
      const validData = {
        userId: 1,
        fieldId: 2,
        rating: 5, // Maximum rating
        review: 'Excellent field!',
      };

      // Act
      const result = createFieldReviewSchema.parse(validData);

      // Assert
      expect(result).toEqual(validData);
    });

    it('should reject invalid userId format', () => {
      // Arrange
      const invalidData = {
        userId: 'abc', // Not a number
        fieldId: 2,
        rating: 4,
        review: 'Great field!',
      };

      // Act & Assert
      expect(() => createFieldReviewSchema.parse(invalidData)).toThrow();
    });

    it('should reject invalid fieldId format', () => {
      // Arrange
      const invalidData = {
        userId: 1,
        fieldId: 'abc', // Not a number
        rating: 4,
        review: 'Great field!',
      };

      // Act & Assert
      expect(() => createFieldReviewSchema.parse(invalidData)).toThrow();
    });

    it('should reject rating below minimum (1)', () => {
      // Arrange
      const invalidData = {
        userId: 1,
        fieldId: 2,
        rating: 0, // Below minimum
        review: 'Not good.',
      };

      // Act & Assert
      expect(() => createFieldReviewSchema.parse(invalidData)).toThrow();
    });

    it('should reject rating above maximum (5)', () => {
      // Arrange
      const invalidData = {
        userId: 1,
        fieldId: 2,
        rating: 6, // Above maximum
        review: 'Excellent!',
      };

      // Act & Assert
      expect(() => createFieldReviewSchema.parse(invalidData)).toThrow();
    });

    it('should reject empty review', () => {
      // Arrange
      const invalidData = {
        userId: 1,
        fieldId: 2,
        rating: 4,
        review: '', // Empty review
      };

      // Act & Assert
      expect(() => createFieldReviewSchema.parse(invalidData)).toThrow();
    });

    it('should reject review longer than 500 characters', () => {
      // Arrange
      const invalidData = {
        userId: 1,
        fieldId: 2,
        rating: 4,
        review: 'a'.repeat(501), // 501 characters
      };

      // Act & Assert
      expect(() => createFieldReviewSchema.parse(invalidData)).toThrow();
    });

    it('should accept review with exactly 500 characters', () => {
      // Arrange
      const validData = {
        userId: 1,
        fieldId: 2,
        rating: 4,
        review: 'a'.repeat(500), // 500 characters
      };

      // Act
      const result = createFieldReviewSchema.parse(validData);

      // Assert
      expect(result.review).toHaveLength(500);
    });

    it('should reject missing required fields', () => {
      // Arrange
      const invalidData = {
        userId: 1,
        // Missing fieldId, rating, review
      };

      // Act & Assert
      expect(() => createFieldReviewSchema.parse(invalidData)).toThrow();
    });
  });

  describe('updateFieldReviewSchema', () => {
    it('should validate complete update data', () => {
      // Arrange
      const validData = {
        rating: 5,
        review: 'Updated review: even better than before!',
      };

      // Act
      const result = updateFieldReviewSchema.parse(validData);

      // Assert
      expect(result).toEqual(validData);
    });

    it('should validate partial update with only rating', () => {
      // Arrange
      const validData = {
        rating: 3,
      };

      // Act
      const result = updateFieldReviewSchema.parse(validData);

      // Assert
      expect(result).toEqual(validData);
    });

    it('should validate partial update with only review', () => {
      // Arrange
      const validData = {
        review: 'Updated my review after second visit.',
      };

      // Act
      const result = updateFieldReviewSchema.parse(validData);

      // Assert
      expect(result).toEqual(validData);
    });

    it('should reject rating below minimum (1) in update', () => {
      // Arrange
      const invalidData = {
        rating: 0, // Below minimum
      };

      // Act & Assert
      expect(() => updateFieldReviewSchema.parse(invalidData)).toThrow();
    });

    it('should reject rating above maximum (5) in update', () => {
      // Arrange
      const invalidData = {
        rating: 6, // Above maximum
      };

      // Act & Assert
      expect(() => updateFieldReviewSchema.parse(invalidData)).toThrow();
    });

    it('should reject empty review in update', () => {
      // Arrange
      const invalidData = {
        review: '', // Empty review
      };

      // Act & Assert
      expect(() => updateFieldReviewSchema.parse(invalidData)).toThrow();
    });

    it('should reject review longer than 500 characters in update', () => {
      // Arrange
      const invalidData = {
        review: 'a'.repeat(501), // 501 characters
      };

      // Act & Assert
      expect(() => updateFieldReviewSchema.parse(invalidData)).toThrow();
    });

    it('should reject invalid field types in update', () => {
      // Arrange
      const invalidData = {
        rating: 'five' as any, // Not a number
      };

      // Act & Assert
      expect(() => updateFieldReviewSchema.parse(invalidData)).toThrow();
    });
  });
}); 