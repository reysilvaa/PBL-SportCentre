// @ts-nocheck
import { jest, describe, it, expect } from '@jest/globals';
import * as argon2 from 'argon2';
import { hashPassword, verifyPassword } from '../../../src/utils/password.utils';

// Mock argon2
jest.mock('argon2');

describe('Password Utils', () => {
  describe('hashPassword', () => {
    it('seharusnya menghasilkan hash password dengan konfigurasi yang benar', async () => {
      // Setup
      const mockHash = 'hashed-password-123';
      (argon2.hash as jest.Mock).mockResolvedValue(mockHash);
      
      // Act
      const result = await hashPassword('password123');
      
      // Assert
      expect(result).toBe(mockHash);
      expect(argon2.hash).toHaveBeenCalledWith('password123', {
        type: argon2.argon2id,
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 4,
      });
    });

    it('seharusnya meneruskan error jika terjadi kegagalan hashing', async () => {
      // Setup
      const mockError = new Error('Hashing failed');
      (argon2.hash as jest.Mock).mockRejectedValue(mockError);
      
      // Act & Assert
      await expect(hashPassword('password123')).rejects.toThrow('Hashing failed');
    });
  });

  describe('verifyPassword', () => {
    it('seharusnya mengembalikan true ketika password cocok dengan hash', async () => {
      // Setup
      (argon2.verify as jest.Mock).mockResolvedValue(true);
      const hashedPassword = 'hashed-password-123';
      
      // Act
      const result = await verifyPassword('password123', hashedPassword);
      
      // Assert
      expect(result).toBe(true);
      expect(argon2.verify).toHaveBeenCalledWith(hashedPassword, 'password123');
    });

    it('seharusnya mengembalikan false ketika password tidak cocok dengan hash', async () => {
      // Setup
      (argon2.verify as jest.Mock).mockResolvedValue(false);
      const hashedPassword = 'hashed-password-123';
      
      // Act
      const result = await verifyPassword('wrong-password', hashedPassword);
      
      // Assert
      expect(result).toBe(false);
      expect(argon2.verify).toHaveBeenCalledWith(hashedPassword, 'wrong-password');
    });

    it('seharusnya meneruskan error jika terjadi kegagalan verifikasi', async () => {
      // Setup
      const mockError = new Error('Verification failed');
      (argon2.verify as jest.Mock).mockRejectedValue(mockError);
      
      // Act & Assert
      await expect(verifyPassword('password123', 'invalid-hash')).rejects.toThrow('Verification failed');
    });
  });
}); 