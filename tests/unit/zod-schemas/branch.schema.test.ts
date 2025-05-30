import { describe, it, expect } from '@jest/globals';
import { branchSchema, updateBranchSchema, branchResponseSchema } from '../../../src/zod-schemas/branch.schema';
import { BranchStatus } from '../../../src/types';

describe('Branch Schema Validation', () => {
  describe('branchSchema (Create)', () => {
    it('should validate valid branch data', () => {
      // Arrange
      const validData = {
        name: 'Sport Center Jakarta',
        location: 'Jl. Sudirman No. 123, Jakarta',
        ownerId: 1,
      };

      // Act
      const result = branchSchema.parse(validData);

      // Assert
      expect(result).toEqual({
        ...validData,
        status: BranchStatus.ACTIVE, // Default status should be added
      });
    });

    it('should validate branch data with custom status', () => {
      // Arrange
      const validData = {
        name: 'Sport Center Bandung',
        location: 'Jl. Asia Afrika No. 456, Bandung',
        ownerId: 2,
        status: BranchStatus.INACTIVE,
      };

      // Act
      const result = branchSchema.parse(validData);

      // Assert
      expect(result).toEqual(validData);
    });

    it('should reject empty name', () => {
      // Arrange
      const invalidData = {
        name: '', // Empty name
        location: 'Jl. Sudirman No. 123, Jakarta',
        ownerId: 1,
      };

      // Act & Assert
      expect(() => branchSchema.parse(invalidData)).toThrow();
    });

    it('should reject name longer than 100 characters', () => {
      // Arrange
      const invalidData = {
        name: 'a'.repeat(101), // 101 characters
        location: 'Jl. Sudirman No. 123, Jakarta',
        ownerId: 1,
      };

      // Act & Assert
      expect(() => branchSchema.parse(invalidData)).toThrow();
    });

    it('should reject empty location', () => {
      // Arrange
      const invalidData = {
        name: 'Sport Center Jakarta',
        location: '', // Empty location
        ownerId: 1,
      };

      // Act & Assert
      expect(() => branchSchema.parse(invalidData)).toThrow();
    });

    it('should reject non-integer ownerId', () => {
      // Arrange
      const invalidData = {
        name: 'Sport Center Jakarta',
        location: 'Jl. Sudirman No. 123, Jakarta',
        ownerId: 1.5, // Not an integer
      };

      // Act & Assert
      expect(() => branchSchema.parse(invalidData)).toThrow();
    });

    it('should reject negative ownerId', () => {
      // Arrange
      const invalidData = {
        name: 'Sport Center Jakarta',
        location: 'Jl. Sudirman No. 123, Jakarta',
        ownerId: -1, // Negative
      };

      // Act & Assert
      expect(() => branchSchema.parse(invalidData)).toThrow();
    });

    it('should reject missing required fields', () => {
      // Arrange
      const invalidData = {
        name: 'Sport Center Jakarta',
        // Missing location and ownerId
      };

      // Act & Assert
      expect(() => branchSchema.parse(invalidData)).toThrow();
    });
  });

  describe('updateBranchSchema', () => {
    it('should validate valid update data', () => {
      // Arrange
      const validData = {
        name: 'Sport Center Jakarta Updated',
        location: 'Jl. Sudirman No. 456, Jakarta',
        status: BranchStatus.ACTIVE,
      };

      // Act
      const result = updateBranchSchema.parse(validData);

      // Assert
      expect(result).toEqual(validData);
    });

    it('should validate update data with optional imageUrl', () => {
      // Arrange
      const validData = {
        name: 'Sport Center Jakarta',
        location: 'Jl. Sudirman No. 123, Jakarta',
        imageUrl: 'https://example.com/image.jpg',
        status: BranchStatus.ACTIVE,
      };

      // Act
      const result = updateBranchSchema.parse(validData);

      // Assert
      expect(result).toEqual(validData);
    });

    it('should validate update data with null imageUrl', () => {
      // Arrange
      const validData = {
        name: 'Sport Center Jakarta',
        location: 'Jl. Sudirman No. 123, Jakarta',
        imageUrl: null,
        status: BranchStatus.ACTIVE,
      };

      // Act
      const result = updateBranchSchema.parse(validData);

      // Assert
      expect(result).toEqual(validData);
    });

    it('should reject empty name in update', () => {
      // Arrange
      const invalidData = {
        name: '', // Empty name
        location: 'Jl. Sudirman No. 123, Jakarta',
        status: BranchStatus.ACTIVE,
      };

      // Act & Assert
      expect(() => updateBranchSchema.parse(invalidData)).toThrow();
    });

    it('should reject empty location in update', () => {
      // Arrange
      const invalidData = {
        name: 'Sport Center Jakarta',
        location: '', // Empty location
        status: BranchStatus.ACTIVE,
      };

      // Act & Assert
      expect(() => updateBranchSchema.parse(invalidData)).toThrow();
    });

    it('should reject invalid status in update', () => {
      // Arrange
      const invalidData = {
        name: 'Sport Center Jakarta',
        location: 'Jl. Sudirman No. 123, Jakarta',
        status: 'UNKNOWN_STATUS' as any, // Invalid status
      };

      // Act & Assert
      expect(() => updateBranchSchema.parse(invalidData)).toThrow();
    });
  });

  describe('branchResponseSchema', () => {
    it('should validate valid branch response data', () => {
      // Arrange
      const validData = {
        id: 1,
        name: 'Sport Center Jakarta',
        location: 'Jl. Sudirman No. 123, Jakarta',
        ownerId: 1,
        status: BranchStatus.ACTIVE,
        createdAt: new Date(),
      };

      // Act
      const result = branchResponseSchema.parse(validData);

      // Assert
      expect(result).toEqual(validData);
    });

    it('should validate branch response with owner details', () => {
      // Arrange
      const validData = {
        id: 1,
        name: 'Sport Center Jakarta',
        location: 'Jl. Sudirman No. 123, Jakarta',
        ownerId: 1,
        status: BranchStatus.ACTIVE,
        createdAt: new Date(),
        owner: {
          id: 1,
          name: 'John Doe',
          email: 'john@example.com',
        },
      };

      // Act
      const result = branchResponseSchema.parse(validData);

      // Assert
      expect(result).toEqual(validData);
    });

    it('should reject missing required fields in response', () => {
      // Arrange
      const invalidData = {
        id: 1,
        name: 'Sport Center Jakarta',
        // Missing location, ownerId, status, createdAt
      };

      // Act & Assert
      expect(() => branchResponseSchema.parse(invalidData)).toThrow();
    });

    it('should reject invalid date format for createdAt', () => {
      // Arrange
      const invalidData = {
        id: 1,
        name: 'Sport Center Jakarta',
        location: 'Jl. Sudirman No. 123, Jakarta',
        ownerId: 1,
        status: BranchStatus.ACTIVE,
        createdAt: 'not-a-date', // Invalid date
      };

      // Act & Assert
      expect(() => branchResponseSchema.parse(invalidData)).toThrow();
    });

    it('should reject invalid owner data structure', () => {
      // Arrange
      const invalidData = {
        id: 1,
        name: 'Sport Center Jakarta',
        location: 'Jl. Sudirman No. 123, Jakarta',
        ownerId: 1,
        status: BranchStatus.ACTIVE,
        createdAt: new Date(),
        owner: {
          id: 1,
          // Missing required name field
          email: 'john@example.com',
        },
      };

      // Act & Assert
      expect(() => branchResponseSchema.parse(invalidData)).toThrow();
    });
  });
}); 