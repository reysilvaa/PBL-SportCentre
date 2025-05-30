// @ts-nocheck
import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// Mock Redis client
jest.mock('../../../src/config/services/redis', () => {
  const mockClient = {
    setEx: jest.fn().mockResolvedValue('OK'),
    exists: jest.fn().mockResolvedValue(1),
    del: jest.fn().mockResolvedValue(1),
    scan: jest.fn(),
    multi: jest.fn().mockReturnValue({
      setEx: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
    }),
  };

  return {
    __esModule: true,
    default: mockClient,
  };
});

// Import after mocking
import redisClient from '../../../src/config/services/redis';
import {
  blacklistToken,
  isTokenBlacklisted,
  removeFromBlacklist,
  clearBlacklist,
  getBlacklistSize,
  blacklistTokens,
} from '../../../src/utils/token-blacklist.utils';

describe('Token Blacklist Utils', () => {
  const testToken = 'test-jwt-token';
  const blacklistPrefix = 'token_blacklist:';
  
  beforeEach(() => {
    jest.clearAllMocks();
    console.error = jest.fn();
  });

  describe('blacklistToken', () => {
    it('should add a token to the blacklist with default expiry', async () => {
      await blacklistToken(testToken);
      
      expect(redisClient.setEx).toHaveBeenCalledWith(
        `${blacklistPrefix}${testToken}`,
        24 * 60 * 60, // Default TTL: 24 hours
        '1'
      );
    });
    
    it('should add a token to the blacklist with custom expiry', async () => {
      const customTTL = 3600; // 1 hour
      await blacklistToken(testToken, customTTL);
      
      expect(redisClient.setEx).toHaveBeenCalledWith(
        `${blacklistPrefix}${testToken}`,
        customTTL,
        '1'
      );
    });
    
    it('should handle errors when adding to blacklist', async () => {
      const error = new Error('Redis error');
      redisClient.setEx.mockRejectedValueOnce(error);
      
      await blacklistToken(testToken);
      
      expect(console.error).toHaveBeenCalledWith('Error blacklisting token:', error);
    });
  });

  describe('isTokenBlacklisted', () => {
    it('should return true when token is in blacklist', async () => {
      redisClient.exists.mockResolvedValueOnce(1);
      
      const result = await isTokenBlacklisted(testToken);
      
      expect(redisClient.exists).toHaveBeenCalledWith(`${blacklistPrefix}${testToken}`);
      expect(result).toBe(true);
    });
    
    it('should return false when token is not in blacklist', async () => {
      redisClient.exists.mockResolvedValueOnce(0);
      
      const result = await isTokenBlacklisted(testToken);
      
      expect(redisClient.exists).toHaveBeenCalledWith(`${blacklistPrefix}${testToken}`);
      expect(result).toBe(false);
    });
    
    it('should handle errors when checking blacklist', async () => {
      const error = new Error('Redis error');
      redisClient.exists.mockRejectedValueOnce(error);
      
      const result = await isTokenBlacklisted(testToken);
      
      expect(console.error).toHaveBeenCalledWith('Error checking blacklisted token:', error);
      expect(result).toBe(false);
    });
  });

  describe('removeFromBlacklist', () => {
    it('should remove a token from the blacklist successfully', async () => {
      redisClient.del.mockResolvedValueOnce(1);
      
      const result = await removeFromBlacklist(testToken);
      
      expect(redisClient.del).toHaveBeenCalledWith(`${blacklistPrefix}${testToken}`);
      expect(result).toBe(true);
    });
    
    it('should return false when token is not found in blacklist', async () => {
      redisClient.del.mockResolvedValueOnce(0);
      
      const result = await removeFromBlacklist(testToken);
      
      expect(redisClient.del).toHaveBeenCalledWith(`${blacklistPrefix}${testToken}`);
      expect(result).toBe(false);
    });
    
    it('should handle errors when removing from blacklist', async () => {
      const error = new Error('Redis error');
      redisClient.del.mockRejectedValueOnce(error);
      
      const result = await removeFromBlacklist(testToken);
      
      expect(console.error).toHaveBeenCalledWith('Error removing token from blacklist:', error);
      expect(result).toBe(false);
    });
  });

  describe('clearBlacklist', () => {
    it('should clear all tokens from the blacklist', async () => {
      // Mock the scan to return some keys on the first call, then finish
      redisClient.scan
        .mockResolvedValueOnce({ cursor: 0, keys: ['token_blacklist:token1', 'token_blacklist:token2'] });
      
      await clearBlacklist();
      
      expect(redisClient.scan).toHaveBeenCalledWith(0, {
        MATCH: `${blacklistPrefix}*`,
        COUNT: 100,
      });
      
      expect(redisClient.del).toHaveBeenCalledWith([
        'token_blacklist:token1',
        'token_blacklist:token2',
      ]);
    });
    
    it('should handle multiple batches when clearing blacklist', async () => {
      // Mock scan to return keys in batches
      redisClient.scan
        .mockResolvedValueOnce({ cursor: 1, keys: ['token_blacklist:token1'] })
        .mockResolvedValueOnce({ cursor: 0, keys: ['token_blacklist:token2'] });
      
      await clearBlacklist();
      
      expect(redisClient.scan).toHaveBeenCalledTimes(2);
      expect(redisClient.del).toHaveBeenCalledWith([
        'token_blacklist:token1',
        'token_blacklist:token2',
      ]);
    });
    
    it('should do nothing when no keys are found', async () => {
      redisClient.scan.mockResolvedValueOnce({ cursor: 0, keys: [] });
      
      await clearBlacklist();
      
      expect(redisClient.scan).toHaveBeenCalledTimes(1);
      expect(redisClient.del).not.toHaveBeenCalled();
    });
    
    it('should handle errors when clearing blacklist', async () => {
      const error = new Error('Redis error');
      redisClient.scan.mockRejectedValueOnce(error);
      
      await clearBlacklist();
      
      expect(console.error).toHaveBeenCalledWith('Error clearing blacklist:', error);
    });
  });

  describe('getBlacklistSize', () => {
    it('should return the number of tokens in the blacklist', async () => {
      redisClient.scan
        .mockResolvedValueOnce({ cursor: 0, keys: ['token_blacklist:token1', 'token_blacklist:token2'] });
      
      const result = await getBlacklistSize();
      
      expect(redisClient.scan).toHaveBeenCalledWith(0, {
        MATCH: `${blacklistPrefix}*`,
        COUNT: 100,
      });
      expect(result).toBe(2);
    });
    
    it('should handle multiple batches when counting tokens', async () => {
      redisClient.scan
        .mockResolvedValueOnce({ cursor: 1, keys: ['token_blacklist:token1'] })
        .mockResolvedValueOnce({ cursor: 0, keys: ['token_blacklist:token2', 'token_blacklist:token3'] });
      
      const result = await getBlacklistSize();
      
      expect(redisClient.scan).toHaveBeenCalledTimes(2);
      expect(result).toBe(3);
    });
    
    it('should return 0 when no tokens are found', async () => {
      redisClient.scan.mockResolvedValueOnce({ cursor: 0, keys: [] });
      
      const result = await getBlacklistSize();
      
      expect(result).toBe(0);
    });
    
    it('should handle errors when getting blacklist size', async () => {
      const error = new Error('Redis error');
      redisClient.scan.mockRejectedValueOnce(error);
      
      const result = await getBlacklistSize();
      
      expect(console.error).toHaveBeenCalledWith('Error getting blacklist size:', error);
      expect(result).toBe(0);
    });
  });

  describe('blacklistTokens', () => {
    it('should add multiple tokens to the blacklist', async () => {
      const tokens = ['token1', 'token2', 'token3'];
      
      await blacklistTokens(tokens);
      
      expect(redisClient.multi).toHaveBeenCalled();
      const mockPipeline = redisClient.multi();
      expect(mockPipeline.setEx).toHaveBeenCalledTimes(3);
      expect(mockPipeline.exec).toHaveBeenCalled();
    });
    
    it('should use custom expiry when provided', async () => {
      const tokens = ['token1', 'token2'];
      const customTTL = 3600;
      
      await blacklistTokens(tokens, customTTL);
      
      expect(redisClient.multi).toHaveBeenCalled();
    });
    
    it('should handle errors when batch blacklisting tokens', async () => {
      const tokens = ['token1', 'token2'];
      const error = new Error('Redis error');
      
      const mockPipeline = {
        setEx: jest.fn().mockReturnThis(),
        exec: jest.fn().mockRejectedValueOnce(error),
      };
      redisClient.multi.mockReturnValueOnce(mockPipeline);
      
      await blacklistTokens(tokens);
      
      expect(console.error).toHaveBeenCalledWith('Error blacklisting multiple tokens:', error);
    });
  });
}); 