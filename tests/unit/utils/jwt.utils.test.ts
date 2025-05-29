// @ts-nocheck
import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import jwt from 'jsonwebtoken';
import { 
  generateToken, 
  verifyToken, 
  generateRefreshToken, 
  verifyRefreshToken 
} from '../../../src/utils/jwt.utils';
import { Role } from '../../../src/types/enums';
import { config } from '../../../src/config/app/env';

// Mock jwt
jest.mock('jsonwebtoken');

// Mock config
jest.mock('../../../src/config/app/env', () => ({
  config: {
    jwtSecret: 'test-secret'
  }
}));

describe('JWT Utils', () => {
  const mockUser = {
    id: 1,
    email: 'test@example.com',
    role: Role.USER,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateToken', () => {
    it('seharusnya membuat token dengan data pengguna dan expiry default', () => {
      (jwt.sign as jest.Mock).mockReturnValue('mocked-token');
      
      const token = generateToken(mockUser);
      
      expect(jwt.sign).toHaveBeenCalledWith(
        {
          id: mockUser.id,
          email: mockUser.email,
          role: mockUser.role,
        },
        config.jwtSecret,
        { expiresIn: '1h' }
      );
      expect(token).toBe('mocked-token');
    });

    it('seharusnya menggunakan waktu kadaluarsa kustom', () => {
      (jwt.sign as jest.Mock).mockReturnValue('mocked-token');
      
      const token = generateToken(mockUser, '2d');
      
      expect(jwt.sign).toHaveBeenCalledWith(
        expect.any(Object),
        config.jwtSecret,
        { expiresIn: '2d' }
      );
    });
  });

  describe('verifyToken', () => {
    it('seharusnya mengembalikan payload token ketika token valid', () => {
      const mockPayload = { id: 1, email: 'test@example.com', role: Role.USER };
      (jwt.verify as jest.Mock).mockReturnValue(mockPayload);
      
      const result = verifyToken('valid-token');
      
      expect(jwt.verify).toHaveBeenCalledWith('valid-token', config.jwtSecret);
      expect(result).toEqual(mockPayload);
    });

    it('seharusnya mengembalikan null ketika token tidak valid', () => {
      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error('invalid token');
      });
      
      const result = verifyToken('invalid-token');
      
      expect(result).toBeNull();
    });
  });

  describe('generateRefreshToken', () => {
    it('seharusnya membuat refresh token dengan TTL 30 hari', () => {
      (jwt.sign as jest.Mock).mockReturnValue('mocked-refresh-token');
      
      const token = generateRefreshToken(mockUser);
      
      expect(jwt.sign).toHaveBeenCalledWith(
        {
          id: mockUser.id,
          tokenType: 'refresh',
        },
        config.jwtSecret,
        { expiresIn: '30d' }
      );
      expect(token).toBe('mocked-refresh-token');
    });
  });

  describe('verifyRefreshToken', () => {
    it('seharusnya mengembalikan ID pengguna ketika refresh token valid', () => {
      const mockPayload = { id: 1, tokenType: 'refresh' };
      (jwt.verify as jest.Mock).mockReturnValue(mockPayload);
      
      const result = verifyRefreshToken('valid-refresh-token');
      
      expect(jwt.verify).toHaveBeenCalledWith('valid-refresh-token', config.jwtSecret);
      expect(result).toBe(1);
    });

    it('seharusnya mengembalikan null ketika refresh token bukan tipe refresh', () => {
      const mockPayload = { id: 1, tokenType: 'access' };
      (jwt.verify as jest.Mock).mockReturnValue(mockPayload);
      
      const result = verifyRefreshToken('not-refresh-token');
      
      expect(result).toBeNull();
    });

    it('seharusnya mengembalikan null ketika refresh token tidak valid', () => {
      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error('invalid token');
      });
      
      const result = verifyRefreshToken('invalid-token');
      
      expect(result).toBeNull();
    });
  });
}); 